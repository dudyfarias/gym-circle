-- Instagram Direct-style conversations for Gym Circle chat.
-- Keeps the existing direct_messages table compatible while adding a
-- conversation layer with participant read state.

create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  created_by      uuid references auth.users(id) on delete set null,
  direct_key      text unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  last_message_at timestamptz
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  last_read_at    timestamptz,
  created_at      timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists conversations_last_message_idx
  on public.conversations (last_message_at desc nulls last, created_at desc);

create index if not exists conversation_participants_user_idx
  on public.conversation_participants (user_id, created_at desc);

alter table public.direct_messages
  add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;

create index if not exists direct_messages_conversation_created_idx
  on public.direct_messages (conversation_id, created_at asc);

create index if not exists direct_messages_receiver_unread_idx
  on public.direct_messages (receiver_id, read_at, created_at desc)
  where read_at is null;

with direct_pairs as (
  select
    least(sender_id::text, receiver_id::text) || ':' || greatest(sender_id::text, receiver_id::text) as direct_key,
    (array_agg(sender_id order by created_at asc))[1] as created_by,
    min(created_at) as first_message_at,
    max(created_at) as last_message_at
  from public.direct_messages
  where sender_id <> receiver_id
  group by 1
)
insert into public.conversations (
  direct_key,
  created_by,
  created_at,
  updated_at,
  last_message_at
)
select
  direct_key,
  created_by,
  first_message_at,
  last_message_at,
  last_message_at
from direct_pairs
on conflict (direct_key) do update
set
  last_message_at = case
    when public.conversations.last_message_at is null then excluded.last_message_at
    when excluded.last_message_at is null then public.conversations.last_message_at
    else greatest(public.conversations.last_message_at, excluded.last_message_at)
  end,
  updated_at = now();

with participants as (
  select distinct
    c.id as conversation_id,
    dm.sender_id as user_id
  from public.direct_messages dm
  join public.conversations c
    on c.direct_key = least(dm.sender_id::text, dm.receiver_id::text)
      || ':' ||
      greatest(dm.sender_id::text, dm.receiver_id::text)
  union
  select distinct
    c.id as conversation_id,
    dm.receiver_id as user_id
  from public.direct_messages dm
  join public.conversations c
    on c.direct_key = least(dm.sender_id::text, dm.receiver_id::text)
      || ':' ||
      greatest(dm.sender_id::text, dm.receiver_id::text)
)
insert into public.conversation_participants (conversation_id, user_id)
select conversation_id, user_id
from participants
on conflict (conversation_id, user_id) do nothing;

update public.direct_messages dm
set conversation_id = c.id
from public.conversations c
where dm.conversation_id is null
  and c.direct_key = least(dm.sender_id::text, dm.receiver_id::text)
    || ':' ||
    greatest(dm.sender_id::text, dm.receiver_id::text);

create or replace function private.touch_conversation_from_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.conversation_id is not null then
    update public.conversations
       set last_message_at = new.created_at,
           updated_at = now()
     where id = new.conversation_id;
  end if;
  return new;
end;
$$;

revoke all on function private.touch_conversation_from_message() from public;

drop trigger if exists direct_messages_touch_conversation on public.direct_messages;
create trigger direct_messages_touch_conversation
after insert on public.direct_messages
for each row
execute function private.touch_conversation_from_message();

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "conversations_select_participants" on public.conversations;
drop policy if exists "conversations_insert_creator" on public.conversations;
drop policy if exists "conversations_update_participants" on public.conversations;
create policy "conversations_select_participants"
  on public.conversations for select to authenticated
  using (
    exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = id
        and cp.user_id = (select auth.uid())
    )
  );
create policy "conversations_insert_creator"
  on public.conversations for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.is_account_active((select auth.uid()))
  );
create policy "conversations_update_participants"
  on public.conversations for update to authenticated
  using (
    exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = id
        and cp.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = id
        and cp.user_id = (select auth.uid())
    )
  );

drop policy if exists "conversation_participants_select_own_conversations" on public.conversation_participants;
drop policy if exists "conversation_participants_insert_creator" on public.conversation_participants;
drop policy if exists "conversation_participants_update_self" on public.conversation_participants;
create policy "conversation_participants_select_own_conversations"
  on public.conversation_participants for select to authenticated
  using (
    exists (
      select 1
      from public.conversation_participants mine
      where mine.conversation_id = conversation_participants.conversation_id
        and mine.user_id = (select auth.uid())
    )
  );
create policy "conversation_participants_insert_creator"
  on public.conversation_participants for insert to authenticated
  with check (
    exists (
      select 1
      from public.conversations c
      where c.id = conversation_id
        and c.created_by = (select auth.uid())
    )
    and (
      user_id = (select auth.uid())
      or private.can_interact_with_user(user_id)
    )
  );
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
    or exists (
      select 1
      from public.conversation_participants cp
      where cp.conversation_id = direct_messages.conversation_id
        and cp.user_id = (select auth.uid())
    )
  );
create policy "direct_messages_insert_sender"
  on public.direct_messages for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and sender_id <> receiver_id
    and private.can_interact_with_user(receiver_id)
    and (
      conversation_id is null
      or (
        exists (
          select 1
          from public.conversation_participants cp
          where cp.conversation_id = direct_messages.conversation_id
            and cp.user_id = sender_id
        )
        and exists (
          select 1
          from public.conversation_participants cp
          where cp.conversation_id = direct_messages.conversation_id
            and cp.user_id = receiver_id
        )
      )
    )
  );
create policy "direct_messages_update_receiver"
  on public.direct_messages for update to authenticated
  using ((select auth.uid()) = receiver_id)
  with check ((select auth.uid()) = receiver_id);
create policy "direct_messages_delete_sender"
  on public.direct_messages for delete to authenticated
  using ((select auth.uid()) = sender_id);

grant select, insert, update on public.conversations to authenticated;
grant select, insert, update on public.conversation_participants to authenticated;
grant select, insert, update, delete on public.direct_messages to authenticated;

comment on table public.conversations is 'Conversas sociais do Gym Circle. direct_key garante uma conversa 1:1 única.';
comment on table public.conversation_participants is 'Participantes e estado de leitura por conversa.';
comment on column public.direct_messages.conversation_id is 'Conversa da mensagem; sender_id/receiver_id continuam para compatibilidade 1:1.';
