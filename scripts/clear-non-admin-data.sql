-- Permanently clear all public application data while preserving only the
-- admin username/password records in public.admin_accounts.
--
-- This also clears admin login sessions, health checks, scan audit logs, draw
-- history, delegates, stamps, and all ordinary stations. The system-owned
-- Final Survey Station is retained, and required singleton defaults are reset.
--
-- Run local:
--   npx supabase db query --local --file scripts/clear-non-admin-data.sql
--
-- Run linked remote project:
--   npx supabase db query --linked --file scripts/clear-non-admin-data.sql

begin;

do $$
declare
  tables_to_clear text[];
  preserved_admin_count bigint;
begin
  if to_regclass('public.admin_accounts') is null then
    raise exception 'public.admin_accounts does not exist; refusing to clear the database';
  end if;

  select count(*) into preserved_admin_count from public.admin_accounts;
  if preserved_admin_count = 0 then
    raise exception 'No admin account exists; refusing to clear the database';
  end if;

  -- Clear every current and future public table except the credential table
  -- and stations. Stations are handled separately so the protected system
  -- final station survives the cleanup.
  select array_agg(format('%I.%I', schemaname, tablename) order by tablename)
    into tables_to_clear
  from pg_tables
  where schemaname = 'public'
    and tablename not in ('admin_accounts', 'stations');

  if tables_to_clear is not null then
    execute 'truncate table ' || array_to_string(tables_to_clear, ', ') || ' restart identity cascade';
  end if;

  if to_regclass('public.stations') is not null then
    delete from public.stations
     where lower(btrim(name)) <> lower('Final Survey Station');

    if not exists (
      select 1
        from public.stations
       where lower(btrim(name)) = lower('Final Survey Station')
         and active = true
    ) then
      raise exception 'The active Final Survey Station is missing; apply migrations before clearing data';
    end if;
  end if;

  raise notice 'Preserved % admin account(s); all other public records were cleared', preserved_admin_count;
end $$;

-- Restore only the required application defaults.
insert into public.event_settings (id, participation_open, updated_at, updated_by_admin_id)
select 1, true, now(), null
where to_regclass('public.event_settings') is not null
on conflict (id) do update
set participation_open = excluded.participation_open,
    updated_at = excluded.updated_at,
    updated_by_admin_id = excluded.updated_by_admin_id;

insert into public.draw_rounds (round_number, opened_at, closed_at)
select 1, now(), null
where to_regclass('public.draw_rounds') is not null
and not exists (select 1 from public.draw_rounds);

select 'admin_accounts' as preserved_table, count(*) as preserved_records
from public.admin_accounts;

commit;
