-- activities_normalize_strength_sets runs as the inserting role. The helper
-- functions are private and pure, but their EXECUTE privilege was revoked from
-- authenticated in 20260713134715, causing every workout finalization to fail
-- with 403 before the activity could be inserted.

revoke execute on function private.normalize_activity_strength_sets(jsonb, boolean)
  from public, anon;
revoke execute on function private.activity_strength_set_is_valid(jsonb)
  from public, anon;
revoke execute on function private.activity_strength_sets_are_valid(jsonb)
  from public, anon;

grant execute on function private.normalize_activity_strength_sets(jsonb, boolean)
  to authenticated, service_role;
grant execute on function private.activity_strength_set_is_valid(jsonb)
  to authenticated, service_role;
grant execute on function private.activity_strength_sets_are_valid(jsonb)
  to authenticated, service_role;
