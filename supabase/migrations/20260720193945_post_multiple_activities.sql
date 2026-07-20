-- Permite que um post reúna mais de uma atividade do mesmo usuário/dia sem
-- quebrar consumidores legados que ainda usam posts.source_activity_id.
-- source_activity_id permanece como atividade principal; esta tabela é a
-- fonte canônica dos vínculos (incluindo a principal).

create table if not exists public.post_activities (
  post_id uuid not null references public.posts(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  position integer not null default 0 check (position >= 0 and position < 20),
  -- Não há FK deliberadamente: há posts históricos de contas já removidas
  -- sem profile correspondente. O dono/data são validados pelas FKs de
  -- post/activity e pela RPC com auth.uid().
  linked_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (post_id, activity_id),
  unique (activity_id)
);

create index if not exists post_activities_post_position_idx
  on public.post_activities (post_id, position, created_at);

alter table public.post_activities enable row level security;

drop policy if exists post_activities_select_owner
  on public.post_activities;
create policy post_activities_select_owner
  on public.post_activities
  for select
  to authenticated
  using (
    auth.uid() is not null
    and exists (
      select 1
        from public.posts p
       where p.id = post_activities.post_id
         and p.user_id = auth.uid()
    )
  );

revoke all on table public.post_activities from public, anon, authenticated;
grant select on table public.post_activities to authenticated;

-- Preserva todos os vínculos antigos como posição zero.
insert into public.post_activities (
  post_id,
  activity_id,
  position,
  linked_by,
  created_at
)
select p.id, p.source_activity_id, 0, p.user_id, p.created_at
  from public.posts p
 where p.source_activity_id is not null
on conflict (activity_id) do nothing;

-- A publicação agora pode ser sustentada pelo vínculo legado OU pela tabela
-- multiatividade. Sem isso, uma atividade secundária não poderia virar shared.
create or replace function private.guard_activity_publication_state()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_has_post boolean;
begin
  select exists (
    select 1
      from public.posts post
     where post.source_activity_id = new.id
    union all
    select 1
      from public.post_activities link
     where link.activity_id = new.id
  ) into v_has_post;

  if new.publication_state = 'shared' and not v_has_post then
    raise exception 'activity_requires_post_to_be_shared' using errcode = '23514';
  end if;

  if new.publication_state <> 'shared' and v_has_post then
    raise exception 'published_activity_must_be_shared' using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Mantém o comportamento legado, mas só volta uma atividade para private se
-- nenhum vínculo multiatividade ainda a estiver publicando.
create or replace function private.sync_activity_publication_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    update public.activities activity
       set publication_state = 'private'
     where activity.id = old.source_activity_id
       and old.source_activity_id is not null
       and not exists (
         select 1 from public.posts remaining
          where remaining.source_activity_id = old.source_activity_id
       )
       and not exists (
         select 1 from public.post_activities remaining_link
          where remaining_link.activity_id = old.source_activity_id
       );
    return old;
  end if;

  if tg_op = 'UPDATE'
     and old.source_activity_id is not null
     and old.source_activity_id is distinct from new.source_activity_id then
    update public.activities activity
       set publication_state = 'private'
     where activity.id = old.source_activity_id
       and not exists (
         select 1 from public.posts remaining
          where remaining.source_activity_id = old.source_activity_id
       )
       and not exists (
         select 1 from public.post_activities remaining_link
          where remaining_link.activity_id = old.source_activity_id
       );
  end if;

  if new.source_activity_id is not null then
    update public.activities
       set publication_state = 'shared'
     where id = new.source_activity_id;
  end if;

  return new;
end;
$$;

create or replace function private.sync_post_activity_link_publication_state()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    update public.activities
       set publication_state = 'shared'
     where id = new.activity_id;
    return new;
  end if;

  update public.activities activity
     set publication_state = 'private'
   where activity.id = old.activity_id
     and not exists (
       select 1 from public.post_activities remaining_link
        where remaining_link.activity_id = old.activity_id
     )
     and not exists (
       select 1 from public.posts remaining_post
        where remaining_post.source_activity_id = old.activity_id
     );
  return old;
end;
$$;

drop trigger if exists post_activities_sync_publication_state
  on public.post_activities;
create trigger post_activities_sync_publication_state
after insert or delete on public.post_activities
for each row execute function private.sync_post_activity_link_publication_state();

-- Retorna apenas atividades ainda livres. A leitura da tabela de links passa
-- pela policy owner-only porque esta função é SECURITY INVOKER.
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
  where auth.uid() is not null
    and a.user_id = auth.uid()
    and a.workout_date = p_workout_date
    and not exists (
      select 1 from public.post_activities link where link.activity_id = a.id
    )
    and not exists (
      select 1 from public.posts p where p.source_activity_id = a.id
    )
  order by a.started_at desc nulls last, a.created_at desc;
$$;

revoke all on function public.get_mergeable_activities(date) from public, anon;
grant execute on function public.get_mergeable_activities(date) to authenticated;

-- Lista as atividades já integradas para que a UI mantenha o seletor aberto e
-- mostre o progresso ao adicionar Cardio + Musculação + Sauna.
create or replace function public.get_post_activities(p_post_id uuid)
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
  from public.post_activities link
  join public.activities a on a.id = link.activity_id
  join public.posts p on p.id = link.post_id
  where auth.uid() is not null
    and link.post_id = p_post_id
    and p.user_id = auth.uid()
  order by link.position, link.created_at;
$$;

revoke all on function public.get_post_activities(uuid) from public, anon;
grant execute on function public.get_post_activities(uuid) to authenticated;

-- Operação intencionalmente privilegiada e limitada ao próprio auth.uid().
-- Faz lock do post e valida dono/data antes de inserir qualquer vínculo.
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
  v_post public.posts%rowtype;
  v_activity public.activities%rowtype;
  v_position integer;
begin
  if v_uid is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;

  select * into v_post
    from public.posts p
   where p.id = p_post_id
     and p.user_id = v_uid
   for update;
  if not found then
    raise exception 'post_not_owned' using errcode = '42501';
  end if;

  select * into v_activity
    from public.activities a
   where a.id = p_activity_id
     and a.user_id = v_uid;
  if not found then
    raise exception 'activity_not_owned' using errcode = '42501';
  end if;

  if v_activity.workout_date is distinct from v_post.workout_date then
    raise exception 'activity_post_date_mismatch' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.post_activities link
     where link.activity_id = p_activity_id
       and link.post_id <> p_post_id
  ) or exists (
    select 1 from public.posts other
     where other.source_activity_id = p_activity_id
       and other.id <> p_post_id
  ) then
    raise exception 'activity_already_linked' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.post_activities link
     where link.post_id = p_post_id
       and link.activity_id = p_activity_id
  ) then
    return;
  end if;

  select coalesce(max(link.position), -1) + 1
    into v_position
    from public.post_activities link
   where link.post_id = p_post_id;

  if v_position >= 10 then
    raise exception 'post_activity_limit_reached' using errcode = '22023';
  end if;

  insert into public.post_activities (
    post_id, activity_id, position, linked_by
  ) values (
    p_post_id, p_activity_id, v_position, v_uid
  );

  -- Somente o primeiro treino vira a fonte principal para os consumidores
  -- legados. Os próximos nunca sobrescrevem a capa/estatísticas existentes.
  if v_post.source_activity_id is null then
    update public.posts
       set source_activity_id = p_activity_id
     where id = p_post_id;
  end if;
end;
$$;

revoke all on function public.merge_activity_into_post(uuid, uuid)
  from public, anon;
grant execute on function public.merge_activity_into_post(uuid, uuid)
  to authenticated;

comment on table public.post_activities is
  'Vínculos imutáveis de múltiplas activities a um post; source_activity_id mantém compatibilidade como atividade principal.';
