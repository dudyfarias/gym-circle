-- =====================================================================
-- Follow requests para perfis privados.
-- - profiles.is_private já existe. Quando true, novos follows ficam
--   status='pending' até o dono aceitar.
-- - Trigger BEFORE INSERT decide o status — cliente nunca controla.
-- - Notifications ganham kind 'follow_request' (separado de 'follow').
-- - Quando o alvo UPDATE pra 'accepted', dispara notif 'follow' pro
--   solicitante e remove a 'follow_request' pendente.
-- =====================================================================

alter table public.follows
  add column if not exists status text not null default 'accepted'
  check (status in ('pending','accepted'));

update public.follows set status = 'accepted' where status is null;

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

drop policy if exists "follows_update_target" on public.follows;
create policy "follows_update_target" on public.follows
  for update to authenticated
  using ((select auth.uid()) = following_id)
  with check ((select auth.uid()) = following_id and status = 'accepted');

drop policy if exists "follows_delete_self" on public.follows;
create policy "follows_delete_self" on public.follows
  for delete to authenticated
  using ((select auth.uid()) = follower_id or (select auth.uid()) = following_id);

grant update on public.follows to authenticated;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('like','comment','follow','mention','follow_request'));

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

create or replace function private.notify_follow_accepted()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    insert into public.notifications (user_id, actor_id, kind)
    values (new.follower_id, new.following_id, 'follow');
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

create index if not exists follows_pending_idx
  on public.follows (following_id, created_at desc)
  where status = 'pending';

comment on column public.follows.status is
  'pending = aguardando aceite do dono do perfil privado. accepted = ativo.';
