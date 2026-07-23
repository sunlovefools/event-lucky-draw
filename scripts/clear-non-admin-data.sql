-- Clear all application data while preserving admin data.
-- Preserved tables:
--   - public.admin_accounts
--   - public.admin_sessions
--   - public.event_settings
--
-- Run local:
--   npx supabase db query --local --file scripts/clear-non-admin-data.sql
--
-- Run linked remote project:
--   npx supabase db query --linked --file scripts/clear-non-admin-data.sql

begin;

-- Truncate only tables that exist so this works across older/newer migrations.
do $$
declare
  tables_to_clear text[];
begin
  select array_agg(format('%I.%I', schemaname, tablename) order by tablename)
    into tables_to_clear
  from pg_tables
  where schemaname = 'public'
    and tablename = any (array[
      'delegate_sessions',
      'delegate_station_stamps',
      'delegates',
      'draw_rounds',
      'scan_audit_logs',
      'stations',
      'winner_history'
    ]);

  if tables_to_clear is not null then
    execute 'truncate table ' || array_to_string(tables_to_clear, ', ') || ' restart identity cascade';
  end if;
end $$;

-- Keep the app usable after clearing: lucky draw code expects an open round.
insert into public.draw_rounds (round_number, opened_at, closed_at)
select 1, now(), null
where exists (
  select 1
  from information_schema.tables
  where table_schema = 'public'
    and table_name = 'draw_rounds'
)
and not exists (select 1 from public.draw_rounds);

commit;
