-- =====================================================================
-- Gym Circle — Seeds de desenvolvimento
-- ---------------------------------------------------------------------
-- Cria 8 usuários fake, 4 academias, posts históricos, stories, follows,
-- curtidas, comentários e check-ins. Os triggers da migration cuidam
-- de user_activity_days e user_stats automaticamente.
--
-- Senha de todos os usuários: "gymcircle"
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. auth.users (idempotente)
-- ---------------------------------------------------------------------
-- UUIDs determinísticos para podermos referenciar.
-- O trigger on_auth_user_created cria profiles+user_stats automaticamente.
-- Usamos crypt() com bcrypt (Supabase configura pgcrypto no schema extensions).

with payload (id, email, username, display_name) as (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'edu@gymcircle.test',  'edu_fit',       'Eduardo'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'maya@gymcircle.test', 'maya_move',     'Maya Lima'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'rafa@gymcircle.test', 'rafa_strength', 'Rafa Costa'),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'bia@gymcircle.test',  'bia_run',       'Bia Nunes'),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'leo@gymcircle.test',  'leo_daily',     'Leo Martins'),
    ('66666666-6666-6666-6666-666666666666'::uuid, 'ana@gymcircle.test',  'ana_core',      'Ana Torres'),
    ('77777777-7777-7777-7777-777777777777'::uuid, 'caio@gymcircle.test', 'caio_lift',     'Caio Freire'),
    ('88888888-8888-8888-8888-888888888888'::uuid, 'nina@gymcircle.test', 'nina_fitclub',  'Nina Alves')
)
insert into auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  p.id, 'authenticated', 'authenticated', p.email,
  extensions.crypt('gymcircle', extensions.gen_salt('bf')),
  now(),
  jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
  jsonb_build_object('username', p.username, 'display_name', p.display_name),
  now(), now(), '', '', '', ''
from payload p
on conflict (id) do nothing;

-- Identidades (necessárias para login por email)
insert into auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(), now(), now()
from auth.users u
where u.email like '%@gymcircle.test'
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 2. profiles (o trigger handle_new_user já cria com username derivado;
--    aqui apenas enriquecemos bio/goal e fixamos o username canônico)
-- ---------------------------------------------------------------------
update public.profiles set
  username = 'edu_fit',
  display_name = 'Eduardo',
  bio = 'Lifestyle fitness, consistência e treino cedo.',
  fitness_goal = 'Consistência'
where user_id = '11111111-1111-1111-1111-111111111111';

update public.profiles set
  username = 'maya_move',
  display_name = 'Maya Lima',
  bio = 'Treino inteligente, corrida e mobilidade.',
  fitness_goal = 'Performance leve'
where user_id = '22222222-2222-2222-2222-222222222222';

update public.profiles set
  username = 'rafa_strength',
  display_name = 'Rafa Costa',
  bio = 'Força, hipertrofia e café antes das 7.',
  fitness_goal = 'Hipertrofia'
where user_id = '33333333-3333-3333-3333-333333333333';

update public.profiles set
  username = 'bia_run',
  display_name = 'Bia Nunes',
  bio = 'Corrida, funcional e domingo ativo.',
  fitness_goal = 'Corrida 10K'
where user_id = '44444444-4444-4444-4444-444444444444';

update public.profiles set
  username = 'leo_daily',
  display_name = 'Leo Martins',
  bio = 'Um treino por dia, sem drama.',
  fitness_goal = 'Consistência'
where user_id = '55555555-5555-5555-5555-555555555555';

update public.profiles set
  username = 'ana_core',
  display_name = 'Ana Torres',
  bio = 'Pilates, força e rotina limpa.',
  fitness_goal = 'Definição'
where user_id = '66666666-6666-6666-6666-666666666666';

update public.profiles set
  username = 'caio_lift',
  display_name = 'Caio Freire',
  bio = 'Leg day sem desculpa.',
  fitness_goal = 'Força'
where user_id = '77777777-7777-7777-7777-777777777777';

update public.profiles set
  username = 'nina_fitclub',
  display_name = 'Nina Alves',
  bio = 'Treino, comunidade e check-ins.',
  fitness_goal = 'Lifestyle'
where user_id = '88888888-8888-8888-8888-888888888888';

