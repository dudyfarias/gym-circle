-- Social depth pass:
-- - group conversations on top of the existing Direct layer
-- - compatible message rows for direct and group chats
-- - safer RLS for nullable receiver_id

alter table public.conversations
  add column if not exists type text not null default 'direct',
  add column if not exists name text,
  add column if not exists image_url text;

alter table public.conversations
  drop constraint if exists conversations_type_check;

alter table public.conversations
  add constraint conversations_type_check
    check (type in ('direct', 'group'));

create index if not exists conversations_type_last_message_idx
  on public.conversations (type, last_message_at desc nulls last, created_at desc);

alter table public.conversation_participants
  add column if not exists role text not null default 'member',
  add column if not exists joined_at timestamptz not null default now();

alter table public.conversation_participants
  drop constraint if exists conversation_participants_role_check;

alter table public.conversation_participants
  add constraint conversation_participants_role_check
    check (role in ('owner', 'admin', 'member'));

alter table public.direct_messages
  alter column receiver_id drop not null;

drop view if exists public.conversation_members;
create view public.conversation_members
with (security_invoker = true)
as
select
  conversation_id,
  user_id,
  role,
  joined_at,
  created_at,
  last_read_at
from public.conversation_participants
where deleted_at is null;

grant select on public.conversation_members to authenticated;

create or replace function private.is_group_conversation(
  p_conversation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from public.conversations c
     where c.id = p_conversation_id
       and c.type = 'group'
  );
$$;

create or replace function private.can_manage_conversation(
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p_conversation_id is not null
    and p_user_id is not null
    and exists (
      select 1
        from public.conversations c
        left join public.conversation_participants cp
          on cp.conversation_id = c.id
         and cp.user_id = p_user_id
       where c.id = p_conversation_id
         and (
           c.created_by = p_user_id
           or cp.role in ('owner', 'admin')
         )
    );
$$;

revoke all on function private.is_group_conversation(uuid) from public, anon;
revoke all on function private.can_manage_conversation(uuid, uuid) from public, anon;
grant execute on function private.is_group_conversation(uuid) to authenticated;
grant execute on function private.can_manage_conversation(uuid, uuid) to authenticated;

drop policy if exists "conversation_participants_delete_owner_or_self" on public.conversation_participants;
create policy "conversation_participants_delete_owner_or_self"
  on public.conversation_participants for delete to authenticated
  using (
    user_id = (select auth.uid())
    or private.can_manage_conversation(conversation_id, (select auth.uid()))
  );

drop policy if exists "direct_messages_insert_sender" on public.direct_messages;
create policy "direct_messages_insert_sender"
  on public.direct_messages for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and (
      (
        receiver_id is not null
        and sender_id <> receiver_id
        and private.can_interact_with_user(receiver_id)
        and private.conversation_has_direct_pair(conversation_id, sender_id, receiver_id)
      )
      or (
        receiver_id is null
        and conversation_id is not null
        and private.is_group_conversation(conversation_id)
        and private.is_conversation_participant(conversation_id, sender_id)
      )
    )
  );

drop policy if exists "direct_messages_insert_not_blocked" on public.direct_messages;
create policy "direct_messages_insert_not_blocked"
  on public.direct_messages as restrictive for insert to authenticated
  with check (
    receiver_id is null
    or private.can_interact_with_user(receiver_id)
  );

grant delete on public.conversation_participants to authenticated;

