-- Permite que viewers autorizados hidratem cada treino integrado no detalhe
-- do post. O vínculo segue a visibilidade da linha de posts; activities mantém
-- sua própria RLS e precisa estar em publication_state = shared.

drop policy if exists post_activities_select_owner
  on public.post_activities;
drop policy if exists post_activities_select_visible
  on public.post_activities;
create policy post_activities_select_visible
  on public.post_activities
  for select
  to authenticated
  using (
    auth.uid() is not null
    and exists (
      select 1
        from public.posts p
       where p.id = post_activities.post_id
    )
  );

create or replace function public.get_post_activity_details(p_post_id uuid)
returns setof public.activities
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select a.*
    from public.post_activities link
    join public.activities a on a.id = link.activity_id
   where auth.uid() is not null
     and link.post_id = p_post_id
   order by link.position, link.created_at;
$$;

revoke all on function public.get_post_activity_details(uuid)
  from public, anon;
grant execute on function public.get_post_activity_details(uuid)
  to authenticated;

comment on function public.get_post_activity_details(uuid) is
  'Hidrata, sob RLS, as activities integradas a um post na ordem do vínculo.';
