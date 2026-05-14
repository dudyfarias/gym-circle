-- Gym Circle social workout participants.
-- Allows cross-post workout posts/stories after the tagged user accepts.

-- ---------------------------------------------------------------------
-- Activity source types used by accepted participants.
-- ---------------------------------------------------------------------
alter table public.user_activity_days
  drop constraint if exists user_activity_days_source_type_check;

alter table public.user_activity_days
  add constraint user_activity_days_source_type_check
    check (source_type in ('post', 'story', 'post_participant', 'story_participant'));

-- ---------------------------------------------------------------------
-- Post participants
-- ---------------------------------------------------------------------
create table if not exists public.post_participants (
  id                  uuid primary key default gen_random_uuid(),
  post_id             uuid not null references public.posts(id) on delete cascade,
  tagged_user_id      uuid not null references auth.users(id) on delete cascade,
  tagged_by_user_id   uuid not null references auth.users(id) on delete cascade,
  status              text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  accepted_at         timestamptz,
  rejected_at         timestamptz,
  created_at          timestamptz not null default now(),
  unique (post_id, tagged_user_id),
  check (tagged_user_id <> tagged_by_user_id)
);

create index if not exists post_participants_post_status_idx
  on public.post_participants (post_id, status);

create index if not exists post_participants_tagged_status_idx
  on public.post_participants (tagged_user_id, status, created_at desc);

alter table public.post_participants enable row level security;

drop policy if exists "post_participants_select_visible" on public.post_participants;
drop policy if exists "post_participants_insert_author" on public.post_participants;
drop policy if exists "post_participants_update_tagged" on public.post_participants;
drop policy if exists "post_participants_delete_related" on public.post_participants;

create policy "post_participants_select_visible"
  on public.post_participants for select to authenticated
  using (
    tagged_user_id = (select auth.uid())
    or tagged_by_user_id = (select auth.uid())
    or (
      status = 'accepted'
      and exists (
        select 1
        from public.posts p
        where p.id = post_id
          and private.can_view_profile_posts(p.user_id)
      )
    )
  );

create policy "post_participants_insert_author"
  on public.post_participants for insert to authenticated
  with check (
    tagged_by_user_id = (select auth.uid())
    and tagged_user_id <> (select auth.uid())
    and private.can_interact_with_user(tagged_user_id)
    and exists (
      select 1
      from public.posts p
      where p.id = post_id
        and p.user_id = (select auth.uid())
    )
  );

create policy "post_participants_update_tagged"
  on public.post_participants for update to authenticated
  using (tagged_user_id = (select auth.uid()))
  with check (
    tagged_user_id = (select auth.uid())
    and status in ('accepted', 'rejected')
  );

create policy "post_participants_delete_related"
  on public.post_participants for delete to authenticated
  using (
    tagged_user_id = (select auth.uid())
    or tagged_by_user_id = (select auth.uid())
  );

grant select, insert, update, delete on public.post_participants to authenticated;

-- ---------------------------------------------------------------------
-- Story participants
-- ---------------------------------------------------------------------
create table if not exists public.story_participants (
  id                  uuid primary key default gen_random_uuid(),
  story_id            uuid not null references public.stories(id) on delete cascade,
  tagged_user_id      uuid not null references auth.users(id) on delete cascade,
  tagged_by_user_id   uuid not null references auth.users(id) on delete cascade,
  status              text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  accepted_at         timestamptz,
  rejected_at         timestamptz,
  created_at          timestamptz not null default now(),
  unique (story_id, tagged_user_id),
  check (tagged_user_id <> tagged_by_user_id)
);

create index if not exists story_participants_story_status_idx
  on public.story_participants (story_id, status);

create index if not exists story_participants_tagged_status_idx
  on public.story_participants (tagged_user_id, status, created_at desc);

alter table public.story_participants enable row level security;

drop policy if exists "story_participants_select_visible" on public.story_participants;
drop policy if exists "story_participants_insert_author" on public.story_participants;
drop policy if exists "story_participants_update_tagged" on public.story_participants;
drop policy if exists "story_participants_delete_related" on public.story_participants;

