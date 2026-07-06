-- O Supabase aplica default privileges explícitos em funções novas. Revogar
-- PUBLIC não remove uma ACL já concedida diretamente ao papel anon.
revoke all on function public.submit_workout_exercise(text, text, text)
  from anon;
revoke all on function public.submit_workout_technique(text, text)
  from anon;

grant execute on function public.submit_workout_exercise(text, text, text)
  to authenticated;
grant execute on function public.submit_workout_technique(text, text)
  to authenticated;
