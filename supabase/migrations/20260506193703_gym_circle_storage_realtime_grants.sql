-- Storage buckets
insert into storage.buckets (id, name, public) values ('posts',   'posts',   true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('stories', 'stories', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;

-- Storage policies
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

create policy "Public read posts"   on storage.objects for select to anon, authenticated using (bucket_id = 'posts');
create policy "Public read stories" on storage.objects for select to anon, authenticated using (bucket_id = 'stories');
create policy "Public read avatars" on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');

create policy "Owner upload posts"   on storage.objects for insert to authenticated
  with check (bucket_id = 'posts'   and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owner upload stories" on storage.objects for insert to authenticated
  with check (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owner upload avatars" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Owner update posts"   on storage.objects for update to authenticated
  using (bucket_id = 'posts'   and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'posts'   and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owner update stories" on storage.objects for update to authenticated
  using (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owner update avatars" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Owner delete posts"   on storage.objects for delete to authenticated
  using (bucket_id = 'posts'   and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owner delete stories" on storage.objects for delete to authenticated
  using (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owner delete avatars" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Realtime publication
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end$$;

alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.stories;
alter publication supabase_realtime add table public.post_likes;
alter publication supabase_realtime add table public.post_comments;
alter publication supabase_realtime add table public.follows;
alter publication supabase_realtime add table public.checkins;
alter publication supabase_realtime add table public.user_stats;

-- Grants
grant usage on schema public to anon, authenticated;
grant select on public.gyms, public.profiles, public.user_gyms,
                public.posts, public.stories, public.post_likes,
                public.post_comments, public.follows, public.checkins,
                public.user_activity_days, public.user_stats
  to anon, authenticated;
grant insert, update, delete on public.profiles      to authenticated;
grant insert, update, delete on public.user_gyms     to authenticated;
grant insert, update, delete on public.posts         to authenticated;
grant insert, delete         on public.stories       to authenticated;
grant insert, delete         on public.post_likes    to authenticated;
grant insert, update, delete on public.post_comments to authenticated;
grant insert, delete         on public.follows       to authenticated;
grant insert, delete         on public.checkins      to authenticated;
grant insert                 on public.gyms          to authenticated;

-- View feed_posts (security_invoker)
create or replace view public.feed_posts
with (security_invoker = true)
as
  select
    p.id, p.user_id, p.image_url, p.caption, p.gym_id,
    p.workout_type, p.workout_date, p.created_at,
    coalesce(l.likes_count, 0) as likes_count,
    coalesce(c.comments_count, 0) as comments_count,
    pr.username, pr.display_name, pr.avatar_url,
    us.current_streak as author_current_streak,
    us.best_streak as author_best_streak,
    us.badge_is_active_today as author_badge_active
  from public.posts p
  join public.profiles pr on pr.user_id = p.user_id
  left join public.user_stats us on us.user_id = p.user_id
  left join lateral (
    select count(*)::int as likes_count from public.post_likes pl where pl.post_id = p.id
  ) l on true
  left join lateral (
    select count(*)::int as comments_count from public.post_comments pc where pc.post_id = p.id
  ) c on true;

grant select on public.feed_posts to anon, authenticated;

-- Comments
comment on table public.profiles            is 'Perfil público do usuário (1:1 com auth.users).';
comment on table public.gyms                is 'Catálogo de academias.';
comment on table public.user_gyms           is 'Vínculos academia<->usuário com preferências de horário.';
comment on table public.posts               is 'Posts de treino. Imagem obrigatória.';
comment on table public.stories             is 'Stories efêmeros (24h) que também acendem o badge.';
comment on table public.post_likes          is 'Curtidas em posts.';
comment on table public.post_comments       is 'Comentários em posts.';
comment on table public.follows             is 'Grafo de follows (follower -> following).';
comment on table public.checkins            is 'Presença social em uma academia (não acende badge sozinho).';
comment on table public.user_activity_days  is 'Fonte da verdade do streak: 1 linha por (usuário, dia, fonte).';
comment on table public.user_stats          is 'Cache denormalizado de streak/atividade. Atualizado por triggers.';;
