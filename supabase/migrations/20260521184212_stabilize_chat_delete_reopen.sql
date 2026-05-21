-- Stabilize Gym Circle chat delete/reopen semantics.
--
-- Delete-for-me is represented by conversation_participants.deleted_at.
-- A new message after that timestamp should make the thread visible again,
-- but old messages before deleted_at must remain hidden for that participant.
-- Therefore send RPCs must not clear deleted_at when reusing existing threads.

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

  insert into public.conversation_participants (conversation_id, user_id, deleted_at)
  values
    (v_conversation_id, p_sender_id, null),
    (v_conversation_id, p_receiver_id, null)
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

create or replace function private.send_group_message(
  p_sender_id uuid,
  p_conversation_id uuid,
  p_body text default null,
  p_media_url text default null,
  p_media_type text default null
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
  v_message public.direct_messages;
begin
  if p_sender_id is null or p_sender_id <> (select auth.uid()) then
    raise exception 'sender_id inválido';
  end if;

  if not private.is_group_conversation(p_conversation_id)
    or not private.is_conversation_participant(p_conversation_id, p_sender_id) then
    raise exception 'grupo indisponível';
  end if;

  if v_body is null and v_media_url is null then
    raise exception 'mensagem vazia';
  end if;

  if v_media_type is not null and v_media_type not in ('image', 'video') then
    raise exception 'media_type inválido';
  end if;

  if v_media_url is not null and v_media_type is null then
    v_media_type := 'image';
  end if;

  insert into public.direct_messages (
    conversation_id,
    sender_id,
    receiver_id,
    body,
    media_url,
    media_type
  )
  values (
    p_conversation_id,
    p_sender_id,
    null,
    v_body,
    v_media_url,
    v_media_type
  )
  returning * into v_message;

  insert into public.notifications (user_id, actor_id, kind, body)
  select
    cp.user_id,
    p_sender_id,
    'new_message',
    left(coalesce(v_body, case when v_media_type = 'video' then 'Vídeo enviado' else 'Foto enviada' end), 140)
    from public.conversation_participants cp
   where cp.conversation_id = p_conversation_id
     and cp.user_id <> p_sender_id
     and not private.has_block_between(cp.user_id, p_sender_id);

  return v_message;
end;
$$;

revoke all on function private.send_group_message(uuid, uuid, text, text, text) from public, anon;
grant execute on function private.send_group_message(uuid, uuid, text, text, text) to authenticated;

create or replace function public.send_group_message(
  p_conversation_id uuid,
  p_body text default null,
  p_media_url text default null,
  p_media_type text default null
)
returns public.direct_messages
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.send_group_message(
    (select auth.uid()),
    p_conversation_id,
    p_body,
    p_media_url,
    p_media_type
  );
$$;

revoke all on function public.send_group_message(uuid, text, text, text) from public, anon;
grant execute on function public.send_group_message(uuid, text, text, text) to authenticated;

-- Repair the single class of legacy rows created before the conversation layer:
-- messages with a valid sender/receiver pair but no conversation_id.
update public.direct_messages dm
   set conversation_id = c.id
  from public.conversations c
 where dm.conversation_id is null
   and dm.receiver_id is not null
   and c.type = 'direct'
   and c.direct_key = least(dm.sender_id::text, dm.receiver_id::text)
     || ':' ||
     greatest(dm.sender_id::text, dm.receiver_id::text);

comment on function public.send_direct_message(uuid, text, text, text, uuid, boolean, text)
  is 'Creates/reuses a 1:1 Direct conversation without clearing participant deleted_at, so old deleted history remains hidden until new messages.';
comment on function public.send_group_message(uuid, text, text, text)
  is 'Sends a group message without clearing participant deleted_at; deleted participants only see messages newer than their delete timestamp.';
