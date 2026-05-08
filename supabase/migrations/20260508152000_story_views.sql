-- Gym Circle Stories: persistent per-user viewed state.

create table if not exists public.story_views (
  story_id  uuid not null references public.stories(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, user_id)
);

create index if not exists story_views_user_viewed_idx
  on public.story_views (user_id, viewed_at desc);

alter table public.story_views enable row level security;

drop policy if exists "story_views_select_self" on public.story_views;
drop policy if exists "story_views_insert_self_visible" on public.story_views;
drop policy if exists "story_views_update_self" on public.story_views;

create policy "story_views_select_self"
  on public.story_views for select to authenticated
  using (user_id = (select auth.uid()));

create policy "story_views_insert_self_visible"
  on public.story_views for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.stories s
      where s.id = story_id
        and (
          s.user_id = (select auth.uid())
          or (
            s.expires_at > now()
            and private.can_view_profile_posts(s.user_id)
          )
        )
    )
  );

create policy "story_views_update_self"
  on public.story_views for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update on public.story_views to authenticated;
