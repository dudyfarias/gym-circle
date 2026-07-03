-- Gym Circle — resilient media pipeline.
-- - 1 GiB hard limit and explicit MIME allow-list for social media buckets.
-- - atomic post + carousel creation/replacement.
-- - production telemetry for upload/publish failures.
-- - hourly Storage cleanup trigger (the Edge Function performs the safe,
--   reference-aware deletion through the Storage API).

update storage.buckets
   set file_size_limit = 1073741824,
       allowed_mime_types = array[
         'image/jpeg',
         'image/png',
         'image/webp',
         'image/avif',
         'image/heic',
         'image/heif',
         'video/mp4',
         'video/quicktime',
         'video/x-m4v',
         'video/webm'
       ]::text[]
 where id in ('posts', 'stories', 'chat-media');

create table if not exists public.media_pipeline_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  operation text not null,
  stage text not null,
  status text not null check (status in ('started', 'succeeded', 'failed')),
  bucket_id text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  mime_type text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.media_pipeline_events enable row level security;

drop policy if exists media_pipeline_events_insert_self
  on public.media_pipeline_events;
create policy media_pipeline_events_insert_self
  on public.media_pipeline_events
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create index if not exists media_pipeline_events_user_created_idx
  on public.media_pipeline_events (user_id, created_at desc);
create index if not exists media_pipeline_events_failed_created_idx
  on public.media_pipeline_events (created_at desc)
  where status = 'failed';

revoke all on table public.media_pipeline_events from public, anon;
grant insert on table public.media_pipeline_events to authenticated;
grant all on table public.media_pipeline_events to service_role;

create table if not exists public.media_cleanup_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running', 'succeeded', 'failed', 'skipped')),
  scanned_count integer not null default 0,
  candidate_count integer not null default 0,
  deleted_count integer not null default 0,
  deleted_bytes bigint not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);

alter table public.media_cleanup_runs enable row level security;
create index if not exists media_cleanup_runs_started_idx
  on public.media_cleanup_runs (started_at desc);
revoke all on table public.media_cleanup_runs from public, anon, authenticated;
grant all on table public.media_cleanup_runs to service_role;

