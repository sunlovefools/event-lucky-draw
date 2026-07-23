-- Replace the separate final survey form with a locked final station.
-- Delegates must collect every other active station before the Final Survey
-- station accepts their scan.

do $$
begin
  if exists (select 1 from public.stations where lower(name) = lower('Final Survey')) then
    update public.stations
       set active = true
     where id = (
       select id
         from public.stations
        where lower(name) = lower('Final Survey')
        order by created_at asc
        limit 1
     );
  else
    insert into public.stations (name, active) values ('Final Survey', true);
  end if;
end $$;

-- Preserve legacy final survey submissions by turning them into Final Survey
-- station stamps. Existing eligibility timestamps remain intact.
with final_station as (
  select id
    from public.stations
   where lower(name) = lower('Final Survey')
   order by created_at asc
   limit 1
)
insert into public.delegate_station_stamps (delegate_id, station_id, collected_at)
select responses.delegate_id, final_station.id, responses.submitted_at
  from public.final_survey_responses responses
  cross join final_station
on conflict (delegate_id, station_id) do nothing;

update public.delegates delegates
   set eligible_at = coalesce(delegates.eligible_at, responses.submitted_at)
  from public.final_survey_responses responses
 where responses.delegate_id = delegates.id
   and delegates.eligible_at is null;

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
