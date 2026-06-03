-- Sprint 7.5.9 — Backfill server-side em batch dos achievements derivados.
--
-- Resolve bug "3,8% em todos achievements" que aparecia porque só o user
-- ativo no boot (1 user) tinha rodado o backfill client-side. Resultado:
-- earned_count = 1 pra cada achievement que eu earned → 1/26 = 3.85%
-- pra tudo. Sem variedade nos dados.
--
-- Esta RPC computa server-side os achievements que dependem de stats
-- agregadas (counts globais já em user_stats + profiles). Idempotente
-- via on conflict do user_achievements. Achievements que dependem de
-- queries complexas (secret badges baseado em posts timing, cross-trainer
-- etc) continuam via backfill client-side conforme cada user abre.
--
-- Achievements cobertos:
--   badge:first-workout
--   medal:streak-3, streak-7, streak-14, streak-30, streak-recovered, workouts-50
--   trophy:streak-60, month-active, year-active, social-10, friends-50,
--          network-100, community-200, prolific-100
--   relic:unbreakable, streak-365, circle-master, founder-2026
--
-- Pulados (precisam computação por user):
--   badge:early-bird, night-owl, cross-trainer, explorer (queries de posts)
--   trophy:active-week (sem workouts_this_week em user_stats)
--   challenge:* (já é populado por syncChallengeProgress quando completam)

create or replace function public.backfill_user_achievements_server_side()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int := 0;
  v_user record;
  v_followers_count int;
  v_posts_count int;
  v_now timestamptz := now();
