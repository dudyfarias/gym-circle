-- Chat direto + login por username para o beta do Gym Circle.

create table if not exists public.direct_messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  body        text,
  media_url   text,
  media_type  text,
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  constraint direct_messages_not_self_check check (sender_id <> receiver_id),
  constraint direct_messages_content_check check (
    length(trim(coalesce(body, ''))) > 0
    or length(trim(coalesce(media_url, ''))) > 0
  ),
  constraint direct_messages_media_type_check check (
    media_type is null or media_type in ('image', 'video')
  )
);

create index if not exists direct_messages_sender_created_idx
  on public.direct_messages (sender_id, created_at desc);

create index if not exists direct_messages_receiver_created_idx
  on public.direct_messages (receiver_id, created_at desc);

alter table public.direct_messages enable row level security;

drop policy if exists "direct_messages_select_participants" on public.direct_messages;
drop policy if exists "direct_messages_insert_sender" on public.direct_messages;
drop policy if exists "direct_messages_update_receiver" on public.direct_messages;
drop policy if exists "direct_messages_delete_sender" on public.direct_messages;

create policy "direct_messages_select_participants"
  on public.direct_messages for select to authenticated
  using ((select auth.uid()) in (sender_id, receiver_id));

create policy "direct_messages_insert_sender"
  on public.direct_messages for insert to authenticated
  with check ((select auth.uid()) = sender_id);

create policy "direct_messages_update_receiver"
  on public.direct_messages for update to authenticated
  using ((select auth.uid()) = receiver_id)
  with check ((select auth.uid()) = receiver_id);

create policy "direct_messages_delete_sender"
  on public.direct_messages for delete to authenticated
  using ((select auth.uid()) = sender_id);

grant select, insert, update, delete on public.direct_messages to authenticated;

insert into storage.buckets (id, name, public)
values ('chat-media', 'chat-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "Public read chat media" on storage.objects;
drop policy if exists "Owner upload chat media" on storage.objects;
drop policy if exists "Owner update chat media" on storage.objects;
drop policy if exists "Owner delete chat media" on storage.objects;

create policy "Public read chat media"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'chat-media');

create policy "Owner upload chat media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Owner update chat media"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Owner delete chat media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create or replace function public.resolve_email_for_username(p_username text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  resolved_email text;
begin
  select u.email
    into resolved_email
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where lower(p.username) = lower(trim(p_username))
  limit 1;

  return resolved_email;
end;
$$;

revoke all on function public.resolve_email_for_username(text) from public;
grant execute on function public.resolve_email_for_username(text) to anon, authenticated;