-- ---------------------------------------------------------------------
-- 3. gyms
-- ---------------------------------------------------------------------
insert into public.gyms (id, name, address, city, state, latitude, longitude) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Pulse Club Recife', 'Av. Domingos Ferreira, 1234',  'Recife',     'PE', -8.0922, -34.8807),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Wellness Lab',      'R. da Aurora, 555',            'Recife',     'PE', -8.0588, -34.8827),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Studio Flow',       'Av. Conselheiro Aguiar, 4500', 'Recife',     'PE', -8.1190, -34.8956),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Iron House',        'R. dos Navegantes, 2100',      'Recife',     'PE', -8.0760, -34.8770)
on conflict (id) do nothing;

-- main_gym_id nos perfis
update public.profiles set main_gym_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  where user_id in ('11111111-1111-1111-1111-111111111111',
                    '33333333-3333-3333-3333-333333333333',
                    '55555555-5555-5555-5555-555555555555');
update public.profiles set main_gym_id = 'aaaaaaaa-0000-0000-0000-000000000002'
  where user_id in ('22222222-2222-2222-2222-222222222222',
                    '66666666-6666-6666-6666-666666666666');
update public.profiles set main_gym_id = 'aaaaaaaa-0000-0000-0000-000000000003'
  where user_id in ('44444444-4444-4444-4444-444444444444',
                    '88888888-8888-8888-8888-888888888888');
update public.profiles set main_gym_id = 'aaaaaaaa-0000-0000-0000-000000000004'
  where user_id = '77777777-7777-7777-7777-777777777777';

-- ---------------------------------------------------------------------
-- 4. user_gyms
-- ---------------------------------------------------------------------
insert into public.user_gyms (user_id, gym_id, is_main, preferred_times) values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001', true,  array['manha','noite']),
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000002', false, array['noite']),
  ('22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000002', true,  array['noite']),
  ('22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000001', false, array['noite']),
  ('33333333-3333-3333-3333-333333333333','aaaaaaaa-0000-0000-0000-000000000001', true,  array['manha']),
  ('44444444-4444-4444-4444-444444444444','aaaaaaaa-0000-0000-0000-000000000003', true,  array['tarde']),
  ('44444444-4444-4444-4444-444444444444','aaaaaaaa-0000-0000-0000-000000000001', false, array['tarde']),
  ('55555555-5555-5555-5555-555555555555','aaaaaaaa-0000-0000-0000-000000000001', true,  array['noite']),
  ('66666666-6666-6666-6666-666666666666','aaaaaaaa-0000-0000-0000-000000000002', true,  array['manha']),
  ('77777777-7777-7777-7777-777777777777','aaaaaaaa-0000-0000-0000-000000000004', true,  array['noite']),
  ('88888888-8888-8888-8888-888888888888','aaaaaaaa-0000-0000-0000-000000000003', true,  array['tarde','noite'])
on conflict (user_id, gym_id) do nothing;

