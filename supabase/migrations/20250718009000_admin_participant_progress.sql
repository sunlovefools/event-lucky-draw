create or replace function public.admin_participant_progress()
returns table (
  id uuid,
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
  stamp_counts as (
    select delegate_id, count(*) as stamps_collected
      from public.delegate_station_stamps
     where station_id in (select id from public.stations where active = true)
     group by delegate_id
  )
  select delegates.id,
         delegates.full_name,
         delegates.registration_number,
         coalesce(stamp_counts.stamps_collected, 0) as stamps_collected,
         active_station_count.total_active_stations,
         (final_survey_responses.id is not null) as survey_submitted,
         delegates.draw_status
    from public.delegates
    cross join active_station_count
    left join stamp_counts on stamp_counts.delegate_id = delegates.id
    left join public.final_survey_responses on final_survey_responses.delegate_id = delegates.id
   order by delegates.created_at desc;
$$;
