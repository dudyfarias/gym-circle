-- Private follow reciprocity:
-- If a private user already follows me, my follow-back should be accepted
-- immediately. Clients still never decide the final follow status.

create or replace function private.set_follow_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_private boolean;
  v_target_follows_me boolean;
begin
  if TG_OP = 'INSERT' then
    if new.follower_id = new.following_id then
      raise exception 'cannot follow yourself';
    end if;

    select coalesce(p.is_private, false)
      into v_is_private
      from public.profiles p
     where p.user_id = new.following_id
       and p.account_status = 'active';

    if v_is_private is null then
      raise exception 'target profile is not available';
    end if;

    select exists (
      select 1
        from public.follows reciprocal
       where reciprocal.follower_id = new.following_id
         and reciprocal.following_id = new.follower_id
         and reciprocal.status = 'accepted'
    )
      into v_target_follows_me;

    if v_is_private and not v_target_follows_me then
      new.status := 'pending';
    else
      new.status := 'accepted';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.set_follow_status() from public;

comment on function private.set_follow_status() is
  'Server-side follow status resolver. Private follows become pending unless the target already follows the requester.';
