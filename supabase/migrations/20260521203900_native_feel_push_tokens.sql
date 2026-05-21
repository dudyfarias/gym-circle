-- Native Feel Sprint 1: device push tokens for Capacitor iOS/Android.
-- Additive only: no existing PWA push data is changed.

create table if not exists public.device_push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  platform     text not null check (platform in ('ios', 'android', 'web')),
  token        text not null unique check (length(trim(token)) > 0),
  device_id    text,
  app_version  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at   timestamptz
);

create index if not exists device_push_tokens_user_active_idx
  on public.device_push_tokens (user_id, last_seen_at desc)
  where revoked_at is null;

create index if not exists device_push_tokens_platform_idx
  on public.device_push_tokens (platform, updated_at desc)
  where revoked_at is null;

alter table public.device_push_tokens enable row level security;

drop policy if exists "device_push_tokens_select_self" on public.device_push_tokens;
drop policy if exists "device_push_tokens_insert_self" on public.device_push_tokens;
drop policy if exists "device_push_tokens_update_self" on public.device_push_tokens;
drop policy if exists "device_push_tokens_delete_self" on public.device_push_tokens;

create policy "device_push_tokens_select_self"
  on public.device_push_tokens for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "device_push_tokens_insert_self"
  on public.device_push_tokens for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "device_push_tokens_update_self"
  on public.device_push_tokens for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "device_push_tokens_delete_self"
  on public.device_push_tokens for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.device_push_tokens to authenticated;

comment on table public.device_push_tokens is
  'Native Capacitor push tokens. Registered only after an authenticated user grants notification permission.';
