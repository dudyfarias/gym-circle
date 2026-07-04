-- "Integrar treino" — juntar um post e um treino do MESMO dia num só item.
-- O post recebe source_activity_id da activity; get_home_feed passa a mostrar
-- as métricas e get_home_activities esconde a activity (some do feed, sem
-- duplicar). Reversível apagando o post (a activity reaparece).

-- 1) Treinos do dia do post que ainda podem ser integrados (do próprio user,
--    mesma data, não promovidos por nenhum post). Alimenta o picker.
create or replace function public.get_mergeable_activities(p_workout_date date)
returns table (
  id uuid,
  activity_type text,
  elapsed_s integer,
  moving_s integer,
  distance_m numeric,
  elevation_gain_m numeric,
  avg_hr integer,
  total_calories numeric,
  started_at timestamptz,
  ended_at timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    a.id, a.activity_type, a.elapsed_s, a.moving_s, a.distance_m,
    a.elevation_gain_m, a.avg_hr, a.total_calories, a.started_at, a.ended_at
  from public.activities a
  where a.user_id = auth.uid()
    and a.workout_date = p_workout_date
    and not exists (
      select 1 from public.posts p where p.source_activity_id = a.id
    )
  order by a.created_at desc;
$$;

revoke all on function public.get_mergeable_activities(date) from public, anon;
grant execute on function public.get_mergeable_activities(date) to authenticated;

-- 2) Integra o treino no post. Checa dono dos dois + mesma data + treino ainda
--    livre. O trigger posts_validate_source_activity reforça a data/dono.
create or replace function public.merge_activity_into_post(
  p_post_id uuid,
  p_activity_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  update public.posts p
     set source_activity_id = p_activity_id
   where p.id = p_post_id
     and p.user_id = v_uid
     and exists (
       select 1 from public.activities a
        where a.id = p_activity_id
          and a.user_id = v_uid
          and a.workout_date = p.workout_date
     )
     and not exists (
       select 1 from public.posts other
        where other.source_activity_id = p_activity_id
          and other.id <> p_post_id
     );
  if not found then
    raise exception 'não foi possível integrar o treino a este post'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.merge_activity_into_post(uuid, uuid) from public, anon;
grant execute on function public.merge_activity_into_post(uuid, uuid) to authenticated;
