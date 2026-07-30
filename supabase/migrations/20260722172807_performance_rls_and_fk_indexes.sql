-- Performance hardening after the catalog and trainer foundations.
-- Timestamp reconciled with the migration already applied in production.
--
-- Keep the existing visibility semantics while evaluating auth.uid() once per
-- statement, and cover foreign keys reported by the Supabase advisor.

drop policy if exists post_activities_select_visible
  on public.post_activities;

create policy post_activities_select_visible
  on public.post_activities for select
  to authenticated
  using (
    (select auth.uid()) is not null
    and exists (
      select 1
      from public.posts post
      where post.id = post_activities.post_id
    )
  );

create index if not exists trainer_verification_requests_reviewed_by_idx
  on public.trainer_verification_requests (reviewed_by);

create index if not exists trainer_workspace_members_invited_by_idx
  on public.trainer_workspace_members (invited_by);

create index if not exists user_workout_exercise_preferences_exercise_idx
  on public.user_workout_exercise_preferences (exercise_id);

create index if not exists workout_equipment_catalog_parent_idx
  on public.workout_equipment_catalog (parent_equipment_id);

create index if not exists workout_equipment_catalog_reviewed_by_idx
  on public.workout_equipment_catalog (reviewed_by);

create index if not exists workout_exercise_equipment_compatibility_equipment_idx
  on public.workout_exercise_equipment_compatibility (equipment_id);

create index if not exists workout_exercise_relations_target_idx
  on public.workout_exercise_relations (target_exercise_id);
