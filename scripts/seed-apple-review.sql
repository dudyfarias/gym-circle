-- =====================================================================
-- Sprint 10.8 — Apple Review Demo Seed
--
-- Enriquece um user existente com:
--   - 6 posts variados (últimos 12 dias) em 4 gyms diferentes
--   - 3 stories ativas (expiram em 24h)
--   - 5 achievements unlocked
--   - user_stats: streak=5, workouts_this_month=10
--   - 2 follows mútuos (com johnny + dudy pra ter feed cheio)
--   - 1 monthly_recap_cover do post mais bonito
--
-- Idempotente: ON CONFLICT DO NOTHING em todos os inserts. Pode rodar
-- N vezes sem duplicar.
--
-- COMO USAR:
--   1. Substituir TODOS '<USER_ID_AQUI>' pelo user_id da conta demo
--      (ex: `select user_id from profiles where username='applereview';`).
--   2. Colar no SQL Editor do Supabase Dashboard e rodar.
--   3. Verificar via app: login com o user, abrir feed/perfil/recap.
-- =====================================================================

-- Variável: substituir pelo user_id real ANTES de rodar
\set applereview_user_id '''<USER_ID_AQUI>'''

-- Sanity check: aborta se o user não existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = :applereview_user_id::uuid) THEN
    RAISE EXCEPTION 'Profile não existe pro user_id %. Faça signup pelo app primeiro.', :applereview_user_id::uuid;
  END IF;
END $$;

-- ---------- (1) user_stats: streak + workouts ----------

INSERT INTO public.user_stats (
  user_id, current_streak, best_streak,
  workouts_this_week, workouts_this_month, active_days_this_year,
  badge_is_active_today, last_workout_date,
  streak_restores_available
) VALUES (
  :applereview_user_id::uuid, 5, 12, 3, 10, 32, TRUE, current_date, 3
) ON CONFLICT (user_id) DO UPDATE SET
  current_streak = GREATEST(public.user_stats.current_streak, EXCLUDED.current_streak),
  best_streak = GREATEST(public.user_stats.best_streak, EXCLUDED.best_streak),
  workouts_this_week = GREATEST(public.user_stats.workouts_this_week, EXCLUDED.workouts_this_week),
  workouts_this_month = GREATEST(public.user_stats.workouts_this_month, EXCLUDED.workouts_this_month),
  active_days_this_year = GREATEST(public.user_stats.active_days_this_year, EXCLUDED.active_days_this_year),
  badge_is_active_today = TRUE,
  last_workout_date = current_date,
  streak_restores_available = GREATEST(public.user_stats.streak_restores_available, 3);

-- ---------- (2) Profile bio update ----------

UPDATE public.profiles SET
  display_name = COALESCE(NULLIF(display_name, ''), 'Apple Review'),
  bio = COALESCE(NULLIF(bio, ''), 'Conta de demonstração da App Store Review.'),
  fitness_goal = COALESCE(NULLIF(fitness_goal, ''), 'Manter o streak e treinar com consistência.'),
  sports = COALESCE(NULLIF(sports, '{}'), ARRAY['Musculação','Crossfit','Corrida']),
  preferred_training_times = COALESCE(NULLIF(preferred_training_times, '{}'), ARRAY['morning','evening'])
WHERE user_id = :applereview_user_id::uuid;

-- ---------- (3) 6 posts em 4 gyms (últimos 12 dias) ----------

INSERT INTO public.posts (
  id, user_id, gym_id, workout_type, workout_date,
  image_url, caption,
  created_at, workout_date_tz
) VALUES
  (gen_random_uuid(), :applereview_user_id::uuid, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'Musculação', current_date,
   'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=1080',
   'Push day. Banco inclinado + supino + tríceps. Foco no contraction.',
   now(), current_date),
  (gen_random_uuid(), :applereview_user_id::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
   'Crossfit', current_date - 1,
   'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1080',
   'Wendler 5/3/1 + WOD. Quebrei meu PR no clean.',
   now() - interval '1 day', current_date - 1),
  (gen_random_uuid(), :applereview_user_id::uuid, 'aaaaaaaa-0000-0000-0000-000000000004'::uuid,
   'Musculação', current_date - 2,
   'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=1080',
   'Leg day brutal. Agachamento + leg press + stiff. Mal consigo descer escada.',
   now() - interval '2 days', current_date - 2),
  (gen_random_uuid(), :applereview_user_id::uuid, 'aaaaaaaa-0000-0000-0000-000000000003'::uuid,
   'Yoga', current_date - 5,
   'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=1080',
   'Restorative yoga depois de uma semana intensa. Mobilidade > tudo.',
   now() - interval '5 days', current_date - 5),
  (gen_random_uuid(), :applereview_user_id::uuid, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'Corrida', current_date - 7,
   'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1080',
   '10 km no parque. Tempo melhor do mês: 48 min. O streak não para.',
   now() - interval '7 days', current_date - 7),
  (gen_random_uuid(), :applereview_user_id::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
   'Musculação', current_date - 10,
   'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?w=1080',
   'Pull day. Costas + bíceps. Barra fixa pesada hoje.',
   now() - interval '10 days', current_date - 10)
