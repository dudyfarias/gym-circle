-- Sprint 12.1 — Respostas em comentário + notificações de curtida/resposta
--
-- Contexto: comentários eram flat (sem replies) e curtir um comentário não
-- gerava notificação. Este patch:
--   1. Adiciona parent_comment_id (threading 1 nível, estilo Instagram).
--   2. Estende notify_post_comment() pra tratar reply → notifica o autor do
--      comentário-pai (kind 'comment_reply') em vez do dono do post.
--   3. Cria notify_comment_like() + trigger em post_comment_likes (kind
--      'comment_like'), seguindo o mesmo padrão server-side dos outros sinais.
--
-- Notificações continuam 100% server-side via trigger (SECURITY DEFINER),
-- então o send-push (Edge Function) já dispara push lendo public.notifications.

-- 1. Coluna de threading -------------------------------------------------------
alter table public.post_comments
  add column if not exists parent_comment_id uuid
  references public.post_comments(id) on delete cascade;

-- Índice parcial: só linhas que SÃO respostas (a maioria é top-level).
create index if not exists idx_post_comments_parent
  on public.post_comments(parent_comment_id)
  where parent_comment_id is not null;

-- 2. notify_post_comment: trata reply -----------------------------------------
create or replace function private.notify_post_comment()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_owner uuid;
  v_parent_author uuid;
  v_mention text;
begin
  select user_id into v_owner from public.posts where id = new.post_id;

  if new.parent_comment_id is not null then
    -- É uma resposta: notifica o autor do comentário-pai (não o dono do post,
    -- pra não duplicar — espelha o comportamento do Instagram).
    select user_id into v_parent_author
      from public.post_comments where id = new.parent_comment_id;
    if v_parent_author is not null and v_parent_author <> new.user_id then
      insert into public.notifications (user_id, actor_id, kind, post_id, comment_id, body)
      values (v_parent_author, new.user_id, 'comment_reply', new.post_id, new.id, left(new.body, 140));
    end if;
  else
    -- Comentário de topo: notifica o dono do post (comportamento original).
    if v_owner is not null and v_owner <> new.user_id then
      insert into public.notifications (user_id, actor_id, kind, post_id, comment_id, body)
      values (v_owner, new.user_id, 'comment', new.post_id, new.id, left(new.body, 140));
    end if;
  end if;

  -- @mentions (vale pros dois casos), pulando quem já foi notificado acima.
  for v_mention in
    select distinct lower(m.match[1])
      from regexp_matches(new.body, '@([a-zA-Z0-9_.]{3,32})', 'g') as m(match)
  loop
    insert into public.notifications (user_id, actor_id, kind, post_id, comment_id, body)
    select p.user_id, new.user_id, 'mention', new.post_id, new.id, left(new.body, 140)
      from public.profiles p
     where p.username = v_mention
       and p.user_id <> new.user_id
       and (v_owner is null or p.user_id <> v_owner)
       and (v_parent_author is null or p.user_id <> v_parent_author);
  end loop;
  return new;
end$function$;

-- 3. notify_comment_like + trigger --------------------------------------------
create or replace function private.notify_comment_like()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_author uuid;
  v_post uuid;
begin
  select user_id, post_id into v_author, v_post
    from public.post_comments where id = new.comment_id;
  -- Sem autor (comentário apagado em corrida) ou auto-curtida → silencioso.
  if v_author is null or v_author = new.user_id then
    return new;
  end if;
  insert into public.notifications (user_id, actor_id, kind, post_id, comment_id)
  values (v_author, new.user_id, 'comment_like', v_post, new.comment_id);
  return new;
end$function$;

drop trigger if exists post_comment_likes_after_insert_notify on public.post_comment_likes;
create trigger post_comment_likes_after_insert_notify
  after insert on public.post_comment_likes
  for each row execute function private.notify_comment_like();