-- ---------------------------------------------------------------------
-- 5. posts (com workout_date histórico — alimenta streaks)
-- ---------------------------------------------------------------------
-- Eduardo (user 1) tem streak grande: 5 dias consecutivos terminando ontem.
insert into public.posts (id, user_id, image_url, caption, gym_id, workout_type, workout_date, created_at) values
  ('cccccccc-0001-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
   'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=86',
   'Treino cedo, mente limpa. Peito, ombro e tríceps fechados.',
   'aaaaaaaa-0000-0000-0000-000000000001','Push day',
   (current_date - interval '1 day')::date, now() - interval '1 day'),
  ('cccccccc-0001-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',
   'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=900&q=86',
   'Pull day pesado.',
   'aaaaaaaa-0000-0000-0000-000000000001','Pull day',
   (current_date - interval '2 days')::date, now() - interval '2 days'),
  ('cccccccc-0001-0000-0000-000000000003','11111111-1111-1111-1111-111111111111',
   'https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=900&q=86',
   'Cardio leve, recuperação ativa.',
   'aaaaaaaa-0000-0000-0000-000000000002','Cardio',
   (current_date - interval '3 days')::date, now() - interval '3 days'),
  ('cccccccc-0001-0000-0000-000000000004','11111111-1111-1111-1111-111111111111',
   'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=86',
   'Full body completo.',
   'aaaaaaaa-0000-0000-0000-000000000001','Full body',
   (current_date - interval '4 days')::date, now() - interval '4 days'),
  ('cccccccc-0001-0000-0000-000000000005','11111111-1111-1111-1111-111111111111',
   'https://images.unsplash.com/photo-1605296867304-46d5465a13f1?auto=format&fit=crop&w=900&q=86',
   'Leg day. Foi tenso.',
   'aaaaaaaa-0000-0000-0000-000000000001','Leg day',
   (current_date - interval '5 days')::date, now() - interval '5 days'),
  -- Maya (badge aceso hoje)
  ('cccccccc-0002-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',
   'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=86',
   'Hoje foi sem pressa, mas foi.',
   'aaaaaaaa-0000-0000-0000-000000000002','Full body',
   current_date, now() - interval '2 hours'),
  -- Leo (lendário, badge aceso hoje, 30+ dias)
  ('cccccccc-0005-0000-0000-000000000001','55555555-5555-5555-5555-555555555555',
   'https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=900&q=86',
   'Cardio leve para manter a sequência lendária viva.',
   'aaaaaaaa-0000-0000-0000-000000000001','Cardio',
   current_date, now() - interval '4 hours'),
  -- Rafa (9 dias)
  ('cccccccc-0003-0000-0000-000000000001','33333333-3333-3333-3333-333333333333',
   'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=900&q=86',
   'Peito e ombro. Carga subindo devagar, técnica primeiro.',
   'aaaaaaaa-0000-0000-0000-000000000001','Força',
   current_date, now() - interval '3 hours'),
  -- Bia (5 dias)
  ('cccccccc-0004-0000-0000-000000000001','44444444-4444-4444-4444-444444444444',
   'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=900&q=86',
   '5K fácil antes do trabalho.',
   'aaaaaaaa-0000-0000-0000-000000000003','Corrida',
   current_date, now() - interval '7 hours'),
  -- Ana (4 dias, postou ontem)
  ('cccccccc-0006-0000-0000-000000000001','66666666-6666-6666-6666-666666666666',
   'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=900&q=86',
   'Core e mobilidade.',
   'aaaaaaaa-0000-0000-0000-000000000002','Core',
   (current_date - interval '1 day')::date, now() - interval '1 day')
on conflict (id) do nothing;

-- Gerar histórico extra para Leo (32 dias consecutivos)
insert into public.posts (user_id, image_url, caption, gym_id, workout_type, workout_date, created_at)
select
  '55555555-5555-5555-5555-555555555555',
  'https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=900&q=86',
  'Treino do dia.',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Cardio',
  d::date,
  d::timestamptz
from generate_series(current_date - interval '31 days', current_date - interval '1 day', interval '1 day') as d
where not exists (
  select 1 from public.posts p
   where p.user_id = '55555555-5555-5555-5555-555555555555'
     and p.workout_date = d::date
);

-- Histórico para Rafa (8 dias antes de hoje + hoje = 9)
insert into public.posts (user_id, image_url, caption, gym_id, workout_type, workout_date, created_at)
select
  '33333333-3333-3333-3333-333333333333',
  'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=900&q=86',
  'Push regular.',
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Força',
  d::date,
  d::timestamptz
from generate_series(current_date - interval '8 days', current_date - interval '1 day', interval '1 day') as d
where not exists (
  select 1 from public.posts p
   where p.user_id = '33333333-3333-3333-3333-333333333333'
     and p.workout_date = d::date
);

