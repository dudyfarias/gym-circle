-- Security hardening: this function is administrative and SECURITY DEFINER.
-- It should not be directly executable by browser-authenticated users.
revoke execute on function public.backfill_user_achievements_server_side()
from anon, authenticated;

grant execute on function public.backfill_user_achievements_server_side()
to service_role;
