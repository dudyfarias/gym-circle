-- Gym Circle profile recovery from trusted backup snapshot.
--
-- SAFETY:
-- - This script is a recovery plan and preview tool.
-- - Do not run against production until a trusted backup snapshot has been restored/exported.
-- - The UPDATE block is guarded and will fail unless the session variable below is explicitly set.
-- - It only fills currently empty/null fields with non-empty old values.
-- - It does not touch auth.users, posts, stories, follows, chat, username or display_name.
--
-- Required manual workflow:
-- 1. Restore/export a trusted pre-incident backup in a separate environment.
-- 2. Export the backup's public.profiles columns into private.profile_recovery_snapshot.
-- 3. Run the preview SELECTs in production.
-- 4. Review row counts and samples with the team.
-- 5. Only after manual approval, run the guarded UPDATE with:
--      set app.profile_recovery_approved = 'yes';

create schema if not exists private;

create table if not exists private.profile_recovery_snapshot (
  user_id uuid primary key,
  profile_id uuid,
  old_bio text,
  old_instagram_username text,
  old_birth_date date,
  old_sports text[] not null default '{}',
  old_preferred_training_times text[] not null default '{}',
  old_main_gym_id uuid,
  old_fitness_goal text,
  old_avatar_url text,
  snapshot_at timestamptz not null,
  imported_at timestamptz not null default now()
);

comment on table private.profile_recovery_snapshot is
  'Staging table for profile recovery from a trusted pre-incident backup. Fill manually, then preview before any update.';

-- Example import shape to run in the restored backup database, then export/import
-- the resulting CSV into private.profile_recovery_snapshot in production:
--
-- select
--   user_id,
--   id as profile_id,
--   bio as old_bio,
--   instagram_username as old_instagram_username,
--   birth_date as old_birth_date,
--   sports as old_sports,
--   preferred_training_times as old_preferred_training_times,
--   main_gym_id as old_main_gym_id,
--   fitness_goal as old_fitness_goal,
--   avatar_url as old_avatar_url,
--   '<SNAPSHOT_TIMESTAMP>'::timestamptz as snapshot_at
-- from public.profiles;

create or replace view private.profile_recovery_preview as
with candidates as (
  select
    p.user_id,
    p.id as current_profile_id,
    p.username::text as username,
    p.display_name,
    s.profile_id as snapshot_profile_id,
    s.snapshot_at,
    case
      when nullif(trim(coalesce(p.bio, '')), '') is null
       and nullif(trim(coalesce(s.old_bio, '')), '') is not null
      then s.old_bio
    end as restore_bio,
    case
      when nullif(trim(coalesce(p.instagram_username, '')), '') is null
       and nullif(trim(coalesce(s.old_instagram_username, '')), '') is not null
      then s.old_instagram_username
    end as restore_instagram_username,
    case
      when p.birth_date is null and s.old_birth_date is not null
      then s.old_birth_date
    end as restore_birth_date,
    case
      when coalesce(array_length(p.sports, 1), 0) = 0
       and coalesce(array_length(s.old_sports, 1), 0) > 0
      then s.old_sports
    end as restore_sports,
    case
      when coalesce(array_length(p.preferred_training_times, 1), 0) = 0
       and coalesce(array_length(s.old_preferred_training_times, 1), 0) > 0
      then s.old_preferred_training_times
    end as restore_preferred_training_times,
    case
      when p.main_gym_id is null and s.old_main_gym_id is not null
      then s.old_main_gym_id
    end as restore_main_gym_id,
    case
      when nullif(trim(coalesce(p.fitness_goal, '')), '') is null
       and nullif(trim(coalesce(s.old_fitness_goal, '')), '') is not null
      then s.old_fitness_goal
    end as restore_fitness_goal,
    case
      when p.avatar_url is null
       and nullif(trim(coalesce(s.old_avatar_url, '')), '') is not null
      then s.old_avatar_url
    end as restore_avatar_url
  from public.profiles p
  join private.profile_recovery_snapshot s on s.user_id = p.user_id
  where p.deleted_at is null
    and p.account_status = 'active'
)
select
  *,
  jsonb_strip_nulls(
    jsonb_build_object(
      'bio', restore_bio,
      'instagram_username', restore_instagram_username,
      'birth_date', restore_birth_date,
      'sports', restore_sports,
      'preferred_training_times', restore_preferred_training_times,
      'main_gym_id', restore_main_gym_id,
      'fitness_goal', restore_fitness_goal,
      'avatar_url', restore_avatar_url
    )
  ) as proposed_changes
