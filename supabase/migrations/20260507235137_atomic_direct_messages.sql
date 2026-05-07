-- Atomic Direct message creation.
-- The first-message flow must not depend on three client-side writes
-- (conversation, participants, message), because a partial failure can leave
-- an invisible conversation under RLS. This RPC creates/repairs the full thread
-- in one transaction and returns the inserted message.

grant usage on schema private to authenticated;

create or replace function private.send_direct_message(
  p_sender_id uuid,
  p_receiver_id uuid,
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
  v_direct_key text;
  v_conversation_id uuid;
  v_message public.direct_messages;
begin
  if p_sender_id is null then
    raise exception 'auth.uid() is null';
  end if;

  if p_receiver_id is null then
    raise exception 'receiver_id is required';
  end if;

  if p_sender_id = p_receiver_id then
    raise exception 'não dá para mandar mensagem para si mesmo';
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

  if not private.can_interact_with_user(p_receiver_id) then
    raise exception 'não foi possível enviar mensagem para este usuário';
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
    media_type
  )
  values (
    v_conversation_id,
    p_sender_id,
    p_receiver_id,
    v_body,
    v_media_url,
    v_media_type
  )
  returning * into v_message;

  return v_message;
end;
$$;

revoke all on function private.send_direct_message(uuid, uuid, text, text, text) from public, anon;
grant execute on function private.send_direct_message(uuid, uuid, text, text, text) to authenticated;

create or replace function public.send_direct_message(
  p_receiver_id uuid,
  p_body text default null,
  p_media_url text default null,
  p_media_type text default null
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
    p_media_type
  );
$$;

revoke all on function public.send_direct_message(uuid, text, text, text) from public, anon;
grant execute on function public.send_direct_message(uuid, text, text, text) to authenticated;

comment on function public.send_direct_message(uuid, text, text, text)
  is 'Creates or repairs a 1:1 Direct conversation and inserts the first/current message atomically.';
