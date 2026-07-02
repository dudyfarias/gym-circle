-- Gym Circle — promover check-in a post social + endereço Saint Thomas.
--
-- Um check-in continua sendo a fonte do streak/activity_day. Quando o dono
-- adiciona mídia, criamos um post normal ligado por source_checkin_id:
-- - get_home_checkins deixa de devolver o card simples (sem duplicidade);
-- - get_home_feed devolve o post com likes/comentários/carrossel normalmente;
-- - apagar o post remove o vínculo e o check-in simples volta a aparecer;
-- - a constraint + trigger impedem vincular post ao check-in de outra pessoa,
--   academia ou dia.

alter table public.posts
  add column if not exists source_checkin_id uuid
    references public.checkins(id) on delete set null;

create unique index if not exists posts_source_checkin_id_unique_idx
  on public.posts (source_checkin_id)
  where source_checkin_id is not null;

-- Check-ins duplicados do mesmo usuário/local/dia já existiram no histórico.
-- Mesmo nesse caso, só pode haver um post promovido para o treino.
create unique index if not exists posts_promoted_checkin_workout_unique_idx
  on public.posts (user_id, gym_id, workout_date)
  where source_checkin_id is not null;

create or replace function private.validate_post_source_checkin()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  linked_checkin public.checkins%rowtype;
begin
  if new.source_checkin_id is null then
    return new;
  end if;

  select *
    into linked_checkin
    from public.checkins
   where id = new.source_checkin_id;

  if not found then
    raise exception 'check-in de origem não encontrado'
      using errcode = '23503';
  end if;

  if linked_checkin.user_id is distinct from new.user_id
     or linked_checkin.gym_id is distinct from new.gym_id
     or linked_checkin.checkin_date is distinct from new.workout_date then
    raise exception 'post e check-in de origem não pertencem ao mesmo treino'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists posts_validate_source_checkin on public.posts;
create trigger posts_validate_source_checkin
  before insert or update of source_checkin_id, user_id, gym_id, workout_date
  on public.posts
  for each row
  execute function private.validate_post_source_checkin();

-- Campos extras no retorno são retrocompatíveis (clientes antigos ignoram).
-- O DROP é necessário porque PostgreSQL não altera RETURNS TABLE via
-- CREATE OR REPLACE.
drop function if exists public.get_home_checkins(integer);

create function public.get_home_checkins(
  p_limit integer default 30
)
returns table (
  id uuid,
  user_id uuid,
  gym_id uuid,
  gym_name text,
  gym_address text,
  gym_city text,
  gym_state text,
  gym_latitude double precision,
  gym_longitude double precision,
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
    g.address as gym_address,
    g.city as gym_city,
    g.state as gym_state,
    g.latitude as gym_latitude,
    g.longitude as gym_longitude,
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
  where not exists (
      select 1
        from public.posts promoted
        join public.checkins source_checkin
          on source_checkin.id = promoted.source_checkin_id
       where source_checkin.user_id = c.user_id
         and source_checkin.gym_id = c.gym_id
         and source_checkin.checkin_date = c.checkin_date
    )
    and private.can_view_profile_posts(c.user_id)
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

comment on column public.posts.source_checkin_id
  is 'Check-in que originou este post; evita duplicar o mesmo treino no feed.';

-- Saint Thomas é o condomínio da Rua Monte Alegre, 662, e não a ilha
-- caribenha. Coordenada geocodificada pelo endereço completo.
update public.gyms
   set address = 'Rua Monte Alegre, 662 - Perdizes, 05014-000',
       city = 'São Paulo',
       state = 'SP',
       latitude = -23.5361423,
       longitude = -46.6689094
 where lower(trim(name)) = 'saint thomas';

-- Corrige também posts históricos: alguns guardaram apenas a busca ambígua
-- "Saint Thomas", que o Maps resolvia para as Ilhas Virgens.
update public.posts p
   set location_source = 'gym',
       location_name = coalesce(nullif(trim(p.location_name), ''), 'Saint Thomas'),
       location_latitude = -23.5361423,
       location_longitude = -46.6689094,
       location_google_maps_url =
         'https://www.google.com/maps/search/?api=1&query=-23.5361423%2C-46.6689094'
  from public.gyms g
 where p.gym_id = g.id
   and lower(trim(g.name)) = 'saint thomas';