create policy "story_participants_select_visible"
  on public.story_participants for select to authenticated
  using (
    tagged_user_id = (select auth.uid())
    or tagged_by_user_id = (select auth.uid())
    or (
      status = 'accepted'
      and exists (
        select 1
        from public.stories s
        where s.id = story_id
          and (
            s.user_id = (select auth.uid())
            or (
              s.expires_at > now()
              and private.can_view_profile_posts(s.user_id)
            )
          )
      )
    )
  );

create policy "story_participants_insert_author"
  on public.story_participants for insert to authenticated
  with check (
    tagged_by_user_id = (select auth.uid())
    and tagged_user_id <> (select auth.uid())
    and private.can_interact_with_user(tagged_user_id)
    and exists (
      select 1
      from public.stories s
      where s.id = story_id
        and s.user_id = (select auth.uid())
    )
  );

create policy "story_participants_update_tagged"
  on public.story_participants for update to authenticated
  using (tagged_user_id = (select auth.uid()))
  with check (
    tagged_user_id = (select auth.uid())
    and status in ('accepted', 'rejected')
  );

create policy "story_participants_delete_related"
  on public.story_participants for delete to authenticated
  using (
    tagged_user_id = (select auth.uid())
    or tagged_by_user_id = (select auth.uid())
  );

grant select, insert, update, delete on public.story_participants to authenticated;

-- ---------------------------------------------------------------------
-- Timestamp normalization for accept/reject.
-- ---------------------------------------------------------------------
create or replace function private.normalize_participant_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    new.accepted_at := coalesce(new.accepted_at, now());
    new.rejected_at := null;
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    new.rejected_at := coalesce(new.rejected_at, now());
    new.accepted_at := null;
  elsif new.status = 'pending' then
    new.accepted_at := null;
    new.rejected_at := null;
  end if;

  return new;
end;
$$;

revoke all on function private.normalize_participant_status() from public;

drop trigger if exists post_participants_before_update_status on public.post_participants;
create trigger post_participants_before_update_status
  before update of status on public.post_participants
  for each row execute function private.normalize_participant_status();

drop trigger if exists story_participants_before_update_status on public.story_participants;
create trigger story_participants_before_update_status
  before update of status on public.story_participants
  for each row execute function private.normalize_participant_status();

-- ---------------------------------------------------------------------
-- Streak/activity syncing for accepted tags.
-- ---------------------------------------------------------------------
create or replace function private.sync_post_participant_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_post public.posts;
  v_user_id uuid;
begin
  if tg_op = 'DELETE' then
    if old.status = 'accepted' then
      delete from public.user_activity_days
       where source_type = 'post_participant'
         and source_id = old.id;
      perform private.recalculate_user_stats(old.tagged_user_id);
    end if;
    return old;
  end if;

  select * into v_post from public.posts where id = new.post_id;

  if new.status = 'accepted' and (
    tg_op = 'INSERT'
    or (tg_op = 'UPDATE' and old.status is distinct from 'accepted')
  ) then
    if v_post.id is not null then
      insert into public.user_activity_days (
        user_id,
        activity_date,
        source_type,
        source_id,
        has_photo
      )
      values (
        new.tagged_user_id,
        v_post.workout_date,
        'post_participant',
        new.id,
        length(trim(coalesce(v_post.image_url, ''))) > 0
      )
      on conflict (user_id, activity_date, source_type, source_id) do nothing;
    end if;
    perform private.recalculate_user_stats(new.tagged_user_id);
  elsif tg_op = 'UPDATE' and old.status = 'accepted' and new.status <> 'accepted' then
    delete from public.user_activity_days
     where source_type = 'post_participant'
       and source_id = old.id;
    perform private.recalculate_user_stats(new.tagged_user_id);
  end if;

  return new;
end;
$$;

revoke all on function private.sync_post_participant_activity() from public;

