-- Permite apagar uma conversa apenas para o usuário atual, sem remover
-- mensagens do histórico do outro participante.
alter table public.conversation_participants
  add column if not exists deleted_at timestamptz;

create index if not exists conversation_participants_user_deleted_idx
  on public.conversation_participants (user_id, deleted_at);

comment on column public.conversation_participants.deleted_at
  is 'Quando preenchido, a conversa fica oculta apenas para este participante até uma nova mensagem chegar.';

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
  on conflict (conversation_id, user_id) do update
     set deleted_at = null;

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
