-- Delete/hide a 1:1 conversation only for the authenticated participant.
-- Messages remain available to the other participant and reappear for both
-- users only when a new message is sent.

create or replace function private.delete_direct_conversation_for_me(
  p_user_id uuid,
  p_other_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_direct_key text;
  v_conversation_id uuid;
  v_deleted_conversation_id uuid;
begin
  if p_user_id is null then
    raise exception 'auth.uid() is null';
  end if;

  if p_user_id <> (select auth.uid()) then
    raise exception 'user_id inválido';
  end if;

  if p_other_user_id is null then
    raise exception 'other_user_id is required';
  end if;

  if p_user_id = p_other_user_id then
    raise exception 'não dá para apagar conversa consigo mesmo';
  end if;

  v_direct_key := least(p_user_id::text, p_other_user_id::text)
    || ':' ||
    greatest(p_user_id::text, p_other_user_id::text);

  select c.id
    into v_conversation_id
    from public.conversations c
   where c.direct_key = v_direct_key;

  if v_conversation_id is null then
    return null;
  end if;

  update public.conversation_participants cp
     set deleted_at = now(),
         last_read_at = now()
   where cp.conversation_id = v_conversation_id
     and cp.user_id = p_user_id
   returning cp.conversation_id into v_deleted_conversation_id;

  return v_deleted_conversation_id;
end;
$$;

revoke all on function private.delete_direct_conversation_for_me(uuid, uuid) from public, anon;
grant execute on function private.delete_direct_conversation_for_me(uuid, uuid) to authenticated;

create or replace function public.delete_direct_conversation_for_me(
  p_other_user_id uuid
)
returns uuid
language sql
security invoker
set search_path = public, pg_temp
as $$
  select private.delete_direct_conversation_for_me((select auth.uid()), p_other_user_id);
$$;

revoke all on function public.delete_direct_conversation_for_me(uuid) from public, anon;
grant execute on function public.delete_direct_conversation_for_me(uuid) to authenticated;

comment on function public.delete_direct_conversation_for_me(uuid)
  is 'Oculta uma conversa 1:1 apenas para o usuário autenticado.';
