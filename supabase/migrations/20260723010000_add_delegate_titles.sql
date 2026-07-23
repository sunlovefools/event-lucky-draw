alter table public.delegates
  add column if not exists title text not null default '';

drop function if exists public.admin_participant_progress();

create or replace function public.admin_participant_progress()
returns table (
  id uuid,
  title text,
  full_name text,
  registration_number text,
  stamps_collected bigint,
  total_active_stations bigint,
  survey_submitted boolean,
  draw_status text
)
language sql
security definer
set search_path = public
as $$
  with active_station_count as (
    select count(*) as total_active_stations
      from public.stations
     where active = true
  ),
  final_survey_station as (
    select id
      from public.stations
     where active = true
       and lower(name) = lower('Final Survey')
     order by created_at asc
     limit 1
  ),
  stamp_counts as (
    select delegate_id, count(*) as stamps_collected
      from public.delegate_station_stamps
     where station_id in (select id from public.stations where active = true)
     group by delegate_id
  ),
  final_survey_stamps as (
    select delegate_id, true as completed
      from public.delegate_station_stamps
     where station_id in (select id from final_survey_station)
     group by delegate_id
  )
  select delegates.id,
         delegates.title,
         delegates.full_name,
         delegates.registration_number,
         coalesce(stamp_counts.stamps_collected, 0) as stamps_collected,
         active_station_count.total_active_stations,
         coalesce(final_survey_stamps.completed, false) or (final_survey_responses.id is not null) as survey_submitted,
         delegates.draw_status
    from public.delegates
    cross join active_station_count
    left join stamp_counts on stamp_counts.delegate_id = delegates.id
    left join final_survey_stamps on final_survey_stamps.delegate_id = delegates.id
    left join public.final_survey_responses on final_survey_responses.delegate_id = delegates.id
   order by delegates.created_at desc;
$$;

drop function if exists public.admin_scan_audit_logs();

create or replace function public.admin_scan_audit_logs()
returns table (
  id uuid,
  delegate_id uuid,
  delegate_full_name text,
  station_id uuid,
  station_name text,
  scanned_at timestamptz,
  qr_token text,
  result text,
  consumed boolean
)
language sql
security definer
set search_path = public
as $$
  select scan_audit_logs.id,
         scan_audit_logs.delegate_id,
         case
           when delegates.id is null then null
           else trim(concat_ws(' ', nullif(delegates.title, ''), delegates.full_name))
         end as delegate_full_name,
         scan_audit_logs.station_id,
         stations.name as station_name,
         scan_audit_logs.scanned_at,
         scan_audit_logs.qr_token,
         scan_audit_logs.result,
         scan_audit_logs.consumed
    from public.scan_audit_logs
    left join public.delegates on delegates.id = scan_audit_logs.delegate_id
    left join public.stations on stations.id = scan_audit_logs.station_id
   order by scan_audit_logs.scanned_at desc;
$$;
