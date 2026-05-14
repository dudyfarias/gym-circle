-- Gym Circle account settings + temporary suspension.
-- Keeps account-status transitions behind RPCs so profile edit updates cannot
-- silently hide/delete/reactivate accounts from the public client.

alter table public.profiles
  add column if not exists suspended_at timestamptz,
  add column if not exists reactivation_token_hash text,
  add column if not exists reactivation_sent_at timestamptz,
  add column if not exists reactivation_expires_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_account_status_check;

alter table public.profiles
  add constraint profiles_account_status_check
    check (account_status in ('active', 'suspended', 'deletion_requested', 'deleted'));

create index if not exists profiles_reactivation_token_hash_idx
  on public.profiles (reactivation_token_hash)
  where reactivation_token_hash is not null;

drop policy if exists "profiles_select_visible" on public.profiles;
create policy "profiles_select_visible"
  on public.profiles for select to anon, authenticated
  using ((select auth.uid()) = user_id or private.can_view_profile(user_id));

create or replace function private.guard_profile_account_status_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (
    old.account_status is distinct from new.account_status
    or old.deleted_at is distinct from new.deleted_at
    or old.suspended_at is distinct from new.suspended_at
    or old.reactivation_token_hash is distinct from new.reactivation_token_hash
    or old.reactivation_sent_at is distinct from new.reactivation_sent_at
    or old.reactivation_expires_at is distinct from new.reactivation_expires_at
  ) and coalesce(current_setting('gym_circle.account_status_rpc', true), '') <> 'on' then
    raise exception 'account status must be changed through account RPC';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_profile_account_status_update() from public;

drop trigger if exists profiles_guard_account_status_update on public.profiles;
create trigger profiles_guard_account_status_update
  before update on public.profiles
  for each row
  execute function private.guard_profile_account_status_update();

create or replace function public.request_account_deletion(p_reason text default null)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'auth.uid() is null';
  end if;

  if not exists (
    select 1
    from public.account_deletion_requests
    where user_id = (select auth.uid())
      and status in ('requested', 'processing')
  ) then
    insert into public.account_deletion_requests (user_id, reason)
    values ((select auth.uid()), nullif(trim(coalesce(p_reason, '')), ''));
  end if;

  perform set_config('gym_circle.account_status_rpc', 'on', true);

  update public.profiles
     set account_status = 'deletion_requested',
         deleted_at = coalesce(deleted_at, now()),
         suspended_at = null,
         reactivation_token_hash = null,
         reactivation_sent_at = null,
         reactivation_expires_at = null,
         display_name = 'Usuário removido',
         bio = null,
         fitness_goal = null,
         avatar_url = null,
         instagram_username = null,
         sports = '{}',
         is_private = true
   where user_id = (select auth.uid());
end;
$$;

revoke all on function public.request_account_deletion(text) from public, anon;
grant execute on function public.request_account_deletion(text) to authenticated;

create or replace function public.suspend_own_account()
returns table (reactivation_token text, reactivation_expires_at timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_token text;
  v_expires_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'auth.uid() is null';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := now() + interval '7 days';

  perform set_config('gym_circle.account_status_rpc', 'on', true);

  update public.profiles
     set account_status = 'suspended',
         suspended_at = now(),
         deleted_at = null,
         reactivation_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
         reactivation_sent_at = now(),
         reactivation_expires_at = v_expires_at,
         is_private = true
   where user_id = (select auth.uid())
     and account_status = 'active';

  if not found then
    raise exception 'account cannot be suspended';
  end if;

  return query select v_token, v_expires_at;
end;
$$;

create or replace function public.issue_account_reactivation_token()
returns table (reactivation_token text, reactivation_expires_at timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_token text;
  v_expires_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception 'auth.uid() is null';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := now() + interval '7 days';

  perform set_config('gym_circle.account_status_rpc', 'on', true);

  update public.profiles
     set reactivation_token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
         reactivation_sent_at = now(),
         reactivation_expires_at = v_expires_at
   where user_id = (select auth.uid())
     and account_status = 'suspended';

  if not found then
    raise exception 'account is not suspended';
  end if;

  return query select v_token, v_expires_at;
end;
$$;

create or replace function public.reactivate_suspended_account(p_token text)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_token_hash text;
begin
  if (select auth.uid()) is null then
    raise exception 'auth.uid() is null';
  end if;

  v_token_hash := encode(
    extensions.digest(trim(coalesce(p_token, '')), 'sha256'),
    'hex'
  );

  perform set_config('gym_circle.account_status_rpc', 'on', true);

  update public.profiles
     set account_status = 'active',
         suspended_at = null,
         deleted_at = null,
         reactivation_token_hash = null,
         reactivation_sent_at = null,
         reactivation_expires_at = null
   where user_id = (select auth.uid())
     and account_status = 'suspended'
     and reactivation_token_hash = v_token_hash
     and reactivation_expires_at > now();

  if not found then
    raise exception 'reactivation token is invalid or expired';
  end if;
end;
$$;

revoke all on function public.suspend_own_account() from public, anon;
revoke all on function public.issue_account_reactivation_token() from public, anon;
revoke all on function public.reactivate_suspended_account(text) from public, anon;

grant execute on function public.suspend_own_account() to authenticated;
grant execute on function public.issue_account_reactivation_token() to authenticated;
grant execute on function public.reactivate_suspended_account(text) to authenticated;
