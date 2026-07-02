-- Gym Circle — editor social unificado (check-in ↔ post ↔ carrossel).
--
-- O banco continua com dois modelos deliberadamente distintos:
--   * checkins: entrada sem mídia, responsável por streak/calendário;
--   * posts: entrada com pelo menos uma mídia.
--
-- As funções abaixo fazem as transições sensíveis dentro de uma transação e
-- mantêm posts.source_checkin_id sincronizado. A implementação privilegiada
-- fica no schema private; wrappers públicos rodam como invoker e só são
-- executáveis por usuários autenticados.

create or replace function private.social_gym_maps_url(
  p_latitude double precision,
  p_longitude double precision
)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when p_latitude is null or p_longitude is null then null
    else 'https://www.google.com/maps/search/?api=1&query='
      || p_latitude::text || '%2C' || p_longitude::text
  end;
$$;

create or replace function private.update_social_post(
  p_post_id uuid,
  p_caption text,
  p_workout_types text[],
  p_gym_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_post public.posts%rowtype;
  target_gym public.gyms%rowtype;
  duplicate_checkin_id uuid;
begin
  if actor_id is null then
    raise exception 'autenticação obrigatória' using errcode = '42501';
  end if;

  select *
    into target_post
    from public.posts
   where id = p_post_id
   for update;

  if not found or target_post.user_id is distinct from actor_id then
    raise exception 'post não encontrado ou sem permissão'
      using errcode = '42501';
  end if;

  if p_gym_id is not null then
    select *
      into target_gym
      from public.gyms
     where id = p_gym_id;
    if not found then
      raise exception 'local não encontrado' using errcode = '23503';
    end if;
  end if;

  -- Um post promovido representa o mesmo treino do check-in. Ao trocar a
  -- academia, movemos/reutilizamos o check-in antes de atualizar o post para
  -- que o trigger de consistência nunca observe dados divergentes.
  if target_post.source_checkin_id is not null then
    if p_gym_id is null then
      raise exception 'um post originado de check-in precisa manter um local'
        using errcode = '23514';
    end if;

    select c.id
      into duplicate_checkin_id
      from public.checkins c
     where c.user_id = actor_id
       and c.gym_id = p_gym_id
       and c.checkin_date = target_post.workout_date
       and c.id <> target_post.source_checkin_id
     order by c.created_at desc, c.id desc
     limit 1
     for update;

    if duplicate_checkin_id is not null then
      update public.posts
         set source_checkin_id = duplicate_checkin_id,
             gym_id = p_gym_id
       where id = p_post_id;

      delete from public.checkins
       where id = target_post.source_checkin_id
         and user_id = actor_id;
    else
      update public.checkins
         set gym_id = p_gym_id
       where id = target_post.source_checkin_id
         and user_id = actor_id;
    end if;
  end if;

  update public.posts
     set caption = nullif(btrim(coalesce(p_caption, '')), ''),
         workout_type = nullif(btrim(coalesce(p_workout_types[1], '')), ''),
         workout_types = case
           when coalesce(cardinality(p_workout_types), 0) = 0 then null
           else p_workout_types[1:5]
         end,
         gym_id = p_gym_id,
         location_source = case when p_gym_id is null then 'none' else 'gym' end,
         location_name = case when p_gym_id is null then null else target_gym.name end,
         location_latitude = case when p_gym_id is null then null else target_gym.latitude end,
         location_longitude = case when p_gym_id is null then null else target_gym.longitude end,
         location_google_maps_url = case
           when p_gym_id is null then null
           else private.social_gym_maps_url(target_gym.latitude, target_gym.longitude)
         end
   where id = p_post_id;
end;
$$;

create or replace function private.update_social_checkin(
  p_checkin_id uuid,
  p_gym_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_checkin public.checkins%rowtype;
  duplicate_checkin_id uuid;
begin
  if actor_id is null then
    raise exception 'autenticação obrigatória' using errcode = '42501';
  end if;

  if not exists (select 1 from public.gyms where id = p_gym_id) then
    raise exception 'local não encontrado' using errcode = '23503';
  end if;

  select *
    into target_checkin
    from public.checkins
   where id = p_checkin_id
   for update;

  if not found or target_checkin.user_id is distinct from actor_id then
    raise exception 'check-in não encontrado ou sem permissão'
      using errcode = '42501';
  end if;

  select c.id
    into duplicate_checkin_id
    from public.checkins c
   where c.user_id = actor_id
     and c.gym_id = p_gym_id
     and c.checkin_date = target_checkin.checkin_date
     and c.id <> target_checkin.id
   order by c.created_at desc, c.id desc
   limit 1
   for update;

  if duplicate_checkin_id is not null then
    -- Um check-in que já tem post promovido não pode ser fundido por esta rota;
    -- o editor do post usa update_social_post, que sincroniza ambos.
    if exists (
      select 1 from public.posts where source_checkin_id = target_checkin.id
    ) then
      raise exception 'edite a localização pelo post vinculado'
        using errcode = '23514';
    end if;

    delete from public.checkins
     where id = target_checkin.id
       and user_id = actor_id;
    return duplicate_checkin_id;
  end if;

  update public.checkins
     set gym_id = p_gym_id
   where id = target_checkin.id
     and user_id = actor_id;

  return target_checkin.id;
end;
$$;

create or replace function private.convert_social_post_to_checkin(
  p_post_id uuid,
  p_gym_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_post public.posts%rowtype;
  result_checkin_id uuid;
  original_checkin_id uuid;
  target_date date;
begin
  if actor_id is null then
    raise exception 'autenticação obrigatória' using errcode = '42501';
  end if;

  if not exists (select 1 from public.gyms where id = p_gym_id) then
    raise exception 'local não encontrado' using errcode = '23503';
  end if;

  select *
    into target_post
    from public.posts
   where id = p_post_id
   for update;

  if not found or target_post.user_id is distinct from actor_id then
    raise exception 'post não encontrado ou sem permissão'
      using errcode = '42501';
  end if;

  target_date := coalesce(
    target_post.workout_date,
    (target_post.created_at at time zone 'America/Sao_Paulo')::date
  );
  original_checkin_id := target_post.source_checkin_id;

  select c.id
    into result_checkin_id
    from public.checkins c
   where c.user_id = actor_id
     and c.gym_id = p_gym_id
     and c.checkin_date = target_date
     and (original_checkin_id is null or c.id <> original_checkin_id)
   order by c.created_at desc, c.id desc
   limit 1
   for update;

  if result_checkin_id is null and original_checkin_id is not null then
    update public.checkins
       set gym_id = p_gym_id
     where id = original_checkin_id
       and user_id = actor_id
    returning id into result_checkin_id;
  end if;

  if result_checkin_id is null then
    insert into public.checkins (
      user_id,
      gym_id,
      checkin_date,
      created_at
    )
    values (
      actor_id,
      p_gym_id,
      target_date,
      target_post.created_at
    )
    returning id into result_checkin_id;
  end if;

  -- post_media, likes, comentários e tags são removidos pelos FKs da postagem.
  delete from public.posts
   where id = target_post.id
     and user_id = actor_id;

  if original_checkin_id is not null
     and original_checkin_id is distinct from result_checkin_id then
    delete from public.checkins
     where id = original_checkin_id
       and user_id = actor_id;
  end if;

  return result_checkin_id;
end;
$$;

create or replace function public.update_social_post(
  p_post_id uuid,
  p_caption text default null,
  p_workout_types text[] default null,
  p_gym_id uuid default null
)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.update_social_post(
    p_post_id,
    p_caption,
    coalesce(p_workout_types, array[]::text[]),
    p_gym_id
  );
$$;

create or replace function public.update_social_checkin(
  p_checkin_id uuid,
  p_gym_id uuid
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.update_social_checkin(p_checkin_id, p_gym_id);
$$;

create or replace function public.convert_social_post_to_checkin(
  p_post_id uuid,
  p_gym_id uuid
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.convert_social_post_to_checkin(p_post_id, p_gym_id);
$$;

revoke all on function public.update_social_post(uuid, text, text[], uuid)
  from public, anon;
revoke all on function public.update_social_checkin(uuid, uuid)
  from public, anon;
revoke all on function public.convert_social_post_to_checkin(uuid, uuid)
  from public, anon;
revoke all on function private.update_social_post(uuid, text, text[], uuid)
  from public;
revoke all on function private.update_social_checkin(uuid, uuid)
  from public;
revoke all on function private.convert_social_post_to_checkin(uuid, uuid)
  from public;

grant execute on function public.update_social_post(uuid, text, text[], uuid)
  to authenticated;
grant execute on function public.update_social_checkin(uuid, uuid)
  to authenticated;
grant execute on function public.convert_social_post_to_checkin(uuid, uuid)
  to authenticated;
grant execute on function private.update_social_post(uuid, text, text[], uuid)
  to authenticated;
grant execute on function private.update_social_checkin(uuid, uuid)
  to authenticated;
grant execute on function private.convert_social_post_to_checkin(uuid, uuid)
  to authenticated;

comment on function public.update_social_post(uuid, text, text[], uuid)
  is 'Atualiza metadados/local do post e sincroniza o check-in de origem.';
comment on function public.update_social_checkin(uuid, uuid)
  is 'Move um check-in próprio para outro local, reutilizando duplicata do mesmo dia.';
comment on function public.convert_social_post_to_checkin(uuid, uuid)
  is 'Remove um post próprio e preserva/constrói seu check-in no mesmo dia.';
