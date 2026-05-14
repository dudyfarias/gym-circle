-- =====================================================================
-- Gym Circle — limpeza segura das academias atuais
-- =====================================================================
-- Uso recomendado no SQL editor do Supabase.
--
-- 1. Rode como está para ver as contagens e simular a limpeza.
-- 2. Revise os números retornados.
-- 3. Se estiver tudo certo, troque o ROLLBACK final por COMMIT.
--
-- Estratégia:
-- - profiles.main_gym_id -> null
-- - posts.gym_id/stories.gym_id -> null para preservar histórico
-- - user_gyms e checkins são removidos
-- - gyms são removidas

begin;

select
  (select count(*) from public.gyms) as gyms_count,
  (select count(*) from public.user_gyms) as user_gyms_count,
  (select count(distinct user_id) from public.user_gyms) as linked_users_count,
  (select count(*) from public.profiles where main_gym_id is not null) as profiles_with_main_gym_count,
  (select count(*) from public.posts where gym_id is not null) as posts_with_gym_count,
  (select count(*) from public.stories where gym_id is not null) as stories_with_gym_count,
  (select count(*) from public.checkins) as checkins_count;

update public.profiles
   set main_gym_id = null
 where main_gym_id is not null;

update public.posts
   set gym_id = null,
       location_source = case when location_source = 'gym' then 'none' else location_source end
 where gym_id is not null;

update public.stories
   set gym_id = null
 where gym_id is not null;

delete from public.user_gyms;
delete from public.checkins;
delete from public.gyms;

select
  (select count(*) from public.gyms) as gyms_after,
  (select count(*) from public.user_gyms) as user_gyms_after,
  (select count(*) from public.checkins) as checkins_after,
  (select count(*) from public.profiles where main_gym_id is not null) as profiles_with_main_gym_after,
  (select count(*) from public.posts where gym_id is not null) as posts_with_gym_after,
  (select count(*) from public.stories where gym_id is not null) as stories_with_gym_after;

rollback;
