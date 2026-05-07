-- =====================================================================
-- Gym Circle — Hardening pós-advisors
-- ---------------------------------------------------------------------
-- - Envolve auth.uid() em (select auth.uid()) (RLS init plan otimizado)
-- - Adiciona índices em FKs sem cobertura
-- - Remove SELECT em storage.objects (URL pública continua funcionando;
--   só não dá pra LISTAR conteúdo do bucket)
-- =====================================================================

-- 1. Índices em FKs faltantes
create index if not exists post_comments_user_idx on public.post_comments (user_id);
create index if not exists stories_gym_idx        on public.stories (gym_id);

-- 2. RLS otimizado: (select auth.uid()) em vez de auth.uid()
-- profiles
drop policy if exists "profiles_insert_self" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles_update_self" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- user_gyms
drop policy if exists "user_gyms_insert_self" on public.user_gyms;
drop policy if exists "user_gyms_update_self" on public.user_gyms;
drop policy if exists "user_gyms_delete_self" on public.user_gyms;
create policy "user_gyms_insert_self" on public.user_gyms for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_gyms_update_self" on public.user_gyms for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "user_gyms_delete_self" on public.user_gyms for delete to authenticated using ((select auth.uid()) = user_id);

-- posts
drop policy if exists "posts_insert_self" on public.posts;
drop policy if exists "posts_update_self" on public.posts;
drop policy if exists "posts_delete_self" on public.posts;
create policy "posts_insert_self" on public.posts for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "posts_update_self" on public.posts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "posts_delete_self" on public.posts for delete to authenticated using ((select auth.uid()) = user_id);

-- stories
drop policy if exists "stories_select_active" on public.stories;
drop policy if exists "stories_insert_self"   on public.stories;
drop policy if exists "stories_delete_self"   on public.stories;
create policy "stories_select_active" on public.stories for select to anon, authenticated using (expires_at > now() or (select auth.uid()) = user_id);
create policy "stories_insert_self"   on public.stories for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "stories_delete_self"   on public.stories for delete to authenticated using ((select auth.uid()) = user_id);

-- post_likes / post_comments / follows / checkins
drop policy if exists "post_likes_insert_self" on public.post_likes;
drop policy if exists "post_likes_delete_self" on public.post_likes;
create policy "post_likes_insert_self" on public.post_likes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "post_likes_delete_self" on public.post_likes for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "post_comments_insert_self" on public.post_comments;
drop policy if exists "post_comments_update_self" on public.post_comments;
drop policy if exists "post_comments_delete_self" on public.post_comments;
create policy "post_comments_insert_self" on public.post_comments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "post_comments_update_self" on public.post_comments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "post_comments_delete_self" on public.post_comments for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "follows_insert_self" on public.follows;
drop policy if exists "follows_delete_self" on public.follows;
create policy "follows_insert_self" on public.follows for insert to authenticated with check ((select auth.uid()) = follower_id);
create policy "follows_delete_self" on public.follows for delete to authenticated using ((select auth.uid()) = follower_id);

drop policy if exists "checkins_insert_self" on public.checkins;
drop policy if exists "checkins_delete_self" on public.checkins;
create policy "checkins_insert_self" on public.checkins for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "checkins_delete_self" on public.checkins for delete to authenticated using ((select auth.uid()) = user_id);

-- 3. Storage: remover SELECT (lista). URLs públicas continuam OK.
drop policy if exists "Public read posts"    on storage.objects;
drop policy if exists "Public read stories"  on storage.objects;
drop policy if exists "Public read avatars"  on storage.objects;
drop policy if exists "Owner upload posts"   on storage.objects;
drop policy if exists "Owner upload stories" on storage.objects;
drop policy if exists "Owner upload avatars" on storage.objects;
drop policy if exists "Owner update posts"   on storage.objects;
drop policy if exists "Owner update stories" on storage.objects;
drop policy if exists "Owner update avatars" on storage.objects;
drop policy if exists "Owner delete posts"   on storage.objects;
drop policy if exists "Owner delete stories" on storage.objects;
drop policy if exists "Owner delete avatars" on storage.objects;

create policy "Owner upload posts"   on storage.objects for insert to authenticated
  with check (bucket_id = 'posts'   and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owner upload stories" on storage.objects for insert to authenticated
  with check (bucket_id = 'stories' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owner upload avatars" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owner update posts"   on storage.objects for update to authenticated
  using (bucket_id = 'posts'   and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'posts'   and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owner update stories" on storage.objects for update to authenticated
  using (bucket_id = 'stories' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'stories' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owner update avatars" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Owner delete posts"   on storage.objects for delete to authenticated
  using (bucket_id = 'posts'   and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owner delete stories" on storage.objects for delete to authenticated
  using (bucket_id = 'stories' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Owner delete avatars" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
