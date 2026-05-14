-- =====================================================================
-- Gym Circle — academias precisam de localização
-- =====================================================================
-- Regra de produto: para cadastrar uma academia/lugar novo, precisamos
-- salvar latitude/longitude. A constraint fica NOT VALID para não quebrar
-- dados antigos até a limpeza administrativa ser executada, mas passa a
-- validar qualquer INSERT/UPDATE novo.

alter table public.gyms
  drop constraint if exists gyms_location_required;

alter table public.gyms
  add constraint gyms_location_required
  check (
    latitude is not null
    and longitude is not null
    and latitude between -90 and 90
    and longitude between -180 and 180
  ) not valid;

drop policy if exists "gyms_insert_authed" on public.gyms;
create policy "gyms_insert_authed" on public.gyms
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profiles p
       where p.user_id = (select auth.uid())
    )
    and length(trim(name)) >= 3
    and city is not null
    and length(trim(city)) >= 2
    and latitude is not null
    and longitude is not null
    and latitude between -90 and 90
    and longitude between -180 and 180
  );