drop trigger if exists post_participants_after_change_activity on public.post_participants;
create trigger post_participants_after_change_activity
  after insert or update of status or delete on public.post_participants
  for each row execute function private.sync_post_participant_activity();

create or replace function private.sync_story_participant_activity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_story public.stories;
  v_activity_date date;
begin
  if tg_op = 'DELETE' then
    if old.status = 'accepted' then
      delete from public.user_activity_days
       where source_type = 'story_participant'
         and source_id = old.id;
      perform private.recalculate_user_stats(old.tagged_user_id);
    end if;
    return old;
  end if;

  select * into v_story from public.stories where id = new.story_id;

  if new.status = 'accepted' and (
    tg_op = 'INSERT'
    or (tg_op = 'UPDATE' and old.status is distinct from 'accepted')
  ) then
    if v_story.id is not null and v_story.expires_at > now() then
      v_activity_date := (v_story.created_at at time zone 'America/Sao_Paulo')::date;
      insert into public.user_activity_days (
        user_id,
        activity_date,
        source_type,
        source_id,
        has_photo
      )
      values (
        new.tagged_user_id,
        v_activity_date,
        'story_participant',
        new.id,
        length(trim(coalesce(v_story.media_url, ''))) > 0
      )
      on conflict (user_id, activity_date, source_type, source_id) do nothing;
    end if;
    perform private.recalculate_user_stats(new.tagged_user_id);
  elsif tg_op = 'UPDATE' and old.status = 'accepted' and new.status <> 'accepted' then
    delete from public.user_activity_days
     where source_type = 'story_participant'
       and source_id = old.id;
    perform private.recalculate_user_stats(new.tagged_user_id);
  end if;

  return new;
end;
$$;

revoke all on function private.sync_story_participant_activity() from public;

drop trigger if exists story_participants_after_change_activity on public.story_participants;
create trigger story_participants_after_change_activity
  after insert or update of status or delete on public.story_participants
  for each row execute function private.sync_story_participant_activity();

-- ---------------------------------------------------------------------
-- Notifications for pending tags.
-- ---------------------------------------------------------------------
alter table public.notifications
  drop constraint if exists notifications_kind_check;

alter table public.notifications
  add constraint notifications_kind_check
    check (
      kind in (
        'like',
        'comment',
        'follow',
        'mention',
        'follow_request',
        'story_like',
        'story_reply',
        'new_message',
        'new_story',
        'training_today',
        'post_tag',
        'story_tag'
      )
    );

create or replace function private.notify_post_participant_pending()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status <> 'pending' then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, kind, post_id, body)
  values (new.tagged_user_id, new.tagged_by_user_id, 'post_tag', new.post_id, 'marcou você em um treino');
  return new;
end;
$$;

revoke all on function private.notify_post_participant_pending() from public;

drop trigger if exists post_participants_after_insert_notify on public.post_participants;
create trigger post_participants_after_insert_notify
  after insert on public.post_participants
  for each row execute function private.notify_post_participant_pending();

create or replace function private.notify_story_participant_pending()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status <> 'pending' then
    return new;
  end if;

  insert into public.notifications (user_id, actor_id, kind, story_id, body)
  values (new.tagged_user_id, new.tagged_by_user_id, 'story_tag', new.story_id, 'marcou você em um story');
  return new;
end;
$$;

revoke all on function private.notify_story_participant_pending() from public;

drop trigger if exists story_participants_after_insert_notify on public.story_participants;
create trigger story_participants_after_insert_notify
  after insert on public.story_participants
  for each row execute function private.notify_story_participant_pending();

do $$
begin
  alter publication supabase_realtime add table public.post_participants;
exception when duplicate_object then
  null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.story_participants;
exception when duplicate_object then
  null;
end;
$$;

comment on table public.post_participants is 'Participantes marcados em posts de treino. Só status accepted conta streak do marcado.';
comment on table public.story_participants is 'Participantes marcados em stories. Só status accepted antes de expirar conta streak do marcado.';
