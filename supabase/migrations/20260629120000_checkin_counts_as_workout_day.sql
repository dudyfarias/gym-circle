-- Check-in conta como "dia de treino feito" — sem foto, sem perder streak.
--
-- Contexto: o streak + o calendário vivem em public.user_activity_days. Posts e
-- stories já viram activity_days via triggers (on_post_inserted / on_story_inserted).
-- Um check-in (public.checkins) NÃO criava nenhum activity_day, então fazer
-- check-in não marcava o dia nem mantinha o streak. Esta migration fecha esse gap:
-- todo check-in passa a criar um activity_day, igualzinho aos dias "sem foto" que
-- o johnny já tem (que vêm de story/tag). O usuário pode postar foto depois — o
-- post adiciona o próprio activity_day (source_type='post') na mesma data.
--
-- has_photo=true (mesmo sem foto): no schema, has_photo é o flag que o motor de
-- streak (private.calc_user_stats / private.has_streak_day) usa pra decidir se um
-- dia "conta" — NÃO é o que decide mostrar miniatura no calendário (isso vem do
-- post/thumbnailUrl). Marcar true faz o check-in contar em streak, best_streak,
-- treinos do mês/ano e calendário, SEM tocar no motor de streak (zero risco). O
-- source_type='checkin' preserva a distinção pra futuros usos (ex.: dia só de
-- check-in vs dia com foto).

-- 1) Permitir source_type='checkin' em user_activity_days (drop robusto por nome).
do $$
declare c_name text;
begin
  select c.conname into c_name
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
   where n.nspname = 'public'
     and t.relname = 'user_activity_days'
     and c.contype = 'c'
     and pg_get_constraintdef(c.oid) ilike '%source_type%';
  if c_name is not null then
    execute format('alter table public.user_activity_days drop constraint %I', c_name);
  end if;
end $$;

alter table public.user_activity_days
  add constraint user_activity_days_source_type_check
  check (source_type in ('post', 'story', 'post_participant', 'story_participant', 'checkin'));

-- 2) Triggers: check-in cria/remove o activity_day + recalcula stats (espelha os
--    triggers de post/story).
create or replace function private.on_checkin_inserted()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.user_activity_days (user_id, activity_date, source_type, source_id, has_photo)
  values (new.user_id, new.checkin_date, 'checkin', new.id, true)
  on conflict (user_id, activity_date, source_type, source_id) do nothing;
  perform private.recalculate_user_stats(new.user_id);
  return new;
end; $$;

create or replace function private.on_checkin_deleted()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from public.user_activity_days where source_type = 'checkin' and source_id = old.id;
  perform private.recalculate_user_stats(old.user_id);
  return old;
end; $$;

drop trigger if exists checkins_after_insert on public.checkins;
create trigger checkins_after_insert after insert on public.checkins
  for each row execute function private.on_checkin_inserted();

drop trigger if exists checkins_after_delete on public.checkins;
create trigger checkins_after_delete after delete on public.checkins
  for each row execute function private.on_checkin_deleted();

-- 3) Backfill dos check-ins que já existem (idempotente) + recalcula quem tinha.
insert into public.user_activity_days (user_id, activity_date, source_type, source_id, has_photo)
select c.user_id, c.checkin_date, 'checkin', c.id, true
  from public.checkins c
on conflict (user_id, activity_date, source_type, source_id) do nothing;

select private.recalculate_user_stats(u.user_id)
  from (select distinct user_id from public.checkins) u;
