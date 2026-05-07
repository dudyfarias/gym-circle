-- =====================================================================
-- Notifications: 1 linha por evento social que afeta um usuário-alvo.
-- Triggers em post_likes, post_comments e follows criam linhas aqui.
-- =====================================================================

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  actor_id     uuid not null references auth.users(id) on delete cascade,
  kind         text not null check (kind in ('like','comment','follow','mention')),
  post_id      uuid references public.posts(id) on delete cascade,
  comment_id   uuid references public.post_comments(id) on delete cascade,
  body         text,
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  check (user_id <> actor_id)
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;
create index if not exists notifications_user_recent_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
drop policy if exists "notifications_select_self" on public.notifications;
drop policy if exists "notifications_update_self" on public.notifications;
drop policy if exists "notifications_delete_self" on public.notifications;
create policy "notifications_select_self" on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "notifications_update_self" on public.notifications
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "notifications_delete_self" on public.notifications
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, update, delete on public.notifications to authenticated;

alter publication supabase_realtime add table public.notifications;

-- Triggers
create or replace function private.notify_post_like()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_owner uuid;
begin
  select user_id into v_owner from public.posts where id = new.post_id;
  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;
  insert into public.notifications (user_id, actor_id, kind, post_id)
  values (v_owner, new.user_id, 'like', new.post_id);
  return new;
end$$;

create or replace function private.notify_post_comment()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_owner uuid; v_mention text;
begin
  select user_id into v_owner from public.posts where id = new.post_id;
  if v_owner is not null and v_owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, kind, post_id, comment_id, body)
    values (v_owner, new.user_id, 'comment', new.post_id, new.id, left(new.body, 140));
  end if;

  -- regexp_matches retorna text[] de capture groups; pegar m.match[1]
  for v_mention in
    select distinct lower(m.match[1])
      from regexp_matches(new.body, '@([a-zA-Z0-9_.]{3,32})', 'g') as m(match)
  loop
    insert into public.notifications (user_id, actor_id, kind, post_id, comment_id, body)
    select p.user_id, new.user_id, 'mention', new.post_id, new.id, left(new.body, 140)
      from public.profiles p
     where p.username = v_mention
       and p.user_id <> new.user_id
       and (v_owner is null or p.user_id <> v_owner);
  end loop;
  return new;
end$$;

create or replace function private.notify_follow()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (user_id, actor_id, kind)
  values (new.following_id, new.follower_id, 'follow');
  return new;
end$$;

drop trigger if exists post_likes_after_insert_notify on public.post_likes;
create trigger post_likes_after_insert_notify
  after insert on public.post_likes
  for each row execute function private.notify_post_like();

drop trigger if exists post_comments_after_insert_notify on public.post_comments;
create trigger post_comments_after_insert_notify
  after insert on public.post_comments
  for each row execute function private.notify_post_comment();

drop trigger if exists follows_after_insert_notify on public.follows;
create trigger follows_after_insert_notify
  after insert on public.follows
  for each row execute function private.notify_follow();

comment on table public.notifications is 'Notificações sociais. Triggers em post_likes, post_comments, follows preenchem.';
