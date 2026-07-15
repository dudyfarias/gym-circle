-- Gym Circle — Trainer Workspace Foundation (Sprint 1.5A)
-- Additive only. Creates the professional tenant and membership boundary.
-- Relationships, students, assignments, templates and AI are intentionally
-- outside this migration.

create table if not exists public.trainer_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(user_id) on delete cascade,
  name text not null,
  slug text unique,
  workspace_type text not null default 'individual',
  status text not null default 'active',
  city text,
  state text,
  logo_url text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trainer_workspaces_name_check
    check (length(trim(name)) between 2 and 100),
  constraint trainer_workspaces_slug_check
    check (
      slug is null
      or (
        length(slug) between 3 and 64
        and slug = lower(slug)
        and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
      )
    ),
  constraint trainer_workspaces_type_check
    check (workspace_type in ('individual', 'studio', 'advisory', 'gym_partner')),
  constraint trainer_workspaces_status_check
    check (status in ('active', 'suspended', 'archived')),
  constraint trainer_workspaces_city_check
    check (city is null or length(trim(city)) between 2 and 80),
  constraint trainer_workspaces_state_check
    check (state is null or length(trim(state)) between 2 and 40),
  constraint trainer_workspaces_logo_url_check
    check (logo_url is null or length(trim(logo_url)) between 8 and 2048),
  constraint trainer_workspaces_description_check
    check (description is null or length(trim(description)) <= 800)
);

create table if not exists public.trainer_workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.trainer_workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  role text not null,
  status text not null default 'active',
  invited_by uuid references public.profiles(user_id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trainer_workspace_members_workspace_user_key
    unique (workspace_id, user_id),
  constraint trainer_workspace_members_role_check
    check (role in ('owner', 'trainer', 'assistant', 'viewer')),
  constraint trainer_workspace_members_status_check
    check (status in ('invited', 'active', 'suspended', 'removed')),
  constraint trainer_workspace_members_joined_check
    check (
      (status = 'invited' and joined_at is null)
      or (status in ('active', 'suspended') and joined_at is not null)
      or status = 'removed'
    )
);

-- The MVP exposes one owned, non-archived workspace at a time. Users may still
-- participate in other workspaces as members. A later governance migration can
-- drop this index when multi-workspace ownership is exposed in the product.
create unique index if not exists trainer_workspaces_one_owned_active_idx
  on public.trainer_workspaces (owner_user_id)
  where status <> 'archived';

create index if not exists trainer_workspaces_owner_status_idx
  on public.trainer_workspaces (owner_user_id, status, updated_at desc);

create index if not exists trainer_workspace_members_user_status_idx
  on public.trainer_workspace_members (user_id, status, updated_at desc);

create index if not exists trainer_workspace_members_workspace_status_idx
  on public.trainer_workspace_members (workspace_id, status, created_at);

create unique index if not exists trainer_workspace_members_one_active_owner_idx
  on public.trainer_workspace_members (workspace_id)
  where role = 'owner' and status = 'active';

create or replace function private.ensure_trainer_workspace_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_id uuid;
  v_owner_user_id uuid;
begin
  if tg_table_name = 'trainer_workspaces' then
    v_workspace_id := coalesce(new.id, old.id);
  else
    v_workspace_id := coalesce(new.workspace_id, old.workspace_id);
  end if;

  select workspace.owner_user_id
  into v_owner_user_id
  from public.trainer_workspaces workspace
  where workspace.id = v_workspace_id;

  -- A cascading workspace deletion makes the parent row invisible. There is
  -- no invariant left to enforce in that case.
  if v_owner_user_id is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if not exists (
    select 1
    from public.trainer_workspace_members member
    where member.workspace_id = v_workspace_id
      and member.user_id = v_owner_user_id
      and member.role = 'owner'
      and member.status = 'active'
  ) then
    raise exception using
      errcode = '23514',
      message = 'trainer_workspace_active_owner_membership_required';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function private.ensure_trainer_workspace_owner_membership()
  from public, anon, authenticated;

drop trigger if exists trainer_workspaces_require_owner_membership
  on public.trainer_workspaces;
create constraint trigger trainer_workspaces_require_owner_membership
  after insert or update of owner_user_id on public.trainer_workspaces
  deferrable initially deferred
  for each row execute function private.ensure_trainer_workspace_owner_membership();

drop trigger if exists trainer_workspace_members_preserve_owner
  on public.trainer_workspace_members;
create constraint trigger trainer_workspace_members_preserve_owner
  after insert or update or delete on public.trainer_workspace_members
  deferrable initially deferred
  for each row execute function private.ensure_trainer_workspace_owner_membership();

