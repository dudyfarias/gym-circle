-- Gym Circle — Places P0.5: user-gym privacy and external provenance
--
-- This migration is intentionally limited to two boundaries:
--   1. user_gyms becomes owner-only. A separate, narrow RPC exposes only the
--      main gym selected on profiles.main_gym_id when profile privacy allows.
--   2. external place identifiers are stored separately from gyms and can only
--      be written atomically through a hardened RPC.
--
-- Places P1 canonical places, provider selection, broad deduplication and
-- provider payload caching remain out of scope.

-- ---------------------------------------------------------------------------
-- user_gyms privacy
-- ---------------------------------------------------------------------------

drop policy if exists "user_gyms_select_all" on public.user_gyms;
drop policy if exists "user_gyms_select_self" on public.user_gyms;

create policy "user_gyms_select_self"
  on public.user_gyms
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Anonymous callers must not be able to query the relationship table at all.
-- Authenticated callers retain SELECT so RLS can return only their own rows.
revoke select on public.user_gyms from anon;
grant select on public.user_gyms to authenticated;

comment on table public.user_gyms is
  'Private user-to-gym relationships and scheduling preferences. Direct SELECT is owner-only; public profile gym data must use get_visible_profile_gym.';

-- The public profile surface intentionally uses profiles.main_gym_id rather
-- than reading user_gyms. That makes the user's explicit main-gym choice the
-- only disclosed relationship and never exposes secondary gyms, preferred
-- days/times, relationship IDs or timestamps.
create or replace function public.get_visible_profile_gym(p_user_id uuid)
returns table (
  gym_id uuid,
  name text,
  city text,
  state text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    gym.id as gym_id,
    gym.name,
    gym.city,
    gym.state
  from public.profiles profile
  join public.gyms gym on gym.id = profile.main_gym_id
  where profile.user_id = p_user_id
    and profile.account_status = 'active'
    and profile.deleted_at is null
    and private.can_view_profile_posts(profile.user_id);
$$;

revoke all on function public.get_visible_profile_gym(uuid)
  from public, anon, authenticated;
grant execute on function public.get_visible_profile_gym(uuid)
  to anon, authenticated;

comment on function public.get_visible_profile_gym(uuid) is
  'Returns only the selected main gym name/city/state when the viewer may see the target profile posts. Private profiles require owner or accepted follower; blocks and inactive accounts return no rows.';

create or replace view public.visible_profile_main_gyms
with (security_invoker = true)
as
select
  profile.user_id,
  gym.id as gym_id,
  gym.name,
  gym.city,
  gym.state
from public.profiles profile
join public.gyms gym on gym.id = profile.main_gym_id
where profile.account_status = 'active'
  and profile.deleted_at is null
  and private.can_view_profile_posts(profile.user_id);

revoke all on public.visible_profile_main_gyms from public, anon, authenticated;
grant select on public.visible_profile_main_gyms to anon, authenticated;

comment on view public.visible_profile_main_gyms is
  'Batch-safe profile surface for main gyms. It omits secondary relationships, preferences and timestamps and follows profile privacy/block rules.';

-- ---------------------------------------------------------------------------
-- Minimal external-reference provenance, compatible with Places P1
-- ---------------------------------------------------------------------------

create table if not exists public.gym_place_external_refs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  provider text not null,
  external_id text not null,
  source_service text,
  provider_category text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_verified_at timestamptz,
  cache_expires_at timestamptz,
  constraint gym_place_external_refs_provider_check
    check (provider in ('google', 'apple', 'openstreetmap', 'mapbox')),
  constraint gym_place_external_refs_external_id_check
    check (length(trim(external_id)) between 1 and 512),
  constraint gym_place_external_refs_source_service_check
    check (
      source_service is null
      or length(trim(source_service)) between 1 and 80
    ),
  constraint gym_place_external_refs_provider_category_check
    check (
      provider_category is null
      or length(trim(provider_category)) between 1 and 160
    ),
  constraint gym_place_external_refs_cache_window_check
    check (
      cache_expires_at is null
      or last_verified_at is null
      or cache_expires_at >= last_verified_at
    ),
  constraint gym_place_external_refs_provider_external_key
    unique (provider, external_id),
  constraint gym_place_external_refs_gym_provider_external_key
    unique (gym_id, provider, external_id)
);

create index if not exists gym_place_external_refs_gym_idx
  on public.gym_place_external_refs (gym_id, provider);

create index if not exists gym_place_external_refs_created_by_idx
  on public.gym_place_external_refs (created_by, created_at desc)
  where created_by is not null;

alter table public.gym_place_external_refs enable row level security;

-- No client-facing table policies are created. Even if table privileges are
-- granted accidentally later, RLS remains deny-by-default. Registration goes
-- through the narrow RPC below; reads needed by P1 should also use a dedicated
-- licensed-data-aware surface instead of exposing the full reference table.
revoke all on public.gym_place_external_refs from public, anon, authenticated;

comment on table public.gym_place_external_refs is
  'External identifiers for Gym Circle gyms. Stores identifiers and minimal provenance only, never full provider payloads. OSM object IDs use provider=openstreetmap and source_service=nominatim or overpass.';
comment on column public.gym_place_external_refs.provider is
  'Canonical data provider. Nominatim and Overpass are source services over provider=openstreetmap.';