from candidates
where restore_bio is not null
   or restore_instagram_username is not null
   or restore_birth_date is not null
   or restore_sports is not null
   or restore_preferred_training_times is not null
   or restore_main_gym_id is not null
   or restore_fitness_goal is not null
   or restore_avatar_url is not null;

create or replace view private.profile_recovery_field_preview as
select
  p.user_id,
  p.username,
  p.display_name,
  p.snapshot_at,
  field.field_name,
  field.current_value,
  field.snapshot_value,
  field.will_restore
from private.profile_recovery_preview p
cross join lateral (
  values
    (
      'bio',
      to_jsonb((select current_p.bio from public.profiles current_p where current_p.user_id = p.user_id)),
      to_jsonb(p.restore_bio),
      p.restore_bio is not null
    ),
    (
      'instagram_username',
      to_jsonb((select current_p.instagram_username from public.profiles current_p where current_p.user_id = p.user_id)),
      to_jsonb(p.restore_instagram_username),
      p.restore_instagram_username is not null
    ),
    (
      'birth_date',
      to_jsonb((select current_p.birth_date from public.profiles current_p where current_p.user_id = p.user_id)),
      to_jsonb(p.restore_birth_date),
      p.restore_birth_date is not null
    ),
    (
      'sports',
      to_jsonb((select current_p.sports from public.profiles current_p where current_p.user_id = p.user_id)),
      to_jsonb(p.restore_sports),
      p.restore_sports is not null
    ),
    (
      'preferred_training_times',
      to_jsonb((select current_p.preferred_training_times from public.profiles current_p where current_p.user_id = p.user_id)),
      to_jsonb(p.restore_preferred_training_times),
      p.restore_preferred_training_times is not null
    ),
    (
      'main_gym_id',
      to_jsonb((select current_p.main_gym_id from public.profiles current_p where current_p.user_id = p.user_id)),
      to_jsonb(p.restore_main_gym_id),
      p.restore_main_gym_id is not null
    ),
    (
      'fitness_goal',
      to_jsonb((select current_p.fitness_goal from public.profiles current_p where current_p.user_id = p.user_id)),
      to_jsonb(p.restore_fitness_goal),
      p.restore_fitness_goal is not null
    ),
    (
      'avatar_url',
      to_jsonb((select current_p.avatar_url from public.profiles current_p where current_p.user_id = p.user_id)),
      to_jsonb(p.restore_avatar_url),
      p.restore_avatar_url is not null
    )
) as field(field_name, current_value, snapshot_value, will_restore)
where field.will_restore;

-- PREVIEW 1: total impacted users and fields.
select
  count(*) as users_to_update,
  count(*) filter (where restore_bio is not null) as bio_to_restore,
  count(*) filter (where restore_instagram_username is not null) as instagram_to_restore,
  count(*) filter (where restore_birth_date is not null) as birth_date_to_restore,
  count(*) filter (where restore_sports is not null) as sports_to_restore,
  count(*) filter (where restore_preferred_training_times is not null) as preferred_times_to_restore,
  count(*) filter (where restore_main_gym_id is not null) as main_gym_to_restore,
  count(*) filter (where restore_fitness_goal is not null) as fitness_goal_to_restore,
  count(*) filter (where restore_avatar_url is not null) as avatar_url_to_restore,
  (
    count(*) filter (where restore_bio is not null)
    + count(*) filter (where restore_instagram_username is not null)
    + count(*) filter (where restore_birth_date is not null)
    + count(*) filter (where restore_sports is not null)
    + count(*) filter (where restore_preferred_training_times is not null)
    + count(*) filter (where restore_main_gym_id is not null)
    + count(*) filter (where restore_fitness_goal is not null)
    + count(*) filter (where restore_avatar_url is not null)
  ) as total_fields_to_restore
