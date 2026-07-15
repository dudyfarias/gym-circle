-- Gym Circle — Trainer Profiles Foundation
-- Additive only. Keeps professional public data separate from sensitive
-- verification data and does not create trainer/client relationships.

alter table public.profiles
  add column if not exists account_type text not null default 'regular';

alter table public.profiles
  drop constraint if exists profiles_account_type_check;

alter table public.profiles
  add constraint profiles_account_type_check
    check (account_type in ('regular', 'trainer'));

create table if not exists public.trainer_profiles (
  user_id uuid primary key references public.profiles(user_id) on delete cascade,
  professional_name text not null check (length(trim(professional_name)) between 2 and 80),
  headline text not null check (length(trim(headline)) between 3 and 120),
  professional_bio text not null check (length(trim(professional_bio)) between 20 and 1200),
  specialties text[] not null,
  service_modes text[] not null,
  city text,
  state text,
  online_service boolean generated always as (
    'online' = any(service_modes) or 'hybrid' = any(service_modes)
  ) stored,
  in_person_service boolean generated always as (
    'in_person' = any(service_modes) or 'hybrid' = any(service_modes)
  ) stored,
  years_experience integer,
  accepts_new_clients boolean not null default false,
  contact_cta_enabled boolean not null default true,
  profile_visibility text not null default 'public',
  verification_status text not null default 'unverified',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trainer_profiles_specialties_check check (
    cardinality(specialties) between 1 and 9
    and specialties <@ array[
      'hypertrophy',
      'weight_loss',
      'strength',
      'conditioning',
      'running',
      'mobility',
      'seniors',
      'beginners',
      'functional_training'
    ]::text[]
  ),
  constraint trainer_profiles_service_modes_check check (
    cardinality(service_modes) between 1 and 3
    and service_modes <@ array['online', 'in_person', 'hybrid']::text[]
  ),
  constraint trainer_profiles_city_check check (
    city is null or length(trim(city)) between 2 and 80
  ),
  constraint trainer_profiles_state_check check (
    state is null or length(trim(state)) between 2 and 40
  ),
  constraint trainer_profiles_years_experience_check check (
    years_experience is null or years_experience between 0 and 80
  ),
  constraint trainer_profiles_visibility_check check (
    profile_visibility in ('public', 'private')
  ),
  constraint trainer_profiles_verification_status_check check (
    verification_status in ('unverified', 'pending', 'verified', 'rejected', 'suspended')
  )
);

create table if not exists public.trainer_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.trainer_profiles(user_id) on delete cascade,
  registration_number text not null check (length(trim(registration_number)) between 3 and 80),
  registration_region text not null check (length(trim(registration_region)) between 2 and 40),
  status text not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trainer_verification_requests_status_check check (
    status in ('pending', 'verified', 'rejected')
  ),
  constraint trainer_verification_requests_review_check check (
    (status = 'pending' and reviewed_at is null and reviewed_by is null)
    or (status in ('verified', 'rejected') and reviewed_at is not null and reviewed_by is not null)
  ),
  constraint trainer_verification_requests_rejection_reason_check check (
    rejection_reason is null or length(trim(rejection_reason)) between 3 and 500
  )
);

create unique index if not exists trainer_verification_requests_one_pending_idx
  on public.trainer_verification_requests (user_id)
  where status = 'pending';

create index if not exists trainer_profiles_discovery_idx
  on public.trainer_profiles (verification_status, accepts_new_clients, state, city)
  where profile_visibility = 'public' and verification_status <> 'suspended';

create index if not exists trainer_profiles_specialties_idx
  on public.trainer_profiles using gin (specialties);

create index if not exists trainer_verification_requests_user_created_idx
  on public.trainer_verification_requests (user_id, created_at desc);

create or replace function private.guard_trainer_profile_verification_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select auth.uid()) is not null and pg_trigger_depth() <= 1 then
    if tg_op = 'INSERT' and new.verification_status <> 'unverified' then
      raise exception 'verification status is managed by the review workflow';
    end if;

    if tg_op = 'UPDATE'
      and old.verification_status is distinct from new.verification_status then
      raise exception 'verification status is managed by the review workflow';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_trainer_profile_verification_status() from public;

drop trigger if exists trainer_profiles_guard_verification_status
  on public.trainer_profiles;
