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
