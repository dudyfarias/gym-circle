-- Legendas por mídia no carrossel.
-- Preparada para revisão. Não aplicar sem gate de release explícito.
--
-- As legendas vivem FORA de post_media porque o app iOS publicado apaga e
-- reinsere post_media direto na tabela (from("post_media").delete() seguido de
-- .insert()), em DUAS requisições HTTP separadas, e não conhece legendas.
-- Uma coluna em post_media seria destruída por esse delete cego, e nenhuma RPC
-- consegue interceptar — o app publicado não chama RPC nenhuma nesse caminho.
--
-- Consequência que atravessa o arquivo inteiro: entre o delete e o insert do
-- cliente legado existe um instante em que post_media está VAZIA. Nenhum
-- trigger pode reagir a esse estado; se reagir, é ele quem destrói o dado.

-- 1) Tabela ------------------------------------------------------------------
create table if not exists public.post_media_caption (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  media_key text not null,
  caption text not null,
  -- Marcado quando a mídia sai do post (ver bloco (3) de
  -- replace_social_post_media). É o relógio da purga de órfãs: usar updated_at
  -- daria janela zero, porque ele só muda quando o TEXTO muda — uma legenda
  -- escrita há um ano e órfã desde hoje já seria elegível na 1ª execução.
  detached_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_media_caption_key unique (post_id, media_key),
  constraint post_media_caption_length_check check (char_length(caption) <= 300)
);

-- unique (post_id, media_key) já cobre o índice da FK (post_id é a coluna
-- líder). Não criar índice extra.

-- media_key é a URL sem query string. Hoje as URLs de mídia não têm
-- cache-buster, mas o projeto já anexa um em avatares (ProfilesService.swift);
-- normalizar custa uma linha e evita que a correspondência quebre em silêncio.
create or replace function private.normalize_media_key(p_url text)
returns text
language sql
immutable
set search_path = ''
as $$
  select split_part(coalesce(p_url, ''), '?', 1);
$$;

-- 2) RLS ---------------------------------------------------------------------
-- Espelha post_media (20260609140000:29-58), MAS com UPDATE: post_media não
-- tem política nem grant de update, e o upsert por media_key precisa.
alter table public.post_media_caption enable row level security;

drop policy if exists post_media_caption_select on public.post_media_caption;
create policy post_media_caption_select on public.post_media_caption
  for select using (
    exists (
      select 1 from public.posts p
      where p.id = post_media_caption.post_id
        and private.can_view_profile_posts(p.user_id)
    )
  );

drop policy if exists post_media_caption_insert on public.post_media_caption;
create policy post_media_caption_insert on public.post_media_caption
  for insert with check (
    exists (
      select 1 from public.posts p
      where p.id = post_media_caption.post_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists post_media_caption_update on public.post_media_caption;
create policy post_media_caption_update on public.post_media_caption
  for update using (
    exists (
      select 1 from public.posts p
      where p.id = post_media_caption.post_id
        and p.user_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.posts p
      where p.id = post_media_caption.post_id
        and p.user_id = (select auth.uid())
    )
  );

drop policy if exists post_media_caption_delete on public.post_media_caption;
create policy post_media_caption_delete on public.post_media_caption
  for delete using (
    exists (
      select 1 from public.posts p
      where p.id = post_media_caption.post_id
        and p.user_id = (select auth.uid())
    )
  );

grant select, insert, update, delete on public.post_media_caption to authenticated;
grant select on public.post_media_caption to anon;

-- 3) Touch de updated_at + realtime ------------------------------------------
-- Idempotentes: a migration é aplicada manualmente e uma falha no meio deixa
-- estado parcial; a retentativa precisa passar.
create or replace function private.tg_touch_post_media_caption()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists post_media_caption_touch on public.post_media_caption;
create trigger post_media_caption_touch
  before update on public.post_media_caption
  for each row execute function private.tg_touch_post_media_caption();

do $$
begin
  alter publication supabase_realtime add table public.post_media_caption;
exception when duplicate_object then null;
end $$;

comment on table public.post_media_caption is
  'Legenda por mídia do carrossel, chaveada por (post_id, URL normalizada). Fica fora de post_media para sobreviver ao delete cego do app iOS publicado.';

-- 4) caption_mode ------------------------------------------------------------
alter table public.posts
  add column if not exists caption_mode text not null default 'single';

