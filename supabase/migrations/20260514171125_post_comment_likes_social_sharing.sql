-- =====================================================================
-- Comment likes: social signal inside the comments area.
-- Users can like comments from other people on posts they are allowed to
-- view. Post owner/privacy rules continue to flow through
-- private.can_view_profile_posts().
-- =====================================================================

create table if not exists public.post_comment_likes (
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create index if not exists post_comment_likes_user_idx
  on public.post_comment_likes (user_id, created_at desc);

alter table public.post_comment_likes enable row level security;

drop policy if exists "post_comment_likes_select_visible" on public.post_comment_likes;
drop policy if exists "post_comment_likes_insert_visible_not_own" on public.post_comment_likes;
drop policy if exists "post_comment_likes_delete_self" on public.post_comment_likes;

create policy "post_comment_likes_select_visible"
  on public.post_comment_likes for select to authenticated
  using (
    exists (
      select 1
      from public.post_comments pc
      join public.posts p on p.id = pc.post_id
      where pc.id = comment_id
        and private.can_view_profile_posts(p.user_id)
    )
  );

create policy "post_comment_likes_insert_visible_not_own"
  on public.post_comment_likes for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.post_comments pc
      join public.posts p on p.id = pc.post_id
      where pc.id = comment_id
        and pc.user_id <> (select auth.uid())
        and private.can_view_profile_posts(p.user_id)
    )
  );

create policy "post_comment_likes_delete_self"
  on public.post_comment_likes for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.post_comment_likes to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.post_comment_likes;
exception
  when duplicate_object then null;
end $$;

comment on table public.post_comment_likes is
  'Curtidas em comentários de posts. Apenas comentários de posts visíveis podem ser curtidos.';
