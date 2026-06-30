-- Comentários: realtime de DELETE/like confiável + RLS de insert sem brecha.
-- (Auditoria de comentários, 29/jun.)

-- #3c — replica identity FULL: o payload de DELETE/UPDATE no Realtime passa a
-- carregar todas as colunas da linha antiga (post_id em post_comments,
-- comment_id em post_comment_likes). Com replica identity default só vinha a PK,
-- então apagar um comentário NÃO atualizava a lista/contador ao vivo (o handler
-- do cliente exige post_id). Volume baixo nessas tabelas → custo de WAL ok.
alter table public.post_comments replica identity full;
alter table public.post_comment_likes replica identity full;

-- #7 — funde as 2 policies de INSERT permissivas (combinadas por OR, onde a
-- política de autoria SOZINHA contornava a checagem de bloqueio/visibilidade do
-- post) numa só, com AND. Fluxo normal não muda; fecha o insert via API de quem
-- está bloqueado / não pode ver o post.
drop policy if exists post_comments_insert_self on public.post_comments;
drop policy if exists post_comments_insert_not_blocked on public.post_comments;
create policy post_comments_insert_allowed on public.post_comments
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
        from public.posts p
       where p.id = post_comments.post_id
         and private.can_interact_with_user(p.user_id)
         and private.can_view_profile_posts(p.user_id)
    )
  );
