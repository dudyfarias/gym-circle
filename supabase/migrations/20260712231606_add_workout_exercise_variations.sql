-- Estrutura aditiva para representar variacoes de um mesmo movimento no
-- catalogo. Nao altera os contratos dos RPCs existentes nem as policies RLS.

alter table public.workout_exercise_catalog
  add column if not exists parent_exercise_id uuid
    references public.workout_exercise_catalog(id) on delete set null,
  add column if not exists movement_pattern text;

comment on column public.workout_exercise_catalog.parent_exercise_id is
  'Exercicio-base opcional desta variacao. ON DELETE SET NULL preserva a variacao se o pai for removido.';
comment on column public.workout_exercise_catalog.movement_pattern is
  'Slug estavel que agrupa variacoes do mesmo padrao de movimento para filtros e progresso.';

alter table public.workout_exercise_catalog
  drop constraint if exists workout_exercise_catalog_parent_not_self_check;
alter table public.workout_exercise_catalog
  add constraint workout_exercise_catalog_parent_not_self_check
    check (parent_exercise_id is null or parent_exercise_id <> id);

alter table public.workout_exercise_catalog
  drop constraint if exists workout_exercise_catalog_movement_pattern_check;
alter table public.workout_exercise_catalog
  add constraint workout_exercise_catalog_movement_pattern_check
    check (
      movement_pattern is null
      or (
        movement_pattern = public.workout_catalog_slug(movement_pattern)
        and length(movement_pattern) between 2 and 100
      )
    );

-- Backfill sem inferencias arriscadas: cada exercicio existente comeca como a
-- raiz do proprio movimento. A curadoria pode ligar variacoes depois, sem
-- alterar nomes, slugs ou grupos musculares existentes.
update public.workout_exercise_catalog
set movement_pattern = slug
where movement_pattern is null;

create index if not exists workout_exercise_catalog_parent_idx
  on public.workout_exercise_catalog (parent_exercise_id)
  where parent_exercise_id is not null;

create index if not exists workout_exercise_catalog_movement_pattern_idx
  on public.workout_exercise_catalog (
    movement_pattern,
    primary_muscle_group_slug,
    name_pt
  );

-- O trigger completa movement_pattern em novas contribuicoes (inclusive as
-- feitas pelo RPC atual, cuja assinatura permanece intacta) e impede ciclos de
-- parentesco alem do simples self-reference coberto pelo CHECK.
create or replace function private.normalize_workout_exercise_variation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_parent_pattern text;
begin
  if new.parent_exercise_id is not null then
    if new.parent_exercise_id = new.id then
      raise exception 'workout_exercise_parent_cycle';
    end if;

    if exists (
      with recursive ancestors as (
        select
          catalog.id,
          catalog.parent_exercise_id,
          array[catalog.id]::uuid[] as visited
        from public.workout_exercise_catalog catalog
        where catalog.id = new.parent_exercise_id

        union all

        select
          catalog.id,
          catalog.parent_exercise_id,
          ancestors.visited || catalog.id
        from ancestors
        join public.workout_exercise_catalog catalog
          on catalog.id = ancestors.parent_exercise_id
        where not catalog.id = any(ancestors.visited)
      )
      select 1
      from ancestors
      where id = new.id
    ) then
      raise exception 'workout_exercise_parent_cycle';
    end if;

    select coalesce(parent.movement_pattern, parent.slug)
      into v_parent_pattern
      from public.workout_exercise_catalog parent
     where parent.id = new.parent_exercise_id;
  end if;

  if new.parent_exercise_id is not null
     and (
       nullif(trim(new.movement_pattern), '') is null
       or (
         tg_op = 'UPDATE'
         and new.parent_exercise_id is distinct from old.parent_exercise_id
         and new.movement_pattern is not distinct from old.movement_pattern
       )
     ) then
    new.movement_pattern := public.workout_catalog_slug(
      coalesce(v_parent_pattern, new.slug)
    );
  else
    new.movement_pattern := public.workout_catalog_slug(
      coalesce(nullif(trim(new.movement_pattern), ''), new.slug)
    );
  end if;

  return new;
end;
$$;

revoke all on function private.normalize_workout_exercise_variation()
  from public, anon, authenticated;

drop trigger if exists workout_exercise_catalog_normalize_variation
  on public.workout_exercise_catalog;
create trigger workout_exercise_catalog_normalize_variation
  before insert or update of
    parent_exercise_id,
    movement_pattern,
    slug
  on public.workout_exercise_catalog
  for each row
  execute function private.normalize_workout_exercise_variation();

-- Riscos e decisoes:
-- 1. nenhum parent_exercise_id e inferido automaticamente; isso evita agrupar
--    movimentos parecidos mas biomecanicamente diferentes;
-- 2. exercicios compostos continuam como raizes ate curadoria explicita;
-- 3. movement_pattern nasce como slug proprio, portanto filtros atuais nao
--    mudam e clientes que desconhecem as colunas novas continuam compativeis;
-- 4. policies/grants nao mudam. As colunas seguem a RLS da linha do catalogo.
--
-- SQL de validacao manual (nao executado pela migration):
-- select count(*) filter (where movement_pattern is null) as missing_pattern,
--        count(*) filter (where parent_exercise_id is not null) as variations
-- from public.workout_exercise_catalog;
--
-- select child.slug, parent.slug as parent_slug, child.movement_pattern
-- from public.workout_exercise_catalog child
-- left join public.workout_exercise_catalog parent
--   on parent.id = child.parent_exercise_id
-- where child.parent_exercise_id is not null
-- order by child.movement_pattern, child.slug;
--
-- with recursive ancestry as (
--   select id, parent_exercise_id, array[id]::uuid[] as path, false as cycle
--   from public.workout_exercise_catalog
--   union all
--   select parent.id, parent.parent_exercise_id,
--          ancestry.path || parent.id,
--          parent.id = any(ancestry.path)
--   from ancestry
--   join public.workout_exercise_catalog parent
--     on parent.id = ancestry.parent_exercise_id
--   where not ancestry.cycle
-- )
-- select * from ancestry where cycle;
