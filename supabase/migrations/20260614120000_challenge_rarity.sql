-- Sprint 22 — "tudo é desafio, agrupado por raridade".
-- Desafio mensal passa a carregar RARIDADE (5 níveis) direto, no lugar de
-- difficulty (4 níveis, que pulava o "raro"). A coluna difficulty FICA (inerte)
-- até o nativo migrar. O backfill preserva os pontos de todos os desafios.

alter table public.monthly_challenges
  add column if not exists rarity text
  check (rarity in ('common','uncommon','rare','epic','legendary'));

update public.monthly_challenges
set rarity = case difficulty
  when 'easy' then 'common'
  when 'medium' then 'uncommon'
  when 'hard' then 'epic'
  when 'legendary' then 'legendary'
  else 'common'
end
where rarity is null;

alter table public.monthly_challenges
  alter column rarity set not null;

-- points_for_achievement: o ramo challenge:% passa a resolver via rarity
-- (comum 1 / incomum 2 / raro 3 / épico 5 / lendário 10). Pontos preservados.
create or replace function private.points_for_achievement(p_id text)
returns integer
language sql
stable
set search_path to 'public','private','pg_temp'
as $function$
  select case
    when p_id like 'challenge:%' then coalesce((
      select case mc.rarity
        when 'common' then 1
        when 'uncommon' then 2
        when 'rare' then 3
        when 'epic' then 5
        when 'legendary' then 10
        else 1
      end
      from public.monthly_challenges mc
      where mc.id = nullif(split_part(p_id, ':', 3), '')::uuid
      limit 1
    ), 1)
    else coalesce((select ap.points from public.achievement_points ap where ap.achievement_id = p_id), 1)
  end;
$function$;
