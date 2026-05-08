-- Gym Circle Stories: likes, replies, sharing metadata, mutes and moderation.

grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------
-- Story likes + mutes
-- ---------------------------------------------------------------------
create table if not exists public.story_likes (
  story_id    uuid not null references public.stories(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (story_id, user_id)
);

create index if not exists story_likes_user_created_idx
  on public.story_likes (user_id, created_at desc);

create table if not exists public.story_mutes (
  user_id        uuid not null references auth.users(id) on delete cascade,
  muted_user_id  uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (user_id, muted_user_id),
  check (user_id <> muted_user_id)
);

create index if not exists story_mutes_muted_user_idx
  on public.story_mutes (muted_user_id, created_at desc);

alter table public.story_likes enable row level security;
alter table public.story_mutes enable row level security;

drop policy if exists "story_likes_select_visible" on public.story_likes;
drop policy if exists "story_likes_insert_self_visible" on public.story_likes;
drop policy if exists "story_likes_delete_self" on public.story_likes;

create policy "story_likes_select_visible"
  on public.story_likes for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
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

create policy "story_likes_insert_self_visible"
  on public.story_likes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.stories s
      where s.id = story_id
        and s.user_id <> (select auth.uid())
        and s.expires_at > now()
        and private.can_interact_with_user(s.user_id)
        and private.can_view_profile_posts(s.user_id)
        and not exists (
          select 1
          from public.story_mutes m
          where m.user_id = (select auth.uid())
            and m.muted_user_id = s.user_id
        )
    )
  );

create policy "story_likes_delete_self"
  on public.story_likes for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "story_mutes_select_self" on public.story_mutes;
drop policy if exists "story_mutes_insert_self" on public.story_mutes;
drop policy if exists "story_mutes_delete_self" on public.story_mutes;

create policy "story_mutes_select_self"
  on public.story_mutes for select to authenticated
  using (user_id = (select auth.uid()));

create policy "story_mutes_insert_self"
  on public.story_mutes for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and muted_user_id <> (select auth.uid())
    and private.can_interact_with_user(muted_user_id)
  );

create policy "story_mutes_delete_self"
  on public.story_mutes for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, delete on public.story_likes to authenticated;
grant select, insert, delete on public.story_mutes to authenticated;

-- Hide muted authors from the story bar at the database layer.
drop policy if exists "stories_select_visible" on public.stories;

create policy "stories_select_visible"
  on public.stories for select to anon, authenticated
  using (
    (
      expires_at > now()
      and private.can_view_profile_posts(user_id)
      and (
        (select auth.uid()) is null
        or not exists (
          select 1
          from public.story_mutes m
          where m.user_id = (select auth.uid())
            and m.muted_user_id = stories.user_id
        )
      )
    )
    or (select auth.uid()) = user_id
  );

-- ---------------------------------------------------------------------
-- Direct messages can reference stories and story previews.
-- ---------------------------------------------------------------------
alter table public.direct_messages
  add column if not exists story_id uuid references public.stories(id) on delete set null,
  add column if not exists reply_to_story boolean not null default false,
  add column if not exists story_preview_url text;

create index if not exists direct_messages_story_idx
  on public.direct_messages (story_id, created_at desc)
  where story_id is not null;

alter table public.direct_messages
  drop constraint if exists direct_messages_content_check,
  drop constraint if exists direct_messages_story_reply_check,
  drop constraint if exists direct_messages_story_preview_check;

alter table public.direct_messages
  add constraint direct_messages_content_check check (
    length(trim(coalesce(body, ''))) > 0
    or length(trim(coalesce(media_url, ''))) > 0
    or story_id is not null
  ),
  add constraint direct_messages_story_reply_check check (
    reply_to_story = false or story_id is not null
  ),
  add constraint direct_messages_story_preview_check check (
    story_preview_url is null or length(trim(story_preview_url)) > 0
  );

drop function if exists public.send_direct_message(uuid, text, text, text);
drop function if exists private.send_direct_message(uuid, uuid, text, text, text);

create or replace function private.send_direct_message(
  p_sender_id uuid,
  p_receiver_id uuid,
  p_body text default null,
  p_media_url text default null,
  p_media_type text default null,
  p_story_id uuid default null,
  p_reply_to_story boolean default false,
  p_story_preview_url text default null
)
returns public.direct_messages
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_body text := nullif(trim(coalesce(p_body, '')), '');
  v_media_url text := nullif(trim(coalesce(p_media_url, '')), '');
  v_media_type text := nullif(trim(coalesce(p_media_type, '')), '');
  v_story_preview_url text := nullif(trim(coalesce(p_story_preview_url, '')), '');
  v_story_owner uuid;
  v_story_media_url text;
  v_direct_key text;
  v_conversation_id uuid;
  v_message public.direct_messages;
