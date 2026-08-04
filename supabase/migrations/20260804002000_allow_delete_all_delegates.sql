-- Replace the delete-all function with explicit predicates so it remains
-- compatible with Supabase's safe-update protection.
create or replace function public.admin_delete_all_delegates(p_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if not exists (
    select 1
      from public.admin_sessions
      join public.admin_accounts on admin_accounts.id = admin_sessions.admin_id
     where admin_sessions.id = p_session_id
       and admin_sessions.expires_at > now()
       and admin_accounts.active = true
  ) then
    raise exception 'Admin login required.';
  end if;

  select count(*)::integer into deleted_count from public.delegates;

  -- winner_history has a restrictive delegate foreign key, so clear it first.
  delete from public.winner_history where true;
  delete from public.delegates where true;

  return deleted_count;
end;
$$;

revoke all on function public.admin_delete_all_delegates(uuid) from public;
grant execute on function public.admin_delete_all_delegates(uuid) to anon, authenticated, service_role;