create or replace function private.is_active_trainer_workspace_member(
  p_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select auth.uid()) is not null
    and p_workspace_id is not null
    and exists (
      select 1
      from public.trainer_workspace_members member
      where member.workspace_id = p_workspace_id
        and member.user_id = (select auth.uid())
        and member.status = 'active'
    );
$$;

revoke all on function private.is_active_trainer_workspace_member(uuid)
  from public, anon;
grant execute on function private.is_active_trainer_workspace_member(uuid)
  to authenticated;

create or replace function private.touch_trainer_workspace_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_trainer_workspace_updated_at()
  from public, anon, authenticated;

drop trigger if exists trainer_workspaces_touch_updated_at
  on public.trainer_workspaces;
create trigger trainer_workspaces_touch_updated_at
  before update on public.trainer_workspaces
  for each row execute function private.touch_trainer_workspace_updated_at();

drop trigger if exists trainer_workspace_members_touch_updated_at
  on public.trainer_workspace_members;
create trigger trainer_workspace_members_touch_updated_at
  before update on public.trainer_workspace_members
  for each row execute function private.touch_trainer_workspace_updated_at();

alter table public.trainer_workspaces enable row level security;
alter table public.trainer_workspace_members enable row level security;

create policy trainer_workspaces_select_members
  on public.trainer_workspaces for select to authenticated
  using (
    owner_user_id = (select auth.uid())
    or private.is_active_trainer_workspace_member(id)
  );

create policy trainer_workspaces_update_owner_basics
  on public.trainer_workspaces for update to authenticated
  using (
    owner_user_id = (select auth.uid())
    and status = 'active'
  )
  with check (
    owner_user_id = (select auth.uid())
    and status = 'active'
  );

create policy trainer_workspace_members_select_workspace
  on public.trainer_workspace_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.is_active_trainer_workspace_member(workspace_id)
  );

-- Creation is intentionally a privileged, atomic per-user operation. The
-- owner id never comes from the client and the membership is created in the
-- same transaction as the workspace.
create or replace function public.create_trainer_workspace(
  p_name text,
  p_workspace_type text default 'individual'
)
returns public.trainer_workspaces
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name text := trim(coalesce(p_name, ''));
  v_workspace_type text := lower(trim(coalesce(p_workspace_type, 'individual')));
  v_workspace public.trainer_workspaces;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if length(v_name) < 2 or length(v_name) > 100 then
    raise exception using errcode = '22023', message = 'trainer_workspace_name_invalid';
  end if;

  if v_workspace_type not in ('individual', 'studio', 'advisory') then
    raise exception using errcode = '22023', message = 'trainer_workspace_type_invalid';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.user_id = v_user_id
      and profile.account_type = 'trainer'
      and profile.account_status = 'active'
      and profile.deleted_at is null
  ) or not exists (
    select 1
    from public.trainer_profiles trainer
    where trainer.user_id = v_user_id
      and trainer.verification_status <> 'suspended'
  ) then
    raise exception using errcode = '42501', message = 'trainer_profile_required';
  end if;

  if exists (
    select 1
    from public.trainer_workspaces workspace
    where workspace.owner_user_id = v_user_id
      and workspace.status <> 'archived'
  ) then
    raise exception using errcode = '23505', message = 'trainer_workspace_already_exists';
  end if;

  insert into public.trainer_workspaces (
    owner_user_id,
    name,
    workspace_type
  )
  values (
    v_user_id,
    v_name,
    v_workspace_type
  )
  returning * into v_workspace;

  insert into public.trainer_workspace_members (
    workspace_id,
    user_id,
    role,
    status,
    invited_by,
    joined_at
  )
  values (
    v_workspace.id,
    v_user_id,
    'owner',
    'active',
    v_user_id,
    now()
  );

  return v_workspace;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'trainer_workspace_already_exists';
end;
$$;

revoke all on function public.create_trainer_workspace(text, text)
  from public, anon;
grant execute on function public.create_trainer_workspace(text, text)
  to authenticated;

grant select on public.trainer_workspaces to authenticated;
grant update (name, description, city, state, logo_url)
  on public.trainer_workspaces to authenticated;
grant select on public.trainer_workspace_members to authenticated;

revoke insert, delete on public.trainer_workspaces from authenticated;
revoke insert, update, delete on public.trainer_workspace_members from authenticated;
revoke all on public.trainer_workspaces from anon;
revoke all on public.trainer_workspace_members from anon;

comment on table public.trainer_workspaces is
  'Private professional tenant. It never owns student activities or accepted workout plans.';
comment on table public.trainer_workspace_members is
  'Professional workspace membership only. Student relationships use a separate future model.';
comment on function public.create_trainer_workspace(text, text) is
  'Creates the authenticated trainer workspace and owner membership atomically.';
