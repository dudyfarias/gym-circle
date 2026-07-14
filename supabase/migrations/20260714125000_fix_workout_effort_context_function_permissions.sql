-- The activities constraints run as the authenticated caller. These validators
-- are private and pure, but authenticated lost EXECUTE in 20260713134716,
-- blocking finalize_workout_activity before the activity insert completes.

revoke execute on function private.workout_exercise_context_is_valid(jsonb)
  from public, anon;
revoke execute on function private.activity_strength_set_effort_is_valid(jsonb)
  from public, anon;

grant execute on function private.workout_exercise_context_is_valid(jsonb)
  to authenticated, service_role;
grant execute on function private.activity_strength_set_effort_is_valid(jsonb)
  to authenticated, service_role;