comment on column public.gym_place_external_refs.cache_expires_at is
  'Optional expiry metadata only; it does not authorize caching beyond the provider license.';

-- Security-definer logic lives in the private, non-exposed schema. It is
-- required because the provenance table deliberately has no direct client
-- grants. The function validates auth/account state and creates the gym plus
-- its external reference atomically. It never attaches an external ID to an
-- arbitrary existing gym: ambiguous legacy/name collisions require review.
create or replace function private.register_external_gym(
  p_provider text,
  p_external_id text,
  p_name text,
  p_city text,
  p_latitude double precision,
  p_longitude double precision,
  p_address text default null,
  p_state text default null,
  p_source_service text default null,
  p_provider_category text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_provider text := lower(trim(p_provider));
  v_external_id text := trim(p_external_id);
  v_name text := trim(p_name);
  v_city text := trim(p_city);
  v_gym_id uuid;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'authentication_required';
  end if;

  if not private.is_account_active(v_user_id) then
    raise exception using
      errcode = '42501',
      message = 'active_account_required';
  end if;

  if v_provider is null
     or v_provider not in ('google', 'apple', 'openstreetmap', 'mapbox') then
    raise exception using
      errcode = '22023',
      message = 'unsupported_place_provider';
  end if;

  if v_external_id is null
     or length(v_external_id) not between 1 and 512 then
    raise exception using
      errcode = '22023',
      message = 'invalid_external_place_id';
  end if;

  -- A known external reference is the only automatic strong-match signal.
  select external_ref.gym_id
    into v_gym_id
    from public.gym_place_external_refs external_ref
   where external_ref.provider = v_provider
     and external_ref.external_id = v_external_id;

  if v_gym_id is not null then
    return v_gym_id;
  end if;

  if v_name is null
     or length(v_name) not between 3 and 160
     or v_city is null
     or length(v_city) not between 2 and 100
     or p_latitude is null
     or p_longitude is null
     or p_latitude not between -90 and 90
     or p_longitude not between -180 and 180
     or (p_address is not null and length(trim(p_address)) > 500)
     or (p_state is not null and length(trim(p_state)) > 80)
     or (
       p_source_service is not null
       and length(trim(p_source_service)) not between 1 and 80
     )
     or (
       p_provider_category is not null
       and length(trim(p_provider_category)) not between 1 and 160
     ) then
    raise exception using
      errcode = '22023',
      message = 'invalid_external_gym_payload';
  end if;

  begin
    insert into public.gyms (
      name,
      address,
      city,
      state,
      latitude,
      longitude
    )
    values (
      v_name,
      nullif(trim(p_address), ''),
      v_city,
      nullif(trim(p_state), ''),
      p_latitude,
      p_longitude
    )
    returning id into v_gym_id;

    insert into public.gym_place_external_refs (
      gym_id,
      provider,
      external_id,
      source_service,
      provider_category,
      created_by,
      last_verified_at
    )
    values (
      v_gym_id,
      v_provider,
      v_external_id,
      nullif(lower(trim(p_source_service)), ''),
      nullif(trim(p_provider_category), ''),
      v_user_id,
      now()
    );
  exception
    when unique_violation then
      -- A concurrent request for the same external object is safe to reuse.
      select external_ref.gym_id
        into v_gym_id
        from public.gym_place_external_refs external_ref
       where external_ref.provider = v_provider
         and external_ref.external_id = v_external_id;

      if v_gym_id is not null then
        return v_gym_id;
      end if;

      -- A name/city collision without the same external reference is not
      -- enough evidence to merge two units. Preserve both histories and send
      -- the candidate to the future review/deduplication flow instead.
      raise exception using
        errcode = '23505',
        message = 'external_gym_requires_manual_review';
  end;

  return v_gym_id;
end;
$$;

revoke all on function private.register_external_gym(
  text, text, text, text, double precision, double precision,
  text, text, text, text
) from public, anon, authenticated;
grant execute on function private.register_external_gym(
  text, text, text, text, double precision, double precision,
  text, text, text, text
) to authenticated;

-- Exposed RPC remains SECURITY INVOKER. Its only privileged operation is
-- delegated to the narrowly granted helper in the non-exposed private schema.
create or replace function public.register_external_gym(
  p_provider text,
  p_external_id text,
  p_name text,
  p_city text,
  p_latitude double precision,
  p_longitude double precision,
  p_address text default null,
  p_state text default null,
  p_source_service text default null,
  p_provider_category text default null
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.register_external_gym(
    p_provider,
    p_external_id,
    p_name,
    p_city,
    p_latitude,
    p_longitude,
    p_address,
    p_state,
    p_source_service,
    p_provider_category
  );
$$;

revoke all on function public.register_external_gym(
  text, text, text, text, double precision, double precision,
  text, text, text, text
) from public, anon, authenticated;
grant execute on function public.register_external_gym(
  text, text, text, text, double precision, double precision,
  text, text, text, text
) to authenticated;

comment on function public.register_external_gym(
  text, text, text, text, double precision, double precision,
  text, text, text, text
) is
  'Atomically reuses a known provider/external ID or creates a gym plus minimal provenance. It never merges an ambiguous existing gym by distance or name alone.';
