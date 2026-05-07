-- Fix recursive RLS policies introduced by the Direct conversation layer.
-- Policies on conversation_participants cannot query conversation_participants
-- directly, otherwise Postgres recursively evaluates the same policy.

create or replace function private.is_conversation_participant(
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
      from public.conversation_participants cp
      where cp.conversation_id = p_conversation_id
        and cp.user_id = p_user_id
    );
$$;

create or replace function private.can_add_conversation_participant(
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
      where c.id = p_conversation_id
        and c.created_by = (select auth.uid())
    )
    and (
      p_user_id = (select auth.uid())
      or private.can_interact_with_user(p_user_id)
    );
$$;

create or replace function private.conversation_has_direct_pair(
  p_conversation_id uuid,
  p_sender_id uuid,
  p_receiver_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p_conversation_id is null
    or (
      private.is_conversation_participant(p_conversation_id, p_sender_id)
      and private.is_conversation_participant(p_conversation_id, p_receiver_id)
    );
$$;

revoke all on function private.is_conversation_participant(uuid, uuid) from public;
revoke all on function private.can_add_conversation_participant(uuid, uuid) from public;
revoke all on function private.conversation_has_direct_pair(uuid, uuid, uuid) from public;

grant execute on function private.is_conversation_participant(uuid, uuid) to authenticated;
grant execute on function private.can_add_conversation_participant(uuid, uuid) to authenticated;
grant execute on function private.conversation_has_direct_pair(uuid, uuid, uuid) to authenticated;

drop policy if exists "conversations_select_participants" on public.conversations;
drop policy if exists "conversations_insert_creator" on public.conversations;
drop policy if exists "conversations_update_participants" on public.conversations;

create policy "conversations_select_participants"
  on public.conversations for select to authenticated
  using (private.is_conversation_participant(id, (select auth.uid())));

create policy "conversations_insert_creator"
  on public.conversations for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.is_account_active((select auth.uid()))
  );

create policy "conversations_update_participants"
  on public.conversations for update to authenticated
  using (private.is_conversation_participant(id, (select auth.uid())))
  with check (private.is_conversation_participant(id, (select auth.uid())));

drop policy if exists "conversation_participants_select_own_conversations" on public.conversation_participants;
drop policy if exists "conversation_participants_insert_creator" on public.conversation_participants;
drop policy if exists "conversation_participants_update_self" on public.conversation_participants;

create policy "conversation_participants_select_own_conversations"
  on public.conversation_participants for select to authenticated
  using (private.is_conversation_participant(conversation_id, (select auth.uid())));

create policy "conversation_participants_insert_creator"
  on public.conversation_participants for insert to authenticated
  with check (private.can_add_conversation_participant(conversation_id, user_id));

create policy "conversation_participants_update_self"
  on public.conversation_participants for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "direct_messages_select_participants" on public.direct_messages;
drop policy if exists "direct_messages_insert_sender" on public.direct_messages;
drop policy if exists "direct_messages_update_receiver" on public.direct_messages;
drop policy if exists "direct_messages_delete_sender" on public.direct_messages;

create policy "direct_messages_select_participants"
  on public.direct_messages for select to authenticated
  using (
    (select auth.uid()) in (sender_id, receiver_id)
    or private.is_conversation_participant(conversation_id, (select auth.uid()))
  );

create policy "direct_messages_insert_sender"
  on public.direct_messages for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and sender_id <> receiver_id
    and private.can_interact_with_user(receiver_id)
    and private.conversation_has_direct_pair(conversation_id, sender_id, receiver_id)
  );

create policy "direct_messages_update_receiver"
  on public.direct_messages for update to authenticated
  using ((select auth.uid()) = receiver_id)
  with check ((select auth.uid()) = receiver_id);

create policy "direct_messages_delete_sender"
  on public.direct_messages for delete to authenticated
  using ((select auth.uid()) = sender_id);