begin
  if p_sender_id is null then
    raise exception 'auth.uid() is null';
  end if;

  if p_sender_id <> (select auth.uid()) then
    raise exception 'sender_id inválido';
  end if;

  if p_receiver_id is null then
    raise exception 'receiver_id is required';
  end if;

  if p_sender_id = p_receiver_id then
    raise exception 'não dá para mandar mensagem para si mesmo';
  end if;

  if v_body is null and v_media_url is null and p_story_id is null then
    raise exception 'mensagem vazia';
  end if;

  if v_media_type is not null and v_media_type not in ('image', 'video') then
    raise exception 'media_type inválido';
  end if;

  if v_media_url is not null and v_media_type is null then
    v_media_type := 'image';
  end if;

  if not private.can_interact_with_user(p_receiver_id) then
    raise exception 'não foi possível enviar mensagem para este usuário';
  end if;

  if p_story_id is not null then
    select s.user_id, s.media_url
      into v_story_owner, v_story_media_url
      from public.stories s
     where s.id = p_story_id
       and (s.expires_at > now() or s.user_id = p_sender_id)
       and private.can_view_profile_posts(s.user_id)
       and not exists (
         select 1
         from public.story_mutes m
         where m.user_id = p_sender_id
           and m.muted_user_id = s.user_id
       );

    if v_story_owner is null then
      raise exception 'story indisponível';
    end if;

    if coalesce(p_reply_to_story, false) and v_story_owner <> p_receiver_id then
      raise exception 'resposta de story precisa ir para o autor';
    end if;

    v_story_preview_url := coalesce(v_story_preview_url, v_story_media_url);
  end if;

  v_direct_key := least(p_sender_id::text, p_receiver_id::text)
    || ':' ||
    greatest(p_sender_id::text, p_receiver_id::text);

  insert into public.conversations (created_by, direct_key, last_message_at)
  values (p_sender_id, v_direct_key, now())
  on conflict (direct_key) do update
     set updated_at = now()
  returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values
    (v_conversation_id, p_sender_id),
    (v_conversation_id, p_receiver_id)
  on conflict (conversation_id, user_id) do nothing;

  insert into public.direct_messages (
    conversation_id,
    sender_id,
    receiver_id,
    body,
    media_url,
    media_type,
    story_id,
    reply_to_story,
    story_preview_url
  )
  values (
    v_conversation_id,
    p_sender_id,
    p_receiver_id,
    v_body,
    v_media_url,
    v_media_type,
    p_story_id,
    coalesce(p_reply_to_story, false),
    v_story_preview_url
  )
  returning * into v_message;

  return v_message;
end;
$$;

revoke all on function private.send_direct_message(uuid, uuid, text, text, text, uuid, boolean, text) from public, anon;
grant execute on function private.send_direct_message(uuid, uuid, text, text, text, uuid, boolean, text) to authenticated;

create or replace function public.send_direct_message(
  p_receiver_id uuid,
  p_body text default null,
  p_media_url text default null,
  p_media_type text default null,
  p_story_id uuid default null,
  p_reply_to_story boolean default false,
  p_story_preview_url text default null
)
returns public.direct_messages
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.send_direct_message(
    (select auth.uid()),
    p_receiver_id,
    p_body,
    p_media_url,
    p_media_type,
    p_story_id,
    p_reply_to_story,
    p_story_preview_url
  );
$$;

revoke all on function public.send_direct_message(uuid, text, text, text, uuid, boolean, text) from public, anon;
grant execute on function public.send_direct_message(uuid, text, text, text, uuid, boolean, text) to authenticated;

comment on function public.send_direct_message(uuid, text, text, text, uuid, boolean, text)
  is 'Creates or repairs a 1:1 Direct conversation and inserts messages, story replies or story shares atomically.';

-- ---------------------------------------------------------------------
-- Notifications for story likes.
-- ---------------------------------------------------------------------
alter table public.notifications
  add column if not exists story_id uuid references public.stories(id) on delete cascade;

alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
    check (kind in ('like', 'comment', 'follow', 'mention', 'story_like', 'story_reply'));

create index if not exists notifications_story_idx
  on public.notifications (story_id, created_at desc)
  where story_id is not null;

create or replace function private.notify_story_like()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.stories where id = new.story_id;
  if v_owner is null or v_owner = new.user_id then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, kind, story_id)
  values (v_owner, new.user_id, 'story_like', new.story_id);
  return new;
end;
$$;

revoke all on function private.notify_story_like() from public;

drop trigger if exists story_likes_after_insert_notify on public.story_likes;
create trigger story_likes_after_insert_notify
  after insert on public.story_likes
  for each row execute function private.notify_story_like();

comment on table public.story_likes is 'Curtidas únicas em stories; 1 like por usuário/story.';
comment on table public.story_mutes is 'Usuários silenciados somente da barra de stories.';
comment on column public.direct_messages.story_id is 'Story referenciado por resposta ou compartilhamento no Direct.';
comment on column public.direct_messages.reply_to_story is 'True quando a mensagem é uma resposta enviada da tela do story.';
comment on column public.direct_messages.story_preview_url is 'Preview visual do story usado no chat.';