do $$
begin
  alter table public.posts add constraint posts_caption_mode_check
    check (caption_mode in ('single', 'per_media'));
exception when duplicate_object then null;
end $$;

comment on column public.posts.caption_mode is
  'single = legenda única em posts.caption; per_media = uma legenda por mídia em post_media_caption (posts.caption vira espelho da 1a legenda).';

-- 5) Espelho posts.caption ---------------------------------------------------
-- Todo leitor que ignora caption_mode renderiza posts.caption: o app iOS
-- publicado, a grade do perfil, notificações, compartilhamento e o topo do
-- sheet de comentários. O espelho mantém esses lugares mostrando algo
-- verdadeiro. Ele é sempre DERIVADO, nunca autoral.
create or replace function private.sync_post_caption_mirror(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode text;
  v_media_count integer;
  v_first text;
begin
  select caption_mode into v_mode from public.posts where id = p_post_id;
  if v_mode is distinct from 'per_media' then
    return;
  end if;

  select count(*) into v_media_count
    from public.post_media where post_id = p_post_id;

  -- Janela do cliente legado (delete já rodou, insert ainda não): não mexer.
  if v_media_count = 0 then
    return;
  end if;

  select c.caption
    into v_first
    from public.post_media m
    join public.post_media_caption c
      on c.post_id = m.post_id
     and c.media_key = private.normalize_media_key(m.image_url)
   where m.post_id = p_post_id
     and nullif(btrim(c.caption), '') is not null
   order by m.position
   limit 1;

  -- Só sobrescreve quando há legenda de verdade. Zerar aqui deixaria o post
  -- mudo se depois o cliente legado reduzisse o carrossel a 1 mídia (o
  -- fallback de estado degenerado cairia num caption vazio). A limpeza do
  -- espelho quando o usuário apaga TODAS as legendas mora em
  -- replace_social_post_media, que conhece o conjunto final e a intenção.
  if v_first is null then
    return;
  end if;

  update public.posts
     set caption = v_first
   where id = p_post_id
     and caption is distinct from v_first;
end;
$$;

-- 6) Triggers do espelho -----------------------------------------------------
-- Em trigger de linha, NEW não existe num DELETE: referenciar new.post_id
-- levanta 'record "new" is not assigned yet' ANTES de qualquer coalesce.
-- Ramificar por TG_OP é obrigatório.
create or replace function private.tg_sync_caption_mirror()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform private.sync_post_caption_mirror(old.post_id);
    return old;
  end if;
  perform private.sync_post_caption_mirror(new.post_id);
  return new;
end;
$$;

drop trigger if exists post_media_caption_sync_mirror on public.post_media_caption;
create trigger post_media_caption_sync_mirror
  after insert or update or delete on public.post_media_caption
  for each row execute function private.tg_sync_caption_mirror();

-- A ordem das mídias define qual é "a primeira legenda", então reordenar muda
-- o espelho mesmo sem nenhuma legenda mudar. APENAS insert: delete é proibido
-- (é a janela do cliente legado).
drop trigger if exists post_media_insert_sync_mirror on public.post_media;
create trigger post_media_insert_sync_mirror
  after insert on public.post_media
  for each row execute function private.tg_sync_caption_mirror();

-- Escrita direta em posts.caption (postService.update escreve na tabela, sem
-- RPC) ou troca de modo. pg_trigger_depth() = 0 evita a recursão: a função
-- escreve em posts.caption a partir de profundidade >= 1, e este trigger só
-- dispara em profundidade 0. Sem o guarda: stack depth limit exceeded na
-- primeira edição de legenda.
create or replace function private.tg_sync_caption_mirror_posts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.sync_post_caption_mirror(new.id);
  return null;
end;
$$;

drop trigger if exists posts_sync_caption_mirror on public.posts;
create trigger posts_sync_caption_mirror
  after update of caption, caption_mode on public.posts
  for each row when (pg_trigger_depth() = 0)
  execute function private.tg_sync_caption_mirror_posts();

-- NÃO existe trigger de "rebaixar para single": seria código morto, porque
-- replace_social_post_media só insere em post_media quando media_count > 1 (e
-- o app publicado idem), então um after-insert nunca veria contagem < 2. A
-- regra vive dentro da RPC, que enxerga o conjunto final.

