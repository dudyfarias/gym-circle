-- =====================================================================
-- App Store readiness — pieces que faltavam:
--   1. trigger pra desfazer follow nos dois lados quando A bloqueia B
--   2. RPC `delete_my_account()` (Apple Guideline 5.1.1(v))
--
-- As tabelas `public.user_blocks` e `public.reports` já existem desde
-- 20260507215320_gym_circle_alpha_readiness.sql — não recriamos aqui.
--
-- Soft-delete via `account_deletion_requests` continua sendo o caminho
-- recomendado em produção; `delete_my_account()` é a opção hard-delete
-- caso o produto decida oferecer "excluir agora" sem grace period.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Auto-unfollow nos dois lados quando A bloqueia B.
-- ---------------------------------------------------------------------
create or replace function private.unfollow_on_block()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.follows
   where (follower_id = new.blocker_id and following_id = new.blocked_id)
      or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end;
$$;

drop trigger if exists user_blocks_after_insert on public.user_blocks;
create trigger user_blocks_after_insert
  after insert on public.user_blocks
  for each row execute function private.unfollow_on_block();

comment on function private.unfollow_on_block() is
  'Desfaz follow em ambas as direções quando A bloqueia B. Roda como SECURITY DEFINER porque RLS de follows exige owner.';

-- ---------------------------------------------------------------------
-- 2. Account deletion RPC — Apple Guideline 5.1.1(v)
--    Hard-delete: limpa sessions/refresh_tokens e remove auth.users.
--    O CASCADE em FKs (profiles, posts, stories, etc.) faz o resto.
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  delete from auth.sessions where user_id = v_uid;
  delete from auth.refresh_tokens where user_id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'Exclui permanentemente a conta autenticada (Apple Guideline 5.1.1(v)). Sem grace period — usar com confirmação dupla na UI. Em produção considerar soft-delete via account_deletion_requests.';
