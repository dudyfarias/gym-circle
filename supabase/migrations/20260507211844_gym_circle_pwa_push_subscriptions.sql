-- PWA push subscriptions for installed Gym Circle clients.

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null unique check (length(trim(endpoint)) > 0),
  p256dh      text not null check (length(trim(p256dh)) > 0),
  auth        text not null check (length(trim(auth)) > 0),
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id, updated_at desc);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_select_self" on public.push_subscriptions;
drop policy if exists "push_subscriptions_insert_self" on public.push_subscriptions;
drop policy if exists "push_subscriptions_update_self" on public.push_subscriptions;
drop policy if exists "push_subscriptions_delete_self" on public.push_subscriptions;

create policy "push_subscriptions_select_self"
  on public.push_subscriptions for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "push_subscriptions_insert_self"
  on public.push_subscriptions for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "push_subscriptions_update_self"
  on public.push_subscriptions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "push_subscriptions_delete_self"
  on public.push_subscriptions for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.push_subscriptions to authenticated;

comment on table public.push_subscriptions is
  'Web Push subscriptions for PWA installs. Server-side fanout can use these endpoints after VAPID keys are configured.';