-- ---------------------------------------------------------------------
-- 6. stories
-- ---------------------------------------------------------------------
insert into public.stories (id, user_id, media_url, gym_id, workout_type, expires_at, created_at) values
  ('dddddddd-0001-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
   'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=86',
   'aaaaaaaa-0000-0000-0000-000000000001','Push day',
   now() + interval '24 hours', now() - interval '1 hour'),
  ('dddddddd-0002-0000-0000-000000000001','22222222-2222-2222-2222-222222222222',
   'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=86',
   'aaaaaaaa-0000-0000-0000-000000000002','Full body',
   now() + interval '24 hours', now() - interval '90 minutes'),
  ('dddddddd-0003-0000-0000-000000000001','33333333-3333-3333-3333-333333333333',
   'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=900&q=86',
   'aaaaaaaa-0000-0000-0000-000000000001','Força',
   now() + interval '24 hours', now() - interval '2 hours'),
  ('dddddddd-0005-0000-0000-000000000001','55555555-5555-5555-5555-555555555555',
   'https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=900&q=86',
   'aaaaaaaa-0000-0000-0000-000000000001','Cardio',
   now() + interval '24 hours', now() - interval '4 hours'),
  ('dddddddd-0004-0000-0000-000000000001','44444444-4444-4444-4444-444444444444',
   'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=900&q=86',
   'aaaaaaaa-0000-0000-0000-000000000003','Corrida',
   now() + interval '24 hours', now() - interval '5 hours')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 7. follows
-- ---------------------------------------------------------------------
insert into public.follows (follower_id, following_id) values
  ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'),
  ('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333'),
  ('11111111-1111-1111-1111-111111111111','55555555-5555-5555-5555-555555555555'),
  ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111'),
  ('44444444-4444-4444-4444-444444444444','55555555-5555-5555-5555-555555555555'),
  ('55555555-5555-5555-5555-555555555555','11111111-1111-1111-1111-111111111111'),
  ('66666666-6666-6666-6666-666666666666','22222222-2222-2222-2222-222222222222'),
  ('77777777-7777-7777-7777-777777777777','33333333-3333-3333-3333-333333333333'),
  ('88888888-8888-8888-8888-888888888888','44444444-4444-4444-4444-444444444444')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 8. likes
-- ---------------------------------------------------------------------
insert into public.post_likes (post_id, user_id) values
  ('cccccccc-0001-0000-0000-000000000001','22222222-2222-2222-2222-222222222222'),
  ('cccccccc-0001-0000-0000-000000000001','33333333-3333-3333-3333-333333333333'),
  ('cccccccc-0001-0000-0000-000000000001','55555555-5555-5555-5555-555555555555'),
  ('cccccccc-0002-0000-0000-000000000001','11111111-1111-1111-1111-111111111111'),
  ('cccccccc-0002-0000-0000-000000000001','33333333-3333-3333-3333-333333333333'),
  ('cccccccc-0005-0000-0000-000000000001','11111111-1111-1111-1111-111111111111'),
  ('cccccccc-0005-0000-0000-000000000001','22222222-2222-2222-2222-222222222222'),
  ('cccccccc-0005-0000-0000-000000000001','44444444-4444-4444-4444-444444444444'),
  ('cccccccc-0003-0000-0000-000000000001','11111111-1111-1111-1111-111111111111')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 9. comments
-- ---------------------------------------------------------------------
insert into public.post_comments (post_id, user_id, body) values
  ('cccccccc-0001-0000-0000-000000000001','33333333-3333-3333-3333-333333333333','Push day nesse horário é outro nível.'),
  ('cccccccc-0001-0000-0000-000000000001','22222222-2222-2222-2222-222222222222','Streak bonito demais.'),
  ('cccccccc-0002-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Foi mesmo. Consistência absurda.'),
  ('cccccccc-0005-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Lenda andante.')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 10. checkins (hoje)
-- ---------------------------------------------------------------------
insert into public.checkins (user_id, gym_id, checkin_date) values
  ('22222222-2222-2222-2222-222222222222','aaaaaaaa-0000-0000-0000-000000000002', current_date),
  ('33333333-3333-3333-3333-333333333333','aaaaaaaa-0000-0000-0000-000000000001', current_date),
  ('55555555-5555-5555-5555-555555555555','aaaaaaaa-0000-0000-0000-000000000001', current_date),
  ('44444444-4444-4444-4444-444444444444','aaaaaaaa-0000-0000-0000-000000000003', current_date),
  ('66666666-6666-6666-6666-666666666666','aaaaaaaa-0000-0000-0000-000000000002', current_date)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 11. Forçar recálculo dos stats para todos os usuários (defensivo)
-- ---------------------------------------------------------------------
do $$
declare u uuid;
begin
  for u in select id from auth.users where email like '%@gymcircle.test' loop
    perform private.recalculate_user_stats(u);
  end loop;
end$$;
