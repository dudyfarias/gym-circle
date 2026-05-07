-- =====================================================================
-- Gym Circle — Remove usuários fake do seed
-- ---------------------------------------------------------------------
-- Produção/beta não deve carregar os perfis de demonstração criados em
-- supabase/seed.sql. A remoção é restrita aos UUIDs e emails determinísticos
-- do seed para não atingir usuários reais.
--
-- A ordem importa: posts/stories têm triggers que recalculam user_stats.
-- Por isso, removemos conteúdo social enquanto auth.users ainda existe e
-- só depois removemos profiles/stats/auth.
-- =====================================================================

with fake_users (id, email) as (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'edu@gymcircle.test'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'maya@gymcircle.test'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'rafa@gymcircle.test'),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'bia@gymcircle.test'),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'leo@gymcircle.test'),
    ('66666666-6666-6666-6666-666666666666'::uuid, 'ana@gymcircle.test'),
    ('77777777-7777-7777-7777-777777777777'::uuid, 'caio@gymcircle.test'),
    ('88888888-8888-8888-8888-888888888888'::uuid, 'nina@gymcircle.test')
)
delete from public.notifications n
using fake_users f
where n.user_id = f.id
   or n.actor_id = f.id;

with fake_users (id, email) as (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'edu@gymcircle.test'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'maya@gymcircle.test'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'rafa@gymcircle.test'),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'bia@gymcircle.test'),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'leo@gymcircle.test'),
    ('66666666-6666-6666-6666-666666666666'::uuid, 'ana@gymcircle.test'),
    ('77777777-7777-7777-7777-777777777777'::uuid, 'caio@gymcircle.test'),
    ('88888888-8888-8888-8888-888888888888'::uuid, 'nina@gymcircle.test')
)
delete from public.post_likes pl
using fake_users f
where pl.user_id = f.id
   or exists (
    select 1 from public.posts p where p.id = pl.post_id and p.user_id = f.id
   );

with fake_users (id, email) as (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'edu@gymcircle.test'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'maya@gymcircle.test'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'rafa@gymcircle.test'),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'bia@gymcircle.test'),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'leo@gymcircle.test'),
    ('66666666-6666-6666-6666-666666666666'::uuid, 'ana@gymcircle.test'),
    ('77777777-7777-7777-7777-777777777777'::uuid, 'caio@gymcircle.test'),
    ('88888888-8888-8888-8888-888888888888'::uuid, 'nina@gymcircle.test')
)
delete from public.post_comments pc
using fake_users f
where pc.user_id = f.id
   or exists (
    select 1 from public.posts p where p.id = pc.post_id and p.user_id = f.id
   );

with fake_users (id, email) as (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'edu@gymcircle.test'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'maya@gymcircle.test'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'rafa@gymcircle.test'),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'bia@gymcircle.test'),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'leo@gymcircle.test'),
    ('66666666-6666-6666-6666-666666666666'::uuid, 'ana@gymcircle.test'),
    ('77777777-7777-7777-7777-777777777777'::uuid, 'caio@gymcircle.test'),
    ('88888888-8888-8888-8888-888888888888'::uuid, 'nina@gymcircle.test')
)
delete from public.follows f
using fake_users u
where f.follower_id = u.id
   or f.following_id = u.id;

with fake_users (id, email) as (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'edu@gymcircle.test'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'maya@gymcircle.test'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'rafa@gymcircle.test'),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'bia@gymcircle.test'),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'leo@gymcircle.test'),
    ('66666666-6666-6666-6666-666666666666'::uuid, 'ana@gymcircle.test'),
    ('77777777-7777-7777-7777-777777777777'::uuid, 'caio@gymcircle.test'),
    ('88888888-8888-8888-8888-888888888888'::uuid, 'nina@gymcircle.test')
)
delete from public.checkins c
using fake_users f
where c.user_id = f.id;

with fake_users (id, email) as (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'edu@gymcircle.test'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'maya@gymcircle.test'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'rafa@gymcircle.test'),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'bia@gymcircle.test'),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'leo@gymcircle.test'),
    ('66666666-6666-6666-6666-666666666666'::uuid, 'ana@gymcircle.test'),
    ('77777777-7777-7777-7777-777777777777'::uuid, 'caio@gymcircle.test'),
    ('88888888-8888-8888-8888-888888888888'::uuid, 'nina@gymcircle.test')
)
delete from public.stories s
using fake_users f
where s.user_id = f.id;

