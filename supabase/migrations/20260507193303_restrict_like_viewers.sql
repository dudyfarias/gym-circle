-- Perfil expandido + privacidade real de quem curtiu.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

alter table public.profiles
  add column if not exists instagram_username text,
  add column if not exists birth_date date,
  add column if not exists sports text[] not null default '{}';

comment on column public.profiles.instagram_username is 'Username do Instagram sem @.';
comment on column public.profiles.birth_date is 'Data de nascimento usada para calcular idade e badge de aniversário.';
comment on column public.profiles.sports is 'Esportes praticados pelo usuário.';

create or replace function private.count_post_likes(p_post_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.post_likes
  where post_id = p_post_id;
$$;

revoke all on function private.count_post_likes(uuid) from public;
grant execute on function private.count_post_likes(uuid) to anon, authenticated;

drop view if exists public.feed_posts;

create view public.feed_posts
with (security_invoker = true)
as
  select
    p.id,
    p.user_id,
    p.image_url,
    p.media_type,
    p.caption,
    p.gym_id,
    p.workout_type,
    p.workout_date,
    p.created_at,
    p.location_source,
    coalesce(p.location_name, g.name) as location_name,
    p.location_latitude,
    p.location_longitude,
    p.location_google_maps_url,
    private.count_post_likes(p.id) as likes_count,
    coalesce(c.comments_count, 0) as comments_count,
    pr.username,
    pr.display_name,
    pr.avatar_url,
    us.current_streak             as author_current_streak,
    us.best_streak                as author_best_streak,
    us.badge_is_active_today      as author_badge_active
  from public.posts p
  join public.profiles pr on pr.user_id = p.user_id
  left join public.gyms g on g.id = p.gym_id
  left join public.user_stats us on us.user_id = p.user_id
  left join lateral (
    select count(*)::int as comments_count from public.post_comments pc where pc.post_id = p.id
  ) c on true;

grant select on public.feed_posts to anon, authenticated;

drop policy if exists "post_likes_select_all" on public.post_likes;
drop policy if exists "post_likes_select_visible" on public.post_likes;

create policy "post_likes_select_visible"
  on public.post_likes for select to authenticated
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1
      from public.posts p
      where p.id = post_id
        and p.user_id = (select auth.uid())
    )
  );