ON CONFLICT DO NOTHING;

-- ---------- (4) 3 stories ativas ----------

INSERT INTO public.stories (
  id, user_id, gym_id, workout_type, media_url, expires_at
) VALUES
  (gen_random_uuid(), :applereview_user_id::uuid, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
   'Musculação', 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1080',
   now() + interval '20 hours'),
  (gen_random_uuid(), :applereview_user_id::uuid, 'aaaaaaaa-0000-0000-0000-000000000002'::uuid,
   'Crossfit', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1080',
   now() + interval '15 hours'),
  (gen_random_uuid(), :applereview_user_id::uuid, NULL,
   NULL, 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=1080',
   now() + interval '10 hours')
ON CONFLICT DO NOTHING;

-- ---------- (5) 5 achievements unlocked ----------

INSERT INTO public.user_achievements (
  user_id, achievement_id, earned_at, last_earned_at, count, celebrated_at
) VALUES
  (:applereview_user_id::uuid, 'badge:first-post',          now() - interval '12 days', now() - interval '12 days', 1, now() - interval '12 days'),
  (:applereview_user_id::uuid, 'badge:streak-7',            now() - interval '5 days',  now() - interval '5 days',  1, now() - interval '5 days'),
  (:applereview_user_id::uuid, 'medal:consistent-month',    now() - interval '3 days',  now() - interval '3 days',  1, now() - interval '3 days'),
  (:applereview_user_id::uuid, 'trophy:5-types',            now() - interval '7 days',  now() - interval '7 days',  1, now() - interval '7 days'),
  (:applereview_user_id::uuid, 'badge:morning-bird',        now() - interval '2 days',  now() - interval '2 days',  1, now() - interval '2 days')
ON CONFLICT (user_id, achievement_id) DO UPDATE SET
  celebrated_at = COALESCE(public.user_achievements.celebrated_at, EXCLUDED.celebrated_at);

-- ---------- (6) Featured achievements no profile ----------

UPDATE public.profiles SET
  featured_achievements = ARRAY['medal:consistent-month','trophy:5-types','badge:streak-7']
WHERE user_id = :applereview_user_id::uuid;

-- ---------- (7) Follows com johnny + dudy pra ter feed cheio ----------

INSERT INTO public.follows (follower_id, following_id, status, created_at)
VALUES
  (:applereview_user_id::uuid, '833f628e-c4e1-415d-ac8b-5f63e006a7f8'::uuid, 'accepted', now() - interval '8 days'),
  (:applereview_user_id::uuid, '08ff7442-709c-4086-8da8-1cb4c9a258cd'::uuid, 'accepted', now() - interval '8 days'),
  ('833f628e-c4e1-415d-ac8b-5f63e006a7f8'::uuid, :applereview_user_id::uuid, 'accepted', now() - interval '8 days'),
  ('08ff7442-709c-4086-8da8-1cb4c9a258cd'::uuid, :applereview_user_id::uuid, 'accepted', now() - interval '8 days')
ON CONFLICT (follower_id, following_id) DO UPDATE SET status = 'accepted';

-- ---------- (8) Monthly recap cover do mês corrente ----------

UPDATE public.profiles SET
  monthly_recap_covers = COALESCE(monthly_recap_covers, '{}'::jsonb) ||
    jsonb_build_object(
      to_char(current_date, 'YYYY-MM'),
      (SELECT id::text FROM public.posts WHERE user_id = :applereview_user_id::uuid ORDER BY created_at DESC LIMIT 1)
    )
WHERE user_id = :applereview_user_id::uuid;

-- ---------- (9) Aceite legal pra evitar gates de onboarding ----------

UPDATE public.profiles SET
  alpha_terms_accepted_at = COALESCE(alpha_terms_accepted_at, now() - interval '12 days'),
  privacy_policy_accepted_at = COALESCE(privacy_policy_accepted_at, now() - interval '12 days')
WHERE user_id = :applereview_user_id::uuid;

-- ---------- Output: confirmação ----------

SELECT
  username, display_name,
  (SELECT count(*) FROM posts WHERE user_id = p.user_id) AS posts,
  (SELECT count(*) FROM stories WHERE user_id = p.user_id AND expires_at > now()) AS stories_active,
  (SELECT count(*) FROM user_achievements WHERE user_id = p.user_id) AS achievements,
  (SELECT count(*) FROM follows WHERE follower_id = p.user_id AND status = 'accepted') AS following,
  (SELECT current_streak FROM user_stats WHERE user_id = p.user_id) AS streak
FROM public.profiles p
WHERE user_id = :applereview_user_id::uuid;