create or replace function private.create_group_conversation(
  p_creator_id uuid,
  p_name text,
  p_member_ids uuid[],
  p_image_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_name text := left(nullif(trim(coalesce(p_name, '')), ''), 80);
  v_image_url text := nullif(trim(coalesce(p_image_url, '')), '');
  v_member_ids uuid[];
  v_member_id uuid;
  v_conversation_id uuid;
begin
  if p_creator_id is null or p_creator_id <> (select auth.uid()) then
    raise exception 'creator inválido';
  end if;

  select array_agg(distinct member_id)
    into v_member_ids
    from (
      select p_creator_id as member_id
      union
      select unnest(coalesce(p_member_ids, array[]::uuid[])) as member_id
    ) members
   where member_id is not null;

  if coalesce(array_length(v_member_ids, 1), 0) < 2 then
    raise exception 'grupo precisa ter pelo menos 2 pessoas';
  end if;

  foreach v_member_id in array v_member_ids loop
    if v_member_id <> p_creator_id and not private.can_interact_with_user(v_member_id) then
      raise exception 'não foi possível adicionar um dos usuários ao grupo';
    end if;
  end loop;

  insert into public.conversations (created_by, type, name, image_url, last_message_at)
  values (p_creator_id, 'group', coalesce(v_name, 'Grupo Gym Circle'), v_image_url, now())
  returning id into v_conversation_id;

  insert into public.conversation_participants (
    conversation_id,
    user_id,
    role,
    joined_at,
    deleted_at
  )
  select
    v_conversation_id,
    member_id,
    case when member_id = p_creator_id then 'owner' else 'member' end,
    now(),
    null
  from unnest(v_member_ids) as member_id
  on conflict (conversation_id, user_id) do update
     set deleted_at = null,
         joined_at = coalesce(public.conversation_participants.joined_at, now());

  return v_conversation_id;
end;
$$;

revoke all on function private.create_group_conversation(uuid, text, uuid[], text) from public, anon;
grant execute on function private.create_group_conversation(uuid, text, uuid[], text) to authenticated;

create or replace function public.create_group_conversation(
  p_name text,
  p_member_ids uuid[],
  p_image_url text default null
)
returns uuid
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.create_group_conversation(
    (select auth.uid()),
    p_name,
    p_member_ids,
    p_image_url
  );
$$;

revoke all on function public.create_group_conversation(text, uuid[], text) from public, anon;
grant execute on function public.create_group_conversation(text, uuid[], text) to authenticated;

create or replace function public.add_group_conversation_members(
  p_conversation_id uuid,
  p_member_ids uuid[]
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_member_id uuid;
begin
  if not private.is_group_conversation(p_conversation_id) then
    raise exception 'grupo indisponível';
  end if;

  if not private.can_manage_conversation(p_conversation_id, (select auth.uid())) then
    raise exception 'sem permissão para adicionar membros';
  end if;

  foreach v_member_id in array coalesce(p_member_ids, array[]::uuid[]) loop
    if v_member_id is not null and not private.can_interact_with_user(v_member_id) then
      raise exception 'não foi possível adicionar um dos usuários ao grupo';
    end if;
  end loop;

  insert into public.conversation_participants (
    conversation_id,
    user_id,
    role,
    joined_at,
    deleted_at
  )
  select distinct p_conversation_id, member_id, 'member', now(), null
    from unnest(coalesce(p_member_ids, array[]::uuid[])) as member_id
   where member_id is not null
  on conflict (conversation_id, user_id) do update
     set deleted_at = null;
end;
$$;

revoke all on function public.add_group_conversation_members(uuid, uuid[]) from public, anon;
grant execute on function public.add_group_conversation_members(uuid, uuid[]) to authenticated;

create or replace function public.remove_group_conversation_member(
  p_conversation_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not private.is_group_conversation(p_conversation_id) then
    raise exception 'grupo indisponível';
  end if;

  if p_user_id <> (select auth.uid())
    and not private.can_manage_conversation(p_conversation_id, (select auth.uid())) then
    raise exception 'sem permissão para remover membro';
  end if;

  delete from public.conversation_participants
   where conversation_id = p_conversation_id
     and user_id = p_user_id;
end;
$$;

revoke all on function public.remove_group_conversation_member(uuid, uuid) from public, anon;
grant execute on function public.remove_group_conversation_member(uuid, uuid) to authenticated;

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

  update public.conversation_participants
     set deleted_at = null
   where conversation_id = p_conversation_id
     and user_id = p_sender_id;

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

  update public.conversation_participants
     set deleted_at = null
   where conversation_id = p_conversation_id
     and user_id <> p_sender_id;

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

create or replace function public.delete_conversation_for_me(
  p_conversation_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_deleted_conversation_id uuid;
begin
  update public.conversation_participants cp
     set deleted_at = now(),
         last_read_at = now()
   where cp.conversation_id = p_conversation_id
     and cp.user_id = (select auth.uid())
   returning cp.conversation_id into v_deleted_conversation_id;

  return v_deleted_conversation_id;
end;
$$;

revoke all on function public.delete_conversation_for_me(uuid) from public, anon;
grant execute on function public.delete_conversation_for_me(uuid) to authenticated;

create or replace function public.mark_conversation_read(
  p_conversation_id uuid
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  update public.conversation_participants cp
     set last_read_at = now()
   where cp.conversation_id = p_conversation_id
     and cp.user_id = (select auth.uid());

  update public.direct_messages dm
     set read_at = now()
   where dm.conversation_id = p_conversation_id
     and dm.receiver_id = (select auth.uid())
     and dm.read_at is null;
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

comment on column public.conversations.type
  is 'direct para 1:1; group para grupos estilo Instagram Direct.';
comment on view public.conversation_members
  is 'View security_invoker para expor membros sem duplicar conversation_participants.';
comment on function public.create_group_conversation(text, uuid[], text)
  is 'Cria um grupo com o usuário autenticado como owner e membros iniciais.';
comment on function public.send_group_message(uuid, text, text, text)
  is 'Envia mensagem de texto/foto/vídeo em conversa de grupo.';