from private.profile_recovery_preview;

-- PREVIEW 2: field-level exact changes.
select
  user_id,
  username,
  display_name,
  field_name,
  current_value,
  snapshot_value,
  will_restore
from private.profile_recovery_field_preview
order by username, field_name
limit 200;

-- PREVIEW 3: sample users and exact proposed changes as JSON.
select
  user_id,
  username,
  display_name,
  snapshot_at,
  proposed_changes
from private.profile_recovery_preview
order by username
limit 20;

-- PREVIEW 4: profile ids that changed between current and snapshot.
-- This does not block recovery, but it should be reviewed before approval.
select
  user_id,
  username,
  current_profile_id,
  snapshot_profile_id,
  snapshot_at
from private.profile_recovery_preview
where snapshot_profile_id is not null
  and current_profile_id is distinct from snapshot_profile_id
order by username
limit 50;

-- GUARDED UPDATE.
-- To execute after approval:
--   begin;
--   set local app.profile_recovery_approved = 'yes';
--   <run the block below>
--   inspect returned rows / counts;
--   commit;
--
-- Leave the guard in place. Without the setting above, this block raises and changes nothing.
do $$
begin
  if current_setting('app.profile_recovery_approved', true) is distinct from 'yes' then
    raise exception 'Profile recovery update blocked. Run previews and set app.profile_recovery_approved = yes only after manual approval.';
  end if;
end $$;

create table if not exists private.profile_recovery_before_apply as
select p.*, now() as backed_up_at
from public.profiles p
join private.profile_recovery_preview r on r.user_id = p.user_id
where false;

insert into private.profile_recovery_before_apply
select p.*, now() as backed_up_at
from public.profiles p
join private.profile_recovery_preview r on r.user_id = p.user_id
where not exists (
  select 1
  from private.profile_recovery_before_apply b
  where b.user_id = p.user_id
);

update public.profiles p
set
  bio = case
    when nullif(trim(coalesce(p.bio, '')), '') is null then coalesce(r.restore_bio, p.bio)
    else p.bio
  end,
  instagram_username = case
    when nullif(trim(coalesce(p.instagram_username, '')), '') is null then coalesce(r.restore_instagram_username, p.instagram_username)
    else p.instagram_username
  end,
  birth_date = case
    when p.birth_date is null then coalesce(r.restore_birth_date, p.birth_date)
    else p.birth_date
  end,
  sports = case
    when coalesce(array_length(p.sports, 1), 0) = 0 then coalesce(r.restore_sports, p.sports)
    else p.sports
  end,
  preferred_training_times = case
    when coalesce(array_length(p.preferred_training_times, 1), 0) = 0 then coalesce(r.restore_preferred_training_times, p.preferred_training_times)
    else p.preferred_training_times
  end,
  main_gym_id = case
    when p.main_gym_id is null then coalesce(r.restore_main_gym_id, p.main_gym_id)
    else p.main_gym_id
  end,
  fitness_goal = case
    when nullif(trim(coalesce(p.fitness_goal, '')), '') is null then coalesce(r.restore_fitness_goal, p.fitness_goal)
    else p.fitness_goal
  end,
  avatar_url = case
    when p.avatar_url is null then coalesce(r.restore_avatar_url, p.avatar_url)
    else p.avatar_url
  end
from private.profile_recovery_preview r
where r.user_id = p.user_id
returning
  p.user_id,
  p.username,
  p.display_name;