begin
  for v_user in
    select p.user_id, p.created_at, us.best_streak, us.workouts_this_month,
           us.active_days_this_year, us.last_streak_restore_used_at
    from public.profiles p
    left join public.user_stats us on us.user_id = p.user_id
    where p.deleted_at is null
      and p.account_status = 'active'
  loop
    select count(*) into v_followers_count
    from public.follows
    where following_id = v_user.user_id;

    select count(*) into v_posts_count
    from public.posts
    where user_id = v_user.user_id;

    if v_posts_count >= 1 then
      insert into public.user_achievements
        (user_id, achievement_id, earned_at, last_earned_at, count, metadata)
      values (v_user.user_id, 'badge:first-workout', v_now, v_now, 1, '{}'::jsonb)
      on conflict (user_id, achievement_id) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end if;

    if coalesce(v_user.best_streak, 0) >= 3 then
      insert into public.user_achievements
        (user_id, achievement_id, earned_at, last_earned_at, count, metadata)
      values (v_user.user_id, 'medal:streak-3', v_now, v_now, 1, '{}'::jsonb)
      on conflict (user_id, achievement_id) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end if;
    if coalesce(v_user.best_streak, 0) >= 7 then
      insert into public.user_achievements
        (user_id, achievement_id, earned_at, last_earned_at, count, metadata)
      values (v_user.user_id, 'medal:streak-7', v_now, v_now, 1, '{}'::jsonb)
      on conflict (user_id, achievement_id) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end if;
    if coalesce(v_user.best_streak, 0) >= 14 then
      insert into public.user_achievements
        (user_id, achievement_id, earned_at, last_earned_at, count, metadata)
      values (v_user.user_id, 'medal:streak-14', v_now, v_now, 1, '{}'::jsonb)
      on conflict (user_id, achievement_id) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end if;
    if coalesce(v_user.best_streak, 0) >= 30 then
      insert into public.user_achievements
        (user_id, achievement_id, earned_at, last_earned_at, count, metadata)
      values (v_user.user_id, 'medal:streak-30', v_now, v_now, 1, '{}'::jsonb)
      on conflict (user_id, achievement_id) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end if;

    if v_user.last_streak_restore_used_at is not null then
      insert into public.user_achievements
        (user_id, achievement_id, earned_at, last_earned_at, count, metadata)
      values (v_user.user_id, 'medal:streak-recovered', v_now, v_now, 1, '{}'::jsonb)
      on conflict (user_id, achievement_id) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end if;

    if v_posts_count >= 50 then
      insert into public.user_achievements
        (user_id, achievement_id, earned_at, last_earned_at, count, metadata)
      values (v_user.user_id, 'medal:workouts-50', v_now, v_now, 1, '{}'::jsonb)
      on conflict (user_id, achievement_id) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end if;

    if coalesce(v_user.best_streak, 0) >= 60 then
      insert into public.user_achievements
        (user_id, achievement_id, earned_at, last_earned_at, count, metadata)
      values (v_user.user_id, 'trophy:streak-60', v_now, v_now, 1, '{}'::jsonb)
      on conflict (user_id, achievement_id) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end if;

    if coalesce(v_user.workouts_this_month, 0) >= 15 then
      insert into public.user_achievements
        (user_id, achievement_id, earned_at, last_earned_at, count, metadata)
      values (v_user.user_id, 'trophy:month-active', v_now, v_now, 1, '{}'::jsonb)
      on conflict (user_id, achievement_id) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end if;

    if coalesce(v_user.active_days_this_year, 0) >= 100 then
      insert into public.user_achievements
        (user_id, achievement_id, earned_at, last_earned_at, count, metadata)
      values (v_user.user_id, 'trophy:year-active', v_now, v_now, 1, '{}'::jsonb)
      on conflict (user_id, achievement_id) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end if;

    if v_followers_count >= 10 then
      insert into public.user_achievements
        (user_id, achievement_id, earned_at, last_earned_at, count, metadata)
      values (v_user.user_id, 'trophy:social-10', v_now, v_now, 1, '{}'::jsonb)
      on conflict (user_id, achievement_id) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end if;
    if v_followers_count >= 50 then
      insert into public.user_achievements
        (user_id, achievement_id, earned_at, last_earned_at, count, metadata)
      values (v_user.user_id, 'trophy:friends-50', v_now, v_now, 1, '{}'::jsonb)
      on conflict (user_id, achievement_id) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end if;
    if v_followers_count >= 100 then
      insert into public.user_achievements
        (user_id, achievement_id, earned_at, last_earned_at, count, metadata)
      values (v_user.user_id, 'trophy:network-100', v_now, v_now, 1, '{}'::jsonb)
      on conflict (user_id, achievement_id) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end if;
    if v_followers_count >= 200 then
      insert into public.user_achievements
        (user_id, achievement_id, earned_at, last_earned_at, count, metadata)
      values (v_user.user_id, 'trophy:community-200', v_now, v_now, 1, '{}'::jsonb)
      on conflict (user_id, achievement_id) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end if;

    if v_posts_count >= 100 then
      insert into public.user_achievements
        (user_id, achievement_id, earned_at, last_earned_at, count, metadata)
      values (v_user.user_id, 'trophy:prolific-100', v_now, v_now, 1, '{}'::jsonb)
      on conflict (user_id, achievement_id) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end if;

    if coalesce(v_user.best_streak, 0) >= 100 then
      insert into public.user_achievements
        (user_id, achievement_id, earned_at, last_earned_at, count, metadata)
      values (v_user.user_id, 'relic:unbreakable', v_now, v_now, 1, '{}'::jsonb)
      on conflict (user_id, achievement_id) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end if;
    if coalesce(v_user.best_streak, 0) >= 365 then
      insert into public.user_achievements
        (user_id, achievement_id, earned_at, last_earned_at, count, metadata)
      values (v_user.user_id, 'relic:streak-365', v_now, v_now, 1, '{}'::jsonb)
      on conflict (user_id, achievement_id) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end if;
    if coalesce(v_user.active_days_this_year, 0) >= 300 then
      insert into public.user_achievements
        (user_id, achievement_id, earned_at, last_earned_at, count, metadata)
      values (v_user.user_id, 'relic:circle-master', v_now, v_now, 1, '{}'::jsonb)
      on conflict (user_id, achievement_id) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end if;
    if v_user.created_at < timestamp '2027-01-01' then
      insert into public.user_achievements
        (user_id, achievement_id, earned_at, last_earned_at, count, metadata)
      values (v_user.user_id, 'relic:founder-2026', v_now, v_now, 1, '{}'::jsonb)
      on conflict (user_id, achievement_id) do nothing;
      if found then v_inserted := v_inserted + 1; end if;
    end if;

  end loop;

  return v_inserted;
end;
$$;

comment on function public.backfill_user_achievements_server_side() is
  'Sprint 7.5.9 — Backfill server-side em batch dos achievements derivados de user_stats + profiles. Resolve "3,8% em todos" causado pelo backfill ser per-user via client. Idempotente, pode rodar várias vezes. Retorna count de novas rows inseridas.';

-- Executa AGORA — popular DB pré-deploy do client fix
select public.backfill_user_achievements_server_side() as inserted_rows;
