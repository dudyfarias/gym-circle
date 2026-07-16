-- Detalhe de atividade v2: metadados opcionais e sanitizados do Apple Saúde.
-- Séries temporais ficam fora das RPCs do feed e só são hidratadas ao abrir o
-- detalhe, evitando payload/refetch desnecessário. Dados antigos seguem com {}.

alter table public.activities
  add column if not exists health_metadata jsonb not null default '{}'::jsonb;

alter table public.activities
  drop constraint if exists activities_health_metadata_check;
alter table public.activities
  add constraint activities_health_metadata_check check (
    jsonb_typeof(health_metadata) = 'object'
    and octet_length(health_metadata::text) <= 200000
    and (
      not (health_metadata ? 'heart_rate_samples')
      or (
        jsonb_typeof(health_metadata -> 'heart_rate_samples') = 'array'
        and jsonb_array_length(health_metadata -> 'heart_rate_samples') <= 300
      )
    )
  );

comment on column public.activities.health_metadata is
  'Metadata HealthKit opcional: amostras FC reduzidas, esforço, clima, ambiente, aparelho e flags de estimativa. RLS segue a activity.';

create or replace function public.get_activity_detail_v2(
  p_activity_id uuid default null,
  p_post_id uuid default null
)
returns public.activities
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_activity_id uuid;
  v_activity public.activities%rowtype;
begin
  if auth.uid() is null then
    raise exception 'auth_required' using errcode = '42501';
  end if;
  if p_activity_id is not null and p_post_id is not null then
    raise exception 'provide_activity_or_post_not_both' using errcode = '22023';
  end if;

  v_activity_id := p_activity_id;
  if v_activity_id is null and p_post_id is not null then
    select p.source_activity_id
      into v_activity_id
      from public.posts p
     where p.id = p_post_id;
  end if;
  if v_activity_id is null then
    return null;
  end if;

  -- A policy activities_select_visible continua sendo a autoridade: owner ou
  -- activity explicitamente compartilhada e visível ao viewer atual.
  select a.*
    into v_activity
    from public.activities a
   where a.id = v_activity_id;
  if not found then
    return null;
  end if;
  return v_activity;
end;
$$;

revoke all on function public.get_activity_detail_v2(uuid, uuid)
  from public, anon;
grant execute on function public.get_activity_detail_v2(uuid, uuid)
  to authenticated;

comment on function public.get_activity_detail_v2(uuid, uuid) is
  'Hidrata uma activity visível por id ou post, sob RLS, somente ao abrir o detalhe.';
