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
