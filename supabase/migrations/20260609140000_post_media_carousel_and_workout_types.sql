-- Sprint 13 — carrossel multi-mídia + até 5 tags de treino
--
-- post_media: mídias ordenadas do carrossel (até 10, foto+vídeo misturado).
-- posts.* continua sendo a CAPA (item 0) → feed/grids/recap/stories antigos não
-- quebram (leem a capa). Posts antigos sem linhas em post_media = 1 mídia.
-- workout_types[]: até 5 tags; workout_type (singular) continua = primeira tag.

-- 1. workout_types[]
alter table public.posts add column if not exists workout_types text[];

-- 2. post_media
create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  position integer not null,
  media_type text not null default 'image',
  image_url text not null,
  thumbnail_url text,
  poster_url text,
  blur_data_url text,
  media_width integer,
  media_height integer,
  media_duration_seconds numeric,
  created_at timestamptz not null default now(),
  unique (post_id, position)
);
create index if not exists idx_post_media_post on public.post_media(post_id, position);

alter table public.post_media enable row level security;

-- SELECT: vê as mídias se pode ver o post (mesma regra de posts_select_visible).
create policy post_media_select on public.post_media
  for select using (
    exists (
      select 1 from public.posts p
      where p.id = post_media.post_id
        and private.can_view_profile_posts(p.user_id)
    )
  );

-- INSERT/DELETE: só o dono do post.
create policy post_media_insert on public.post_media
  for insert with check (
    exists (
      select 1 from public.posts p
      where p.id = post_media.post_id and p.user_id = (select auth.uid())
    )
  );
create policy post_media_delete on public.post_media
  for delete using (
    exists (
      select 1 from public.posts p
      where p.id = post_media.post_id and p.user_id = (select auth.uid())
    )
  );

grant select, insert, delete on public.post_media to authenticated;
grant select on public.post_media to anon;
