-- Catálogo comunitário de musculação.
--
-- Objetivos:
-- 1. permitir montar planilhas por grupo muscular;
-- 2. reaproveitar explicações e vídeos de exercícios/técnicas;
-- 3. aceitar contribuições de usuários sem dar UPDATE no catálogo global;
-- 4. manter compatibilidade com workout_plans.exercises (JSONB).

create or replace function public.workout_catalog_slug(value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select trim(
    both '-' from regexp_replace(
      translate(
        lower(trim(value)),
        'áàâãäéèêëíìîïóòôõöúùûüçñ',
        'aaaaaeeeeiiiiooooouuuucn'
      ),
      '[^a-z0-9]+',
      '-',
      'g'
    )
  );
$$;

create table if not exists public.workout_muscle_groups (
  slug text primary key,
  name_pt text not null,
  name_en text not null,
  icon_key text not null default 'dumbbell',
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  constraint workout_muscle_groups_slug_check
    check (slug = public.workout_catalog_slug(slug) and length(slug) between 2 and 48),
  constraint workout_muscle_groups_name_pt_check
    check (length(trim(name_pt)) between 2 and 80),
  constraint workout_muscle_groups_name_en_check
    check (length(trim(name_en)) between 2 and 80)
);

create table if not exists public.workout_technique_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_pt text not null,
  name_en text not null,
  aliases text[] not null default '{}',
  summary_pt text not null,
  summary_en text not null,
  instructions_pt text[] not null default '{}',
  instructions_en text[] not null default '{}',
  video_url text,
  video_search_query text,
  status text not null default 'approved'
    check (status in ('approved', 'community', 'rejected')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_technique_catalog_slug_check
    check (slug = public.workout_catalog_slug(slug) and length(slug) between 1 and 80),
  constraint workout_technique_catalog_name_check
    check (length(trim(name_pt)) between 1 and 100),
  constraint workout_technique_catalog_video_url_check
    check (video_url is null or video_url ~ '^https://')
);

create table if not exists public.workout_exercise_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_pt text not null,
  name_en text not null,
  aliases text[] not null default '{}',
  primary_muscle_group_slug text not null
    references public.workout_muscle_groups(slug),
  secondary_muscle_group_slugs text[] not null default '{}',
  equipment text[] not null default '{}',
  description_pt text not null,
  description_en text not null,
  instructions_pt text[] not null default '{}',
  instructions_en text[] not null default '{}',
  video_url text,
  video_search_query text,
  status text not null default 'approved'
    check (status in ('approved', 'community', 'rejected')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_exercise_catalog_slug_check
    check (slug = public.workout_catalog_slug(slug) and length(slug) between 2 and 100),
  constraint workout_exercise_catalog_name_check
    check (length(trim(name_pt)) between 2 and 140),
  constraint workout_exercise_catalog_video_url_check
    check (video_url is null or video_url ~ '^https://')
);

create index if not exists workout_exercise_catalog_group_idx
  on public.workout_exercise_catalog (primary_muscle_group_slug, name_pt);

create index if not exists workout_exercise_catalog_secondary_groups_idx
  on public.workout_exercise_catalog using gin (secondary_muscle_group_slugs);

create index if not exists workout_exercise_catalog_aliases_idx
  on public.workout_exercise_catalog using gin (aliases);

create index if not exists workout_technique_catalog_aliases_idx
  on public.workout_technique_catalog using gin (aliases);

alter table public.workout_muscle_groups enable row level security;
alter table public.workout_exercise_catalog enable row level security;
alter table public.workout_technique_catalog enable row level security;

drop policy if exists workout_muscle_groups_read on public.workout_muscle_groups;
create policy workout_muscle_groups_read
  on public.workout_muscle_groups for select
  to anon, authenticated
  using (true);

drop policy if exists workout_exercise_catalog_read on public.workout_exercise_catalog;
create policy workout_exercise_catalog_read
  on public.workout_exercise_catalog for select
  to anon, authenticated
  using (status in ('approved', 'community'));

drop policy if exists workout_technique_catalog_read on public.workout_technique_catalog;
create policy workout_technique_catalog_read
  on public.workout_technique_catalog for select
  to anon, authenticated
  using (status in ('approved', 'community'));

grant select on public.workout_muscle_groups to anon, authenticated;
grant select on public.workout_exercise_catalog to anon, authenticated;
grant select on public.workout_technique_catalog to anon, authenticated;

-- Contribuições passam por RPC SECURITY DEFINER: o cliente não recebe INSERT,
-- UPDATE ou DELETE direto e nunca consegue aprovar/alterar o catálogo global.
create or replace function public.submit_workout_exercise(
  p_name text,
  p_primary_muscle_group_slug text default 'other',
  p_description text default null
)
returns public.workout_exercise_catalog
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_slug text;
  v_group_slug text;
  v_existing public.workout_exercise_catalog;
  v_result public.workout_exercise_catalog;
begin
  if v_user_id is null then
    raise exception 'auth_required';
  end if;
  if length(v_name) < 2 or length(v_name) > 140 then
    raise exception 'invalid_exercise_name';
  end if;

  v_slug := public.workout_catalog_slug(v_name);
  select *
  into v_existing
  from public.workout_exercise_catalog
  where slug = v_slug
    and status in ('approved', 'community')
  limit 1;
  if found then
    return v_existing;
  end if;

  select slug
  into v_group_slug
  from public.workout_muscle_groups
  where slug = coalesce(nullif(trim(p_primary_muscle_group_slug), ''), 'other');
  v_group_slug := coalesce(v_group_slug, 'other');

  insert into public.workout_exercise_catalog (
    slug,
    name_pt,
    name_en,
    primary_muscle_group_slug,
    description_pt,
    description_en,
    video_search_query,
    status,
    created_by
  )
  values (
    v_slug,
    v_name,
    v_name,
    v_group_slug,
    coalesce(
      nullif(trim(p_description), ''),
      'Exercício adicionado pela comunidade. Revise a execução e ajuste a carga com segurança.'
    ),
    coalesce(
      nullif(trim(p_description), ''),
      'Community-added exercise. Review the movement and choose a safe load.'
    ),
    v_name || ' execução correta',
    'community',
    v_user_id
  )
  returning * into v_result;

  return v_result;
end;
$$;

create or replace function public.submit_workout_technique(
  p_name text,
  p_summary text default null
)
returns public.workout_technique_catalog
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_slug text;
  v_existing public.workout_technique_catalog;
  v_result public.workout_technique_catalog;
begin
  if v_user_id is null then
    raise exception 'auth_required';
  end if;
  if length(v_name) < 1 or length(v_name) > 100 then
    raise exception 'invalid_technique_name';
  end if;

  v_slug := public.workout_catalog_slug(v_name);
  select *
  into v_existing
  from public.workout_technique_catalog
  where slug = v_slug
    and status in ('approved', 'community')
  limit 1;
  if found then
    return v_existing;
  end if;

  insert into public.workout_technique_catalog (
    slug,
    name_pt,
    name_en,
    summary_pt,
    summary_en,
    video_search_query,
    status,
    created_by
  )
  values (
    v_slug,
    v_name,
    v_name,
    coalesce(
      nullif(trim(p_summary), ''),
      'Técnica adicionada pela comunidade. Use com controle e sem comprometer a execução.'
    ),
    coalesce(
      nullif(trim(p_summary), ''),
      'Community-added technique. Use it with control and without compromising form.'
    ),
    v_name || ' musculação como fazer',
    'community',
    v_user_id
  )
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.submit_workout_exercise(text, text, text) from public;
revoke all on function public.submit_workout_technique(text, text) from public;
grant execute on function public.submit_workout_exercise(text, text, text) to authenticated;
grant execute on function public.submit_workout_technique(text, text) to authenticated;

insert into public.workout_muscle_groups
  (slug, name_pt, name_en, icon_key, sort_order)
values
  ('chest', 'Peito', 'Chest', 'chest', 10),
  ('back', 'Costas', 'Back', 'back', 20),
  ('shoulders', 'Ombros', 'Shoulders', 'shoulders', 30),
  ('biceps', 'Bíceps', 'Biceps', 'arm', 40),
  ('triceps', 'Tríceps', 'Triceps', 'arm', 50),
  ('forearms', 'Antebraços', 'Forearms', 'arm', 60),
  ('trapezius', 'Trapézio', 'Trapezius', 'shoulders', 70),
  ('quadriceps', 'Quadríceps', 'Quadriceps', 'leg', 80),
  ('hamstrings', 'Posterior de coxa', 'Hamstrings', 'leg', 90),
  ('glutes', 'Glúteos', 'Glutes', 'glutes', 100),
  ('calves', 'Panturrilhas', 'Calves', 'leg', 110),
  ('adductors', 'Adutores', 'Adductors', 'leg', 120),
  ('abdomen', 'Abdômen', 'Core', 'core', 130),
  ('mobility', 'Mobilidade e aquecimento', 'Mobility & warm-up', 'mobility', 140),
  ('other', 'Outros', 'Other', 'dumbbell', 999)
on conflict (slug) do update set
  name_pt = excluded.name_pt,
  name_en = excluded.name_en,
  icon_key = excluded.icon_key,
  sort_order = excluded.sort_order;

insert into public.workout_technique_catalog (
  slug,
  name_pt,
  name_en,
  aliases,
  summary_pt,
  summary_en,
  instructions_pt,
  instructions_en,
  video_search_query,
  status
)
values
  (
    'falha',
    'Até a falha',
    'To failure',
    array['F', 'falha', 'failure'],
    'Continue a série até não conseguir completar outra repetição com técnica segura.',
    'Continue until you cannot complete another repetition with safe form.',
    array[
      'Use uma carga que permita manter a execução controlada.',
      'Pare quando não conseguir completar outra repetição sem perder a técnica.',
      'Prefira exercícios com saída segura ou use um parceiro quando necessário.'
    ],
    array[
      'Use a load that lets you keep the movement controlled.',
      'Stop when another repetition would require breaking form.',
      'Prefer exercises with a safe exit or use a spotter when needed.'
    ],
    'treino até a falha execução segura',
    'approved'
  ),
  (
    'bi-set',
    'Bi-Set',
    'Bi-set',
    array['bi set', 'biset', 'super série', 'superset'],
    'Dois exercícios executados em sequência, sem descanso entre eles.',
    'Two exercises performed back-to-back without resting between them.',
    array[
      'Faça o primeiro exercício.',
      'Passe imediatamente ao segundo.',
      'Descanse apenas depois de completar os dois.'
    ],
    array[
      'Complete the first exercise.',
      'Move immediately to the second.',
      'Rest only after completing both.'
    ],
    'bi set musculação como fazer',
    'approved'
  ),
  (
    'drop-set',
    'Drop-Set',
    'Drop set',
    array['drop', 'drops', 'drop set', 'drop-set'],
    'Após a série principal, reduza a carga e continue sem descanso.',
    'After the main set, reduce the load and continue without resting.',
    array[
      'Complete as repetições da carga inicial.',
      'Reduza a carga de forma rápida e segura.',
      'Continue pelas quedas indicadas sem comprometer a execução.'
    ],
    array[
      'Complete the repetitions at the initial load.',
      'Reduce the load quickly and safely.',
      'Continue for the prescribed drops without sacrificing form.'
    ],
    'drop set musculação como fazer',
    'approved'
  ),
  (
    'rest-pause',
    'Rest ’n’ Pause',
    'Rest-pause',
    array['rest pause', 'rest n pause', 'rest ''n'' pause'],
    'Faça uma pausa curta dentro da série e retome para obter repetições adicionais.',
    'Take a short break within the set, then resume for additional repetitions.',
    array[
      'Chegue perto da falha mantendo o controle.',
      'Descanse cerca de 10 a 20 segundos.',
      'Retome a série pelo número de blocos indicado.'
    ],
    array[
      'Work close to failure while keeping control.',
      'Rest for about 10 to 20 seconds.',
      'Resume for the prescribed number of blocks.'
    ],
    'rest pause musculação como fazer',
    'approved'
  ),
  (
    'gvt',
    'GVT',
    'German Volume Training',
    array['german volume training', '10x10'],
    'Método de alto volume, normalmente com 10 séries de 10 repetições.',
    'A high-volume method, commonly performed as 10 sets of 10 repetitions.',
    array[
      'Escolha uma carga submáxima que possa ser sustentada.',
      'Mantenha o mesmo padrão de movimento nas séries.',
      'Respeite o intervalo planejado e reduza a carga se a técnica piorar.'
    ],
    array[
      'Choose a submaximal load you can sustain.',
      'Keep the same movement pattern across sets.',
      'Follow the planned rest and reduce load if form deteriorates.'
    ],
    'GVT 10x10 musculação como fazer',
    'approved'
  ),
  (
    'fst-7',
    'FST-7',
    'FST-7',
    array['fst7', '7x10'],
    'Sete séries com intervalos curtos, usadas para elevar o volume no exercício final.',
    'Seven sets with short rests, used to increase volume on a finishing exercise.',
    array[
      'Use uma carga que permita completar as sete séries com controle.',
      'Mantenha intervalos curtos e consistentes.',
      'Interrompa se a amplitude ou a técnica se deteriorar.'
    ],
    array[
      'Use a load that allows seven controlled sets.',
      'Keep rest intervals short and consistent.',
      'Stop if range of motion or form deteriorates.'
    ],
    'FST-7 musculação como fazer',
    'approved'
  ),
  (
    'tempo',
    'Por tempo',
    'Timed set',
    array['segundos', '30s', 'tempo'],
    'A série é medida por duração em vez de número de repetições.',
    'The set is measured by duration instead of repetition count.',
    array[
      'Inicie o cronômetro com a primeira repetição ou posição.',
      'Mantenha o movimento ou a posição pelo tempo indicado.',
      'Pare antes se não conseguir manter uma execução segura.'
    ],
    array[
      'Start the timer with the first repetition or position.',
      'Maintain the movement or position for the prescribed time.',
      'Stop early if you cannot maintain safe form.'
    ],
    'série por tempo musculação como fazer',
    'approved'
  ),
  (
    'tradicional',
    'Série tradicional',
    'Straight set',
    array['normal', 'tradicional'],
    'Séries com repetições definidas e descanso entre cada uma.',
    'Sets with a prescribed repetition target and rest between each set.',
    array[
      'Complete as repetições planejadas com controle.',
      'Descanse pelo intervalo definido.',
      'Ajuste a carga se não conseguir preservar a técnica.'
    ],
    array[
      'Complete the prescribed repetitions with control.',
      'Rest for the planned interval.',
      'Adjust the load if you cannot preserve form.'
    ],
    'série tradicional musculação execução',
    'approved'
  )
on conflict (slug) do update set
  name_pt = excluded.name_pt,
  name_en = excluded.name_en,
  aliases = excluded.aliases,
  summary_pt = excluded.summary_pt,
  summary_en = excluded.summary_en,
  instructions_pt = excluded.instructions_pt,
  instructions_en = excluded.instructions_en,
  video_search_query = excluded.video_search_query,
  status = excluded.status,
  updated_at = now();

with seed (
  name_pt,
  slug,
  muscle_group,
  secondary_groups,
  equipment,
  description_pt
) as (
  values
    ('Remada Alta Smith', 'remada-alta-smith', 'trapezius', array['shoulders'], array['smith'], 'Puxada vertical no Smith para trapézio e deltoides, mantendo a barra próxima ao corpo.'),
    ('Encolhimento Smith Anterior', 'encolhimento-smith-anterior', 'trapezius', array['shoulders'], array['smith'], 'Encolhimento de ombros guiado no Smith com a barra à frente do corpo.'),
    ('Infra', 'infra', 'abdomen', array[]::text[], array['bodyweight'], 'Exercício abdominal com ênfase na porção inferior e no controle da pelve.'),
    ('Gêmeos Leg Press', 'gemeos-leg-press', 'calves', array[]::text[], array['leg press'], 'Flexão plantar no leg press para trabalhar as panturrilhas.'),
    ('Gêmeos Sentado Smith', 'gemeos-sentado-smith', 'calves', array[]::text[], array['smith'], 'Elevação de panturrilhas sentado com resistência do Smith.'),
    ('Gêmeos Em Pé Máquina', 'gemeos-em-pe-maquina', 'calves', array[]::text[], array['machine'], 'Elevação de panturrilhas em pé na máquina, com amplitude controlada.'),
    ('Cadeira Extensora + Mesa Flexora', 'cadeira-extensora-mesa-flexora', 'quadriceps', array['hamstrings'], array['machine'], 'Combinação de extensão e flexão de joelhos para quadríceps e posteriores.'),
    ('Agachamento Halteres', 'agachamento-halteres', 'quadriceps', array['glutes', 'hamstrings'], array['dumbbells'], 'Agachamento com halteres, mantendo tronco estável e joelhos alinhados.'),
    ('Cadeira Adutora', 'cadeira-adutora', 'adductors', array[]::text[], array['machine'], 'Adução de quadril na máquina para a musculatura interna das coxas.'),
    ('Puxada Vertical Com Triângulo', 'puxada-vertical-com-triangulo', 'back', array['biceps'], array['cable'], 'Puxada vertical com pegador triângulo, conduzindo os cotovelos para baixo.'),
    ('Remada Unilateral Peg Supinada', 'remada-unilateral-peg-supinada', 'back', array['biceps'], array['cable'], 'Remada unilateral com pegada supinada e controle da escápula.'),
    ('Pull-Down Barra', 'pull-down-barra', 'back', array['biceps'], array['cable'], 'Puxada na polia com barra para dorsais, sem embalar o tronco.'),
    ('Supino Declinado Halteres', 'supino-declinado-halteres', 'chest', array['triceps', 'shoulders'], array['dumbbells', 'bench'], 'Supino em banco declinado com halteres e movimento controlado.'),
    ('Crucifixo Inclinado Halteres + Supino Inclinado Halteres', 'crucifixo-inclinado-supino-inclinado-halteres', 'chest', array['shoulders', 'triceps'], array['dumbbells', 'bench'], 'Combinação de crucifixo e supino inclinados com halteres.'),
    ('Crucifixo Declinado', 'crucifixo-declinado', 'chest', array['shoulders'], array['dumbbells', 'bench'], 'Adução dos braços em banco declinado com cotovelos levemente flexionados.'),
    ('Oblíquos', 'obliquos', 'abdomen', array[]::text[], array['bodyweight'], 'Movimento para a musculatura lateral do abdômen, evitando tração no pescoço.'),
    ('Rosca Scott Máquina + Rosca Direta Halteres', 'rosca-scott-maquina-rosca-direta-halteres', 'biceps', array['forearms'], array['machine', 'dumbbells'], 'Combinação de rosca Scott na máquina e rosca direta com halteres.'),
    ('Rosca Direta Cross', 'rosca-direta-cross', 'biceps', array['forearms'], array['cable'], 'Flexão de cotovelos na polia mantendo os braços estáveis.'),
    ('Rosca Concentrada', 'rosca-concentrada', 'biceps', array['forearms'], array['dumbbell'], 'Rosca unilateral com o braço apoiado para reduzir compensações.'),
    ('Rosca Inversa Cross', 'rosca-inversa-cross', 'forearms', array['biceps'], array['cable'], 'Rosca na polia com pegada pronada para antebraços e bíceps.'),
    ('Flexão de Punho Barra Sentado', 'flexao-de-punho-barra-sentado', 'forearms', array[]::text[], array['barbell'], 'Flexão de punhos sentado com antebraços apoiados.'),
    ('Rotacional de Punho', 'rotacional-de-punho', 'forearms', array[]::text[], array['free weight'], 'Pronação e supinação controladas do antebraço.'),
    ('Manguito Rotador Externo Halteres', 'manguito-rotador-externo-halteres', 'shoulders', array[]::text[], array['dumbbells'], 'Rotação externa de ombro com carga leve e cotovelo estabilizado.'),
    ('Elevação Lateral Sentado Halteres', 'elevacao-lateral-sentado-halteres', 'shoulders', array['trapezius'], array['dumbbells'], 'Elevação lateral sentada para deltoides, sem elevar excessivamente os ombros.'),
    ('Rosca Francesa Anilha', 'rosca-francesa-anilha', 'triceps', array['shoulders'], array['plate'], 'Extensão de cotovelos acima da cabeça segurando uma anilha.'),
    ('Tríceps Pulley Peg Supinada + Tríceps Pulley Peg Pronada', 'triceps-pulley-supinada-pronada', 'triceps', array['forearms'], array['cable'], 'Combinação de extensões de cotovelo na polia com pegadas supinada e pronada.'),
    ('Mergulho', 'mergulho', 'triceps', array['chest', 'shoulders'], array['bodyweight'], 'Flexão e extensão dos cotovelos nas paralelas ou banco, com ombros controlados.'),
    ('Alongamento', 'alongamento', 'mobility', array[]::text[], array['bodyweight'], 'Preparação de mobilidade definida para a sessão.'),
    ('Aquecimento', 'aquecimento', 'mobility', array[]::text[], array['bodyweight'], 'Série leve para preparar articulações e padrão de movimento.'),
    ('Tríceps Testa Barra W', 'triceps-testa-barra-w', 'triceps', array[]::text[], array['ez bar', 'bench'], 'Extensão de cotovelos deitado com barra W e braços estáveis.'),
    ('Tríceps Polia Barra Reta', 'triceps-polia-barra-reta', 'triceps', array['forearms'], array['cable'], 'Extensão de cotovelos na polia com barra reta.'),
    ('Rosca Direta Barra W', 'rosca-direta-barra-w', 'biceps', array['forearms'], array['ez bar'], 'Flexão de cotovelos com barra W sem projetar os ombros.'),
    ('Bíceps Alternado com Giro', 'biceps-alternado-com-giro', 'biceps', array['forearms'], array['dumbbells'], 'Rosca alternada com supinação progressiva do antebraço.'),
    ('Bíceps Martelo', 'biceps-martelo', 'biceps', array['forearms'], array['dumbbells'], 'Rosca com pegada neutra para bíceps, braquial e antebraço.'),
    ('Crucifixo Inverso Máquina', 'crucifixo-inverso-maquina', 'shoulders', array['back', 'trapezius'], array['machine'], 'Abertura inversa na máquina para deltoide posterior e estabilizadores das escápulas.'),
    ('Aquecimento Manguito Polia', 'aquecimento-manguito-polia', 'mobility', array['shoulders'], array['cable'], 'Rotação leve na polia para preparar o manguito rotador.'),
    ('Barra Fixa (Graviton)', 'barra-fixa-graviton', 'back', array['biceps'], array['assisted pull-up machine'], 'Barra fixa assistida, conduzindo o peito em direção à barra.'),
    ('Puxada Polia Triângulo', 'puxada-polia-triangulo', 'back', array['biceps'], array['cable'], 'Puxada na polia com pegador triângulo e escápulas controladas.'),
    ('Pullover', 'pullover', 'back', array['chest', 'triceps'], array['dumbbell', 'bench'], 'Movimento de ombro em arco, mantendo costelas e tronco controlados.'),
    ('Remada Máquina Neutra', 'remada-maquina-neutra', 'back', array['biceps'], array['machine'], 'Remada guiada com pegada neutra e retração das escápulas.'),
    ('Remada Curva Barra', 'remada-curva-barra', 'back', array['biceps', 'hamstrings'], array['barbell'], 'Remada inclinada com barra e coluna neutra.'),
    ('Remada Unilateral Halter (Serrote)', 'remada-unilateral-halter-serrote', 'back', array['biceps'], array['dumbbell', 'bench'], 'Remada unilateral apoiada com halter, sem girar excessivamente o tronco.'),
    ('Agachamento Smith', 'agachamento-smith', 'quadriceps', array['glutes', 'hamstrings'], array['smith'], 'Agachamento guiado no Smith com pés e joelhos alinhados.'),
    ('Leg Press 45° + Passada', 'leg-press-45-passada', 'quadriceps', array['glutes', 'hamstrings'], array['leg press', 'bodyweight'], 'Combinação de leg press 45 graus e passada.'),
    ('Cadeira Extensora', 'cadeira-extensora', 'quadriceps', array[]::text[], array['machine'], 'Extensão de joelhos na máquina com controle na subida e na descida.'),
    ('Mesa Flexora', 'mesa-flexora', 'hamstrings', array['calves'], array['machine'], 'Flexão de joelhos deitado na máquina para posteriores de coxa.'),
    ('Cadeira Flexora', 'cadeira-flexora', 'hamstrings', array['calves'], array['machine'], 'Flexão de joelhos sentado na máquina para posteriores de coxa.'),
    ('Meio Terra com Barra', 'meio-terra-com-barra', 'hamstrings', array['glutes', 'back'], array['barbell'], 'Levantamento com dobradiça de quadril e barra, mantendo a coluna neutra.'),
    ('Gêmeos no Leg', 'gemeos-no-leg', 'calves', array[]::text[], array['leg press'], 'Flexão plantar no leg press usando a plataforma como apoio.'),
    ('Aquecimento Crucifixo Máquina', 'aquecimento-crucifixo-maquina', 'mobility', array['chest'], array['machine'], 'Série leve no crucifixo máquina para preparar peitoral e ombros.'),
    ('Crucifixo Máquina', 'crucifixo-maquina', 'chest', array['shoulders'], array['machine'], 'Adução horizontal dos braços na máquina com peito apoiado.'),
    ('Supino Máquina', 'supino-maquina', 'chest', array['triceps', 'shoulders'], array['machine'], 'Empurrada horizontal guiada para peitoral, tríceps e deltoides.'),
    ('Crossover', 'crossover', 'chest', array['shoulders'], array['cable'], 'Adução dos braços nas polias com cotovelos levemente flexionados.'),
    ('Desenvolvimento Máquina', 'desenvolvimento-maquina', 'shoulders', array['triceps'], array['machine'], 'Empurrada vertical guiada para deltoides e tríceps.'),
    ('Elevação Lateral', 'elevacao-lateral', 'shoulders', array['trapezius'], array['dumbbells'], 'Elevação dos braços para os lados com carga controlada.')
)
insert into public.workout_exercise_catalog (
  name_pt,
  name_en,
  slug,
  primary_muscle_group_slug,
  secondary_muscle_group_slugs,
  equipment,
  description_pt,
  description_en,
  video_search_query,
  status
)
select
  name_pt,
  name_pt,
  slug,
  muscle_group,
  secondary_groups,
  equipment,
  description_pt,
  description_pt,
  name_pt || ' execução correta',
  'approved'
from seed
on conflict (slug) do update set
  name_pt = excluded.name_pt,
  primary_muscle_group_slug = excluded.primary_muscle_group_slug,
  secondary_muscle_group_slugs = excluded.secondary_muscle_group_slugs,
  equipment = excluded.equipment,
  description_pt = excluded.description_pt,
  video_search_query = excluded.video_search_query,
  status = excluded.status,
  updated_at = now();

comment on table public.workout_muscle_groups is
  'Grupos musculares usados para explorar e montar planilhas.';
comment on table public.workout_exercise_catalog is
  'Catálogo aprovado/comunitário de exercícios, explicações e demonstrações.';
comment on table public.workout_technique_catalog is
  'Catálogo aprovado/comunitário de técnicas de treino, explicações e demonstrações.';