with fake_users (id, email) as (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'edu@gymcircle.test'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'maya@gymcircle.test'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'rafa@gymcircle.test'),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'bia@gymcircle.test'),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'leo@gymcircle.test'),
    ('66666666-6666-6666-6666-666666666666'::uuid, 'ana@gymcircle.test'),
    ('77777777-7777-7777-7777-777777777777'::uuid, 'caio@gymcircle.test'),
    ('88888888-8888-8888-8888-888888888888'::uuid, 'nina@gymcircle.test')
)
delete from public.posts p
using fake_users f
where p.user_id = f.id;

with fake_users (id, email) as (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'edu@gymcircle.test'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'maya@gymcircle.test'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'rafa@gymcircle.test'),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'bia@gymcircle.test'),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'leo@gymcircle.test'),
    ('66666666-6666-6666-6666-666666666666'::uuid, 'ana@gymcircle.test'),
    ('77777777-7777-7777-7777-777777777777'::uuid, 'caio@gymcircle.test'),
    ('88888888-8888-8888-8888-888888888888'::uuid, 'nina@gymcircle.test')
)
delete from public.user_activity_days uad
using fake_users f
where uad.user_id = f.id;

with fake_users (id, email) as (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'edu@gymcircle.test'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'maya@gymcircle.test'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'rafa@gymcircle.test'),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'bia@gymcircle.test'),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'leo@gymcircle.test'),
    ('66666666-6666-6666-6666-666666666666'::uuid, 'ana@gymcircle.test'),
    ('77777777-7777-7777-7777-777777777777'::uuid, 'caio@gymcircle.test'),
    ('88888888-8888-8888-8888-888888888888'::uuid, 'nina@gymcircle.test')
)
delete from public.user_gyms ug
using fake_users f
where ug.user_id = f.id;

with fake_users (id, email) as (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'edu@gymcircle.test'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'maya@gymcircle.test'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'rafa@gymcircle.test'),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'bia@gymcircle.test'),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'leo@gymcircle.test'),
    ('66666666-6666-6666-6666-666666666666'::uuid, 'ana@gymcircle.test'),
    ('77777777-7777-7777-7777-777777777777'::uuid, 'caio@gymcircle.test'),
    ('88888888-8888-8888-8888-888888888888'::uuid, 'nina@gymcircle.test')
)
delete from public.user_stats us
using fake_users f
where us.user_id = f.id;

with fake_users (id, email) as (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'edu@gymcircle.test'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'maya@gymcircle.test'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'rafa@gymcircle.test'),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'bia@gymcircle.test'),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'leo@gymcircle.test'),
    ('66666666-6666-6666-6666-666666666666'::uuid, 'ana@gymcircle.test'),
    ('77777777-7777-7777-7777-777777777777'::uuid, 'caio@gymcircle.test'),
    ('88888888-8888-8888-8888-888888888888'::uuid, 'nina@gymcircle.test')
)
delete from public.profiles p
using fake_users f
where p.user_id = f.id;

with fake_users (id, email) as (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'edu@gymcircle.test'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'maya@gymcircle.test'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'rafa@gymcircle.test'),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'bia@gymcircle.test'),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'leo@gymcircle.test'),
    ('66666666-6666-6666-6666-666666666666'::uuid, 'ana@gymcircle.test'),
    ('77777777-7777-7777-7777-777777777777'::uuid, 'caio@gymcircle.test'),
    ('88888888-8888-8888-8888-888888888888'::uuid, 'nina@gymcircle.test')
)
delete from auth.identities i
using fake_users f
where i.user_id = f.id;

with fake_users (id, email) as (
  values
    ('11111111-1111-1111-1111-111111111111'::uuid, 'edu@gymcircle.test'),
    ('22222222-2222-2222-2222-222222222222'::uuid, 'maya@gymcircle.test'),
    ('33333333-3333-3333-3333-333333333333'::uuid, 'rafa@gymcircle.test'),
    ('44444444-4444-4444-4444-444444444444'::uuid, 'bia@gymcircle.test'),
    ('55555555-5555-5555-5555-555555555555'::uuid, 'leo@gymcircle.test'),
    ('66666666-6666-6666-6666-666666666666'::uuid, 'ana@gymcircle.test'),
    ('77777777-7777-7777-7777-777777777777'::uuid, 'caio@gymcircle.test'),
    ('88888888-8888-8888-8888-888888888888'::uuid, 'nina@gymcircle.test')
)
delete from auth.users u
using fake_users f
where u.id = f.id
  and lower(u.email) = f.email;
