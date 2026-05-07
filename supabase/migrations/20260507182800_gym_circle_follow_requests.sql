-- =====================================================================
-- Follow requests para perfis privados.
-- - profiles.is_private já existe (default false). Quando true, follows
--   inseridos pra esse usuário ficam status='pending' até ele aceitar.
-- - Quando aceito, vira 'accepted' e o grafo volta ao normal.
-- - Notifications ganham kind='follow_request' (separa de 'follow' já aceito).
-- =====================================================================

-- 1. Coluna status em follows
alter table public.follows
  add column if not exists status text not null default 'accepted'
  check (status in ('pending','accepted'));

-- Linhas antigas continuam como 'accepted' (default já cuidou). Defensivo:
update public.follows set status = 'accepted' where status is null;

-- 2. Trigger BEFORE INSERT decide status com base em is_private do alvo
create or replace function private.set_follow_status()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_is_private boolean;
begin
  if TG_OP = 'INSERT' then
    select is_private into v_is_private
      from public.profiles where user_id = new.following_id;
    if coalesce(v_is_private, false) then
      new.status := 'pending';
    else
      new.status := 'accepted';
    end if;
  end if;
  return new;
end$$;

drop trigger if exists follows_before_insert_set_status on public.follows;
create trigger follows_before_insert_set_status
  before insert on public.follows
  for each row execute function private.set_follow_status();

-- 3. Permitir UPDATE pelo alvo (aceitar request)
drop policy if exists "follows_update_target" on public.follows;
create policy "follows_update_target" on public.follows
  for update to authenticated
  using ((select auth.uid()) = following_id)
  with check ((select auth.uid()) = following_id and status = 'accepted');

-- 4. Permitir DELETE também pelo alvo (rejeitar request OU remover seguidor)
drop policy if exists "follows_delete_self" on public.follows;
create policy "follows_delete_self" on public.follows
  for delete to authenticated
  using ((select auth.uid()) = follower_id or (select auth.uid()) = following_id);

grant update on public.follows to authenticated;

-- 5. Atualiza CHECK de notifications.kind pra incluir 'follow_request'
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('like','comment','follow','mention','follow_request'));

-- 6. Trigger notify_follow agora diferencia status
create or replace function private.notify_follow()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'accepted' then
    insert into public.notifications (user_id, actor_id, kind)
    values (new.following_id, new.follower_id, 'follow');
  else
    insert into public.notifications (user_id, actor_id, kind)
    values (new.following_id, new.follower_id, 'follow_request');
  end if;
  return new;
end$$;

-- 7. Quando UPDATE aceita um pending, gera 'follow' notification
create or replace function private.notify_follow_accepted()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    -- Quem solicitou recebe notif "X aceitou seu follow"
    insert into public.notifications (user_id, actor_id, kind)
    values (new.follower_id, new.following_id, 'follow');
    -- Apaga a notif de follow_request que ainda estava pendente pro alvo
    delete from public.notifications
     where user_id = new.following_id
       and actor_id = new.follower_id
       and kind = 'follow_request'
       and read_at is null;
  end if;
  return new;
end$$;

drop trigger if exists follows_after_update_notify on public.follows;
create trigger follows_after_update_notify
  after update on public.follows
  for each row execute function private.notify_follow_accepted();

-- 8. Index pra listar pending requests rapidamente
create index if not exists follows_pending_idx
  on public.follows (following_id, created_at desc)
  where status = 'pending';

comment on column public.follows.status is
  'pending = aguardando aceite do dono do perfil privado. accepted = ativo.';;