create or replace function private.replace_social_post_media(
  p_post_id uuid,
  p_media jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  media_count integer;
  cover record;
begin
  if actor_id is null then
    raise exception 'autenticação obrigatória' using errcode = '42501';
  end if;

  perform 1
    from public.posts
   where id = p_post_id
     and user_id = actor_id
   for update;
  if not found then
    raise exception 'post não encontrado ou sem permissão'
      using errcode = '42501';
  end if;

  if p_media is null or jsonb_typeof(p_media) <> 'array' then
    raise exception 'lista de mídia inválida' using errcode = '22023';
  end if;

  media_count := jsonb_array_length(p_media);
  if media_count < 1 or media_count > 10 then
    raise exception 'o post precisa ter entre 1 e 10 mídias'
      using errcode = '23514';
  end if;

  select *
    into cover
    from jsonb_to_record(p_media -> 0) as item(
      media_type text,
      image_url text,
      thumbnail_url text,
      poster_url text,
      blur_data_url text,
      media_width integer,
      media_height integer,
      media_duration_seconds numeric
    );

  if cover.media_type not in ('image', 'video')
     or nullif(btrim(cover.image_url), '') is null then
    raise exception 'capa de mídia inválida' using errcode = '23514';
  end if;

  delete from public.post_media where post_id = p_post_id;

  if media_count > 1 then
    insert into public.post_media (
      post_id,
      position,
      media_type,
      image_url,
      thumbnail_url,
      poster_url,
      blur_data_url,
      media_width,
      media_height,
      media_duration_seconds
    )
    select
      p_post_id,
      entry.ordinality::integer - 1,
      item.media_type,
      item.image_url,
      nullif(btrim(item.thumbnail_url), ''),
      nullif(btrim(item.poster_url), ''),
      nullif(btrim(item.blur_data_url), ''),
      item.media_width,
      item.media_height,
      item.media_duration_seconds
    from jsonb_array_elements(p_media) with ordinality
      as entry(value, ordinality)
    cross join lateral jsonb_to_record(entry.value) as item(
      media_type text,
      image_url text,
      thumbnail_url text,
      poster_url text,
      blur_data_url text,
      media_width integer,
      media_height integer,
      media_duration_seconds numeric
    )
    where item.media_type in ('image', 'video')
      and nullif(btrim(item.image_url), '') is not null;

    if (select count(*) from public.post_media where post_id = p_post_id)
       <> media_count then
      raise exception 'uma ou mais mídias são inválidas' using errcode = '23514';
    end if;
  end if;

  update public.posts
     set image_url = cover.image_url,
         media_type = cover.media_type,
         thumbnail_url = nullif(btrim(cover.thumbnail_url), ''),
         poster_url = nullif(btrim(cover.poster_url), ''),
         blur_data_url = nullif(btrim(cover.blur_data_url), ''),
         media_width = cover.media_width,
         media_height = cover.media_height,
         media_duration_seconds = cover.media_duration_seconds
   where id = p_post_id
     and user_id = actor_id;
end;
$$;

create or replace function private.create_social_post_with_media(
  p_post jsonb,
  p_media jsonb
)
returns public.posts
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  created_post public.posts%rowtype;
  workout_types text[];
  location_source text;
  cover record;
begin
  if actor_id is null then
    raise exception 'autenticação obrigatória' using errcode = '42501';
  end if;

  if p_post is null or jsonb_typeof(p_post) <> 'object' then
    raise exception 'dados do post inválidos' using errcode = '22023';
  end if;
  if p_media is null or jsonb_typeof(p_media) <> 'array'
     or jsonb_array_length(p_media) < 1
     or jsonb_array_length(p_media) > 10 then
    raise exception 'o post precisa ter entre 1 e 10 mídias'
      using errcode = '23514';
  end if;

  select *
    into cover
    from jsonb_to_record(p_media -> 0) as item(
      media_type text,
      image_url text,
      thumbnail_url text,
      poster_url text,
      blur_data_url text,
      media_width integer,
      media_height integer,
      media_duration_seconds numeric
    );
  if cover.media_type not in ('image', 'video')
     or nullif(btrim(cover.image_url), '') is null then
    raise exception 'capa de mídia inválida' using errcode = '23514';
  end if;

  select coalesce(array_agg(value), array[]::text[])
    into workout_types
    from (
      select nullif(btrim(value), '') as value
        from jsonb_array_elements_text(
          case
            when jsonb_typeof(p_post -> 'workout_types') = 'array'
              then p_post -> 'workout_types'
            else '[]'::jsonb
          end
        )
       where nullif(btrim(value), '') is not null
       limit 5
    ) tags;

  location_source := coalesce(nullif(p_post ->> 'location_source', ''), 'none');

  insert into public.posts (
    user_id,
    source_checkin_id,
    source_activity_id,
    image_url,
    media_type,
    thumbnail_url,
    poster_url,
    media_width,
    media_height,
    media_duration_seconds,
    blur_data_url,
    caption,
    gym_id,
    workout_type,
    workout_types,
    workout_date,
    created_at,
    location_source,
    location_name,
    location_latitude,
    location_longitude,
    location_google_maps_url
  )
  values (
    actor_id,
    nullif(p_post ->> 'source_checkin_id', '')::uuid,
    nullif(p_post ->> 'source_activity_id', '')::uuid,
    cover.image_url,
    cover.media_type,
    nullif(btrim(cover.thumbnail_url), ''),
    nullif(btrim(cover.poster_url), ''),
    cover.media_width,
    cover.media_height,
    cover.media_duration_seconds,
    nullif(btrim(cover.blur_data_url), ''),
    nullif(btrim(coalesce(p_post ->> 'caption', '')), ''),
    nullif(p_post ->> 'gym_id', '')::uuid,
    coalesce(
      nullif(btrim(p_post ->> 'workout_type'), ''),
      workout_types[1]
    ),
    case when cardinality(workout_types) = 0 then null else workout_types end,
    coalesce(
      nullif(p_post ->> 'workout_date', '')::date,
      (now() at time zone 'America/Sao_Paulo')::date
    ),
    coalesce(nullif(p_post ->> 'created_at', '')::timestamptz, now()),
    location_source,
    case when location_source = 'none'
      then null else nullif(btrim(p_post ->> 'location_name'), '') end,
    case when location_source = 'none'
      then null else nullif(p_post ->> 'location_latitude', '')::double precision end,
    case when location_source = 'none'
      then null else nullif(p_post ->> 'location_longitude', '')::double precision end,
    case when location_source = 'none'
      then null else nullif(btrim(p_post ->> 'location_google_maps_url'), '') end
  )
  returning * into created_post;

  perform private.replace_social_post_media(created_post.id, p_media);
  return created_post;
end;
$$;

create or replace function private.update_social_post_full(
  p_post_id uuid,
  p_caption text,
  p_workout_types text[],
  p_gym_id uuid,
  p_media jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.update_social_post(
    p_post_id,
    p_caption,
    coalesce(p_workout_types, array[]::text[]),
    p_gym_id
  );
  if p_media is not null then
    perform private.replace_social_post_media(p_post_id, p_media);
  end if;
end;
$$;

create or replace function public.create_social_post_with_media(
  p_post jsonb,
  p_media jsonb
)
returns public.posts
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.create_social_post_with_media(p_post, p_media);
$$;

create or replace function public.replace_social_post_media(
  p_post_id uuid,
  p_media jsonb
)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.replace_social_post_media(p_post_id, p_media);
$$;

create or replace function public.update_social_post_full(
  p_post_id uuid,
  p_caption text default null,
  p_workout_types text[] default null,
  p_gym_id uuid default null,
  p_media jsonb default null
)
returns void
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.update_social_post_full(
    p_post_id,
    p_caption,
    coalesce(p_workout_types, array[]::text[]),
    p_gym_id,
    p_media
  );
$$;

revoke all on function public.create_social_post_with_media(jsonb, jsonb)
  from public, anon;
revoke all on function public.replace_social_post_media(uuid, jsonb)
  from public, anon;
revoke all on function public.update_social_post_full(uuid, text, text[], uuid, jsonb)
  from public, anon;
revoke all on function private.create_social_post_with_media(jsonb, jsonb)
  from public;
revoke all on function private.replace_social_post_media(uuid, jsonb)
  from public;
revoke all on function private.update_social_post_full(uuid, text, text[], uuid, jsonb)
  from public;

grant execute on function public.create_social_post_with_media(jsonb, jsonb)
  to authenticated;
grant execute on function public.replace_social_post_media(uuid, jsonb)
  to authenticated;
grant execute on function public.update_social_post_full(uuid, text, text[], uuid, jsonb)
  to authenticated;
grant execute on function private.create_social_post_with_media(jsonb, jsonb)
  to authenticated;
grant execute on function private.replace_social_post_media(uuid, jsonb)
  to authenticated;
grant execute on function private.update_social_post_full(uuid, text, text[], uuid, jsonb)
  to authenticated;

comment on function public.create_social_post_with_media(jsonb, jsonb)
  is 'Cria post e lista completa de mídias atomicamente.';
comment on function public.replace_social_post_media(uuid, jsonb)
  is 'Substitui carrossel e capa atomicamente.';
comment on function public.update_social_post_full(uuid, text, text[], uuid, jsonb)
  is 'Atualiza metadados, localização, check-in vinculado e mídias atomicamente.';

-- The URL/key are stored in Vault out-of-band. Keeping the cron command free
-- from literal credentials makes the migration safe to version.
do $$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
    from cron.job
   where jobname = 'gym-circle-media-cleanup';
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'gym-circle-media-cleanup',
    '17 * * * *',
    $job$
      select net.http_post(
        url := (
          select decrypted_secret
            from vault.decrypted_secrets
           where name = 'media_cleanup_url'
           limit 1
        ),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cleanup-key', (
            select decrypted_secret
              from vault.decrypted_secrets
             where name = 'media_cleanup_key'
             limit 1
          )
        ),
        body := '{"scheduled":true}'::jsonb
      );
    $job$
  );
end;
$$;
