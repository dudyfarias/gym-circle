-- Gym Circle — check-ins no feed social.
--
-- Check-ins vivem em `public.checkins`, enquanto o feed de fotos continua
-- vindo de `get_home_feed`. Manter uma surface separada evita transformar um
-- check-in sem mídia em `posts` (o que quebraria o contrato de mídia dos
-- clientes web/nativo e faria likes/comentários apontarem para um post falso).
--
-- A RPC replica as mesmas regras sociais do feed:
-- - próprio usuário + pessoas seguidas/aceitas;
-- - perfis ativos;
-- - bloqueios e silenciamentos;
-- - privacidade avaliada por `private.can_view_profile_posts`.

create index if not exists checkins_feed_dedupe_idx
  on public.checkins (
    user_id,
    gym_id,
    checkin_date,
    created_at desc,
    id desc
  );

-- A policy original permitia leitura de TODOS os check-ins, inclusive via
-- chave anônima e para perfis privados. O feed novo não deve reintroduzir
-- esse vazamento pela consulta direta à tabela.
drop policy if exists "checkins_select_all" on public.checkins;
drop policy if exists checkins_authenticated_visible on public.checkins;

create policy checkins_authenticated_visible
  on public.checkins
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.can_view_profile_posts(user_id)
  );

revoke all on table public.checkins from anon;
revoke update, truncate, references, trigger
  on table public.checkins from authenticated;
grant select, insert, delete on table public.checkins to authenticated;

create or replace function public.get_home_checkins(
  p_limit integer default 30
)
returns table (
  id uuid,
  user_id uuid,
  gym_id uuid,
  gym_name text,
  gym_city text,
  gym_state text,
  checkin_date date,
  created_at timestamptz,
  username text,
  display_name text,
  avatar_url text,
  author_current_streak integer,
  author_best_streak integer,
  author_badge_active boolean,
  is_following_author boolean,
  visibility text
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with viewer as (
    select auth.uid() as user_id
  ),
  deduped_checkins as (
    select distinct on (c.user_id, c.gym_id, c.checkin_date)
      c.id,
      c.user_id,
      c.gym_id,
      c.checkin_date,
      c.created_at
    from public.checkins c
    order by c.user_id, c.gym_id, c.checkin_date, c.created_at desc, c.id desc
  )
  select
    c.id,
    c.user_id,
    c.gym_id,
    g.name as gym_name,
    g.city as gym_city,
    g.state as gym_state,
    c.checkin_date,
    c.created_at,
    pr.username::text,
    pr.display_name,
    pr.avatar_url,
    us.current_streak as author_current_streak,
    us.best_streak as author_best_streak,
    us.badge_is_active_today as author_badge_active,
    exists (
      select 1
        from public.follows f
       where f.follower_id = (select user_id from viewer)
         and f.following_id = c.user_id
         and f.status = 'accepted'
    ) as is_following_author,
    case
      when c.user_id = (select user_id from viewer) then 'owner'
      else 'following'
    end as visibility
  from deduped_checkins c
  join viewer v on v.user_id is not null
  join public.profiles pr on pr.user_id = c.user_id
  join public.gyms g on g.id = c.gym_id
  left join public.user_stats_live us on us.user_id = c.user_id
  where private.can_view_profile_posts(c.user_id)
    and pr.account_status = 'active'
    and pr.deleted_at is null
    and not exists (
      select 1
        from public.post_mutes mute_row
       where mute_row.user_id = v.user_id
         and mute_row.muted_user_id = c.user_id
    )
    and not exists (
      select 1
        from public.user_blocks blocked
       where (blocked.blocker_id = v.user_id and blocked.blocked_id = c.user_id)
          or (blocked.blocker_id = c.user_id and blocked.blocked_id = v.user_id)
    )
    and (
      c.user_id = v.user_id
      or exists (
        select 1
          from public.follows f
         where f.follower_id = v.user_id
           and f.following_id = c.user_id
           and f.status = 'accepted'
      )
    )
  order by c.created_at desc, c.id desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50);
$$;

revoke all on function public.get_home_checkins(integer) from public, anon;
grant execute on function public.get_home_checkins(integer) to authenticated;

comment on function public.get_home_checkins(integer)
  is 'Check-ins recentes visíveis no feed do usuário autenticado, com filtros de privacidade, mute e bloqueio.';