create trigger trainer_profiles_guard_verification_status
  before insert or update on public.trainer_profiles
  for each row execute function private.guard_trainer_profile_verification_status();

create or replace function private.guard_trainer_verification_request_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (select auth.uid()) is not null then
    if tg_op = 'INSERT' and (
      new.status <> 'pending'
      or new.reviewed_at is not null
      or new.reviewed_by is not null
      or new.rejection_reason is not null
    ) then
      raise exception 'verification review fields are managed by the review workflow';
    end if;

    if tg_op = 'UPDATE' and (
      old.status is distinct from new.status
      or old.reviewed_at is distinct from new.reviewed_at
      or old.reviewed_by is distinct from new.reviewed_by
      or old.rejection_reason is distinct from new.rejection_reason
    ) then
      raise exception 'verification review fields are managed by the review workflow';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_trainer_verification_request_review() from public;

drop trigger if exists trainer_verification_requests_guard_review
  on public.trainer_verification_requests;
create trigger trainer_verification_requests_guard_review
  before insert or update on public.trainer_verification_requests
  for each row execute function private.guard_trainer_verification_request_review();

create or replace function private.sync_trainer_verification_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.trainer_profiles
  set verification_status = case new.status
    when 'verified' then 'verified'
    when 'rejected' then 'rejected'
    else 'pending'
  end,
  updated_at = now()
  where user_id = new.user_id;

  return new;
end;
$$;

revoke all on function private.sync_trainer_verification_status() from public;

drop trigger if exists trainer_verification_requests_sync_status
  on public.trainer_verification_requests;
create trigger trainer_verification_requests_sync_status
  after insert or update of status on public.trainer_verification_requests
  for each row execute function private.sync_trainer_verification_status();

create or replace function private.touch_trainer_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_trainer_updated_at() from public;

drop trigger if exists trainer_profiles_touch_updated_at on public.trainer_profiles;
create trigger trainer_profiles_touch_updated_at
  before update on public.trainer_profiles
  for each row execute function private.touch_trainer_updated_at();

drop trigger if exists trainer_verification_requests_touch_updated_at
  on public.trainer_verification_requests;
create trigger trainer_verification_requests_touch_updated_at
  before update on public.trainer_verification_requests
  for each row execute function private.touch_trainer_updated_at();

create or replace function private.mark_profile_as_trainer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
  set account_type = 'trainer'
  where user_id = new.user_id;
  return new;
end;
$$;

revoke all on function private.mark_profile_as_trainer() from public;

drop trigger if exists trainer_profiles_mark_account_type on public.trainer_profiles;
create trigger trainer_profiles_mark_account_type
  after insert on public.trainer_profiles
  for each row execute function private.mark_profile_as_trainer();

alter table public.trainer_profiles enable row level security;
alter table public.trainer_verification_requests enable row level security;

create policy trainer_profiles_select_visible
  on public.trainer_profiles for select to anon, authenticated
  using (
    (select auth.uid()) = user_id
    or (
      profile_visibility = 'public'
      and verification_status <> 'suspended'
      and private.can_view_profile_posts(user_id)
    )
  );

create policy trainer_profiles_insert_self
  on public.trainer_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy trainer_profiles_update_self
  on public.trainer_profiles for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy trainer_verification_requests_select_self
  on public.trainer_verification_requests for select to authenticated
  using ((select auth.uid()) = user_id);

create policy trainer_verification_requests_insert_self
  on public.trainer_verification_requests for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'pending');

create policy trainer_verification_requests_update_pending_self
  on public.trainer_verification_requests for update to authenticated
  using ((select auth.uid()) = user_id and status = 'pending')
  with check ((select auth.uid()) = user_id and status = 'pending');

grant select on public.trainer_profiles to anon, authenticated;
grant insert, update on public.trainer_profiles to authenticated;
grant select, insert, update on public.trainer_verification_requests to authenticated;

revoke all on public.trainer_verification_requests from anon;

comment on table public.trainer_profiles is
  'Public professional profile. Raw registration data is intentionally stored elsewhere.';
comment on table public.trainer_verification_requests is
  'Owner-only professional registration requests. Review fields are backend-managed.';
comment on column public.trainer_profiles.verification_status is
  'Backend-managed. A client cannot mark its own profile as verified.';
