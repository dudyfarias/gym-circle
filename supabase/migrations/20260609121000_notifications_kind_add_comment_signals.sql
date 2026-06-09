-- Sprint 12.1 — libera os novos kinds de notificação (curtida/resposta de
-- comentário) no CHECK constraint de public.notifications.
--
-- Sem isso, os triggers notify_post_comment (caso reply) e notify_comment_like
-- falham no INSERT em notifications e, por serem AFTER INSERT, DERRUBAM a
-- transação inteira — ou seja, o próprio comentário/curtida nem é gravado.
-- Descoberto em teste de trigger (rollback) antes de ir pra produção.

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind = any (array[
    'like','comment','comment_like','comment_reply','follow','mention',
    'follow_request','story_like','story_reply','new_message','post_tag','story_tag'
  ]::text[]));
