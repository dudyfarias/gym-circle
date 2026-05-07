-- RLS
alter table public.gyms                enable row level security;
alter table public.profiles            enable row level security;
alter table public.user_gyms           enable row level security;
alter table public.posts               enable row level security;
alter table public.stories             enable row level security;
alter table public.post_likes          enable row level security;
alter table public.post_comments       enable row level security;
alter table public.follows             enable row level security;
alter table public.checkins            enable row level security;
alter table public.user_activity_days  enable row level security;
alter table public.user_stats          enable row level security;

-- gyms
drop policy if exists "gyms_select_all"    on public.gyms;
drop policy if exists "gyms_insert_authed" on public.gyms;
create policy "gyms_select_all"    on public.gyms for select to anon, authenticated using (true);
create policy "gyms_insert_authed" on public.gyms for insert to authenticated with check (true);

-- profiles
drop policy if exists "profiles_select_public" on public.profiles;
drop policy if exists "profiles_insert_self"   on public.profiles;
drop policy if exists "profiles_update_self"   on public.profiles;
create policy "profiles_select_public" on public.profiles for select to anon, authenticated using (true);
create policy "profiles_insert_self"   on public.profiles for insert to authenticated with check (auth.uid() = user_id);
create policy "profiles_update_self"   on public.profiles for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- user_gyms
drop policy if exists "user_gyms_select_all"   on public.user_gyms;
drop policy if exists "user_gyms_insert_self"  on public.user_gyms;
drop policy if exists "user_gyms_update_self"  on public.user_gyms;
drop policy if exists "user_gyms_delete_self"  on public.user_gyms;
create policy "user_gyms_select_all"  on public.user_gyms for select to anon, authenticated using (true);
create policy "user_gyms_insert_self" on public.user_gyms for insert to authenticated with check (auth.uid() = user_id);
create policy "user_gyms_update_self" on public.user_gyms for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_gyms_delete_self" on public.user_gyms for delete to authenticated using (auth.uid() = user_id);

-- posts
drop policy if exists "posts_select_all"    on public.posts;
drop policy if exists "posts_insert_self"   on public.posts;
drop policy if exists "posts_update_self"   on public.posts;
drop policy if exists "posts_delete_self"   on public.posts;
create policy "posts_select_all"  on public.posts for select to anon, authenticated using (true);
create policy "posts_insert_self" on public.posts for insert to authenticated with check (auth.uid() = user_id);
create policy "posts_update_self" on public.posts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "posts_delete_self" on public.posts for delete to authenticated using (auth.uid() = user_id);

-- stories
drop policy if exists "stories_select_active" on public.stories;
drop policy if exists "stories_insert_self"   on public.stories;
drop policy if exists "stories_delete_self"   on public.stories;
create policy "stories_select_active" on public.stories for select to anon, authenticated using (expires_at > now() or auth.uid() = user_id);
create policy "stories_insert_self"   on public.stories for insert to authenticated with check (auth.uid() = user_id);
create policy "stories_delete_self"   on public.stories for delete to authenticated using (auth.uid() = user_id);

-- post_likes
drop policy if exists "post_likes_select_all"   on public.post_likes;
drop policy if exists "post_likes_insert_self"  on public.post_likes;
drop policy if exists "post_likes_delete_self"  on public.post_likes;
create policy "post_likes_select_all"  on public.post_likes for select to anon, authenticated using (true);
create policy "post_likes_insert_self" on public.post_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "post_likes_delete_self" on public.post_likes for delete to authenticated using (auth.uid() = user_id);

-- post_comments
drop policy if exists "post_comments_select_all"   on public.post_comments;
drop policy if exists "post_comments_insert_self"  on public.post_comments;
drop policy if exists "post_comments_update_self"  on public.post_comments;
drop policy if exists "post_comments_delete_self"  on public.post_comments;
create policy "post_comments_select_all"  on public.post_comments for select to anon, authenticated using (true);
create policy "post_comments_insert_self" on public.post_comments for insert to authenticated with check (auth.uid() = user_id);
create policy "post_comments_update_self" on public.post_comments for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "post_comments_delete_self" on public.post_comments for delete to authenticated using (auth.uid() = user_id);

-- follows
drop policy if exists "follows_select_all"      on public.follows;
drop policy if exists "follows_insert_self"     on public.follows;
drop policy if exists "follows_delete_self"     on public.follows;
create policy "follows_select_all"  on public.follows for select to anon, authenticated using (true);
create policy "follows_insert_self" on public.follows for insert to authenticated with check (auth.uid() = follower_id);
create policy "follows_delete_self" on public.follows for delete to authenticated using (auth.uid() = follower_id);

-- checkins
drop policy if exists "checkins_select_all"     on public.checkins;
drop policy if exists "checkins_insert_self"    on public.checkins;
drop policy if exists "checkins_delete_self"    on public.checkins;
create policy "checkins_select_all"  on public.checkins for select to anon, authenticated using (true);
create policy "checkins_insert_self" on public.checkins for insert to authenticated with check (auth.uid() = user_id);
create policy "checkins_delete_self" on public.checkins for delete to authenticated using (auth.uid() = user_id);

-- user_activity_days
drop policy if exists "uad_select_all" on public.user_activity_days;
create policy "uad_select_all" on public.user_activity_days for select to anon, authenticated using (true);

-- user_stats
drop policy if exists "user_stats_select_all" on public.user_stats;
create policy "user_stats_select_all" on public.user_stats for select to anon, authenticated using (true);;