-- 7) RPCs de mídia ----------------------------------------------------------
-- Corpos copiados verbatim de 20260703192608_resilient_media_pipeline.sql
-- (extração programática, sem transcrição manual) + enxerto das legendas.

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

  -- ==== Legendas por mídia (ordem obrigatória) ====
  -- (2) Legendas DEPOIS das mídias: o trigger do espelho exige linhas em
  -- post_media presentes, senão o guarda de "mídia vazia" o impede.
  --
  -- Chave 'caption' AUSENTE = cliente legado (não conhece legendas) ->
  -- PRESERVAR o que já existe. Presente com null/'' = limpar de fato.
  delete from public.post_media_caption c
   where c.post_id = p_post_id
     and exists (
       select 1 from jsonb_array_elements(p_media) as item
        where item ? 'caption'
          and nullif(btrim(coalesce(item ->> 'caption', '')), '') is null
          and private.normalize_media_key(item ->> 'image_url') = c.media_key
     );

  -- distinct on numa subquery NOMEADA: em `distinct on (media_key)` direto
  -- sobre jsonb_array_elements o nome não existe no escopo (os rótulos de
  -- saída seriam ?column?/normalize_media_key/left) e o comando falharia no
  -- parse. A dedup é obrigatória porque a mesma mídia pode repetir no
  -- carrossel; sem ela o ON CONFLICT levanta 21000.
  insert into public.post_media_caption (post_id, media_key, caption, detached_at)
  select distinct on (k.media_key)
    p_post_id, k.media_key, k.caption, null::timestamptz
  from (
    select private.normalize_media_key(e.item ->> 'image_url') as media_key,
           left(btrim(e.item ->> 'caption'), 300)              as caption,
           e.ord
      from jsonb_array_elements(p_media) with ordinality as e(item, ord)
     where e.item ? 'caption'
       and nullif(btrim(coalesce(e.item ->> 'caption', '')), '') is not null
  ) k
  order by k.media_key, k.ord
  on conflict (post_id, media_key) do update
    set caption = excluded.caption,
        detached_at = null
    where public.post_media_caption.caption is distinct from excluded.caption
       or public.post_media_caption.detached_at is not null;

  -- (3) Órfãs: MARCADAS, não apagadas. Se a mesma mídia voltar ao post a
  -- legenda ressuscita (declarado na spec); detached_at é o relógio da purga.
  update public.post_media_caption c
     set detached_at = now()
   where c.post_id = p_post_id
     and c.detached_at is null
     and not exists (
       select 1 from jsonb_array_elements(p_media) as item
        where private.normalize_media_key(item ->> 'image_url') = c.media_key
     );

  -- (3b) Apagou TODAS as legendas: o espelho some junto. O trigger não
  -- distingue "ainda não gravou" de "apagou tudo"; esta instrução distingue,
  -- porque conhece o conjunto final e a intenção do usuário.
  if media_count >= 2
     and not exists (
       select 1 from public.post_media_caption
        where post_id = p_post_id and detached_at is null
     )
     and (select caption_mode from public.posts where id = p_post_id) = 'per_media'
  then
    update public.posts set caption = null
     where id = p_post_id and caption is not null;
  end if;

  -- (4) Menos de 2 mídias -> volta pra single. Aqui, e NÃO em trigger: esta é
  -- a única instrução que enxerga o conjunto final dentro da transação (um
  -- after-insert em post_media nunca veria contagem < 2).
  if media_count < 2 then
    update public.posts set caption_mode = 'single'
     where id = p_post_id and caption_mode = 'per_media';
  end if;

  -- (5) Espelho por último.
  perform private.sync_post_caption_mirror(p_post_id);

end;
$$;


-- create_social_post_with_media NÃO tem insert em post_media: ela delega
-- em `perform private.replace_social_post_media(...)`. Por isso a única
-- mudança aqui é caption_mode no insert de posts — repetir o bloco de
-- legendas gravaria e limparia tudo duas vezes.

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
    caption_mode,
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
    coalesce(nullif(btrim(p_post ->> 'caption_mode'), ''), 'single'),
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

-- create or replace PRESERVA privilégios (ao contrário de drop+create), então
-- os grants abaixo são redundância explícita — e o padrão da casa.
revoke all on function private.replace_social_post_media(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function private.replace_social_post_media(uuid, jsonb)
  to authenticated;

revoke all on function private.create_social_post_with_media(jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function private.create_social_post_with_media(jsonb, jsonb)
  to authenticated;
