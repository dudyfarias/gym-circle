-- Sprint 12.2 — moderação de comentários pelo dono do post.
--
-- Antes: post_comments_delete_self só permitia o AUTOR do comentário apagar.
-- Agora: autor apaga o próprio OU o dono do post apaga qualquer comentário do
-- seu post (igual Instagram). Policy única — não reintroduz o warning de
-- multiple-permissive policies que a Sprint 9.9.9 limpou. (select auth.uid())
-- mantém o initplan otimizado.

drop policy if exists post_comments_delete_self on public.post_comments;
create policy post_comments_delete_author_or_owner on public.post_comments
  for delete
  using (
    (select auth.uid()) = user_id
    or exists (
      select 1 from public.posts p
      where p.id = post_comments.post_id
        and p.user_id = (select auth.uid())
    )
  );
