-- Permite foto e vídeo nas mensagens diretas do chat.

alter table public.direct_messages
  drop constraint if exists direct_messages_media_type_check;

alter table public.direct_messages
  add constraint direct_messages_media_type_check
    check (media_type is null or media_type in ('image', 'video'));
