-- Make the final station a permanent, system-owned station.
-- It is always active, cannot be renamed/deleted, and cannot be duplicated by
-- creating either its current name or the legacy "Final Survey" name.

do $$
declare
  final_station_id uuid;
  legacy_station_id uuid;
begin
  select id
    into final_station_id
    from public.stations
   where lower(btrim(name)) = lower('Final Survey Station')
   order by created_at asc
   limit 1;

  select id
    into legacy_station_id
    from public.stations
   where lower(btrim(name)) = lower('Final Survey')
   order by created_at asc
   limit 1;

  if final_station_id is null and legacy_station_id is not null then
    update public.stations
       set name = 'Final Survey Station',
           active = true
     where id = legacy_station_id
     returning id into final_station_id;
    legacy_station_id := null;
  elsif final_station_id is null then
    insert into public.stations (name, active)
    values ('Final Survey Station', true)
    returning id into final_station_id;
  else
    update public.stations
       set name = 'Final Survey Station',
           active = true
     where id = final_station_id;
  end if;

  -- If an organizer manually created the new name before this migration,
  -- merge any stamps and audit history from the legacy station into it.
  if legacy_station_id is not null and legacy_station_id <> final_station_id then
    insert into public.delegate_station_stamps (delegate_id, station_id, collected_at)
    select delegate_id, final_station_id, collected_at
      from public.delegate_station_stamps
     where station_id = legacy_station_id
    on conflict (delegate_id, station_id) do nothing;

    update public.scan_audit_logs
       set station_id = final_station_id
     where station_id = legacy_station_id;

    delete from public.delegate_station_stamps where station_id = legacy_station_id;
    delete from public.stations where id = legacy_station_id;
  end if;
end $$;

create or replace function public.protect_final_survey_station()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if lower(btrim(new.name)) in (lower('Final Survey'), lower('Final Survey Station')) then
      raise exception 'The Final Survey Station is created automatically.' using errcode = '23514';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if lower(btrim(old.name)) = lower('Final Survey Station') then
      if new.name is distinct from old.name or new.active is distinct from true then
        raise exception 'The Final Survey Station cannot be changed.' using errcode = '23514';
      end if;
    elsif lower(btrim(new.name)) in (lower('Final Survey'), lower('Final Survey Station')) then
      raise exception 'That name is reserved for the Final Survey Station.' using errcode = '23514';
    end if;
    return new;
  end if;

  if lower(btrim(old.name)) = lower('Final Survey Station') then
    raise exception 'The Final Survey Station cannot be deleted.' using errcode = '23514';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_final_survey_station_trigger on public.stations;
create trigger protect_final_survey_station_trigger
before insert or update or delete on public.stations
for each row execute function public.protect_final_survey_station();

drop function if exists public.admin_participant_progress();
create function public.admin_participant_progress()
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
       and lower(btrim(name)) = lower('Final Survey Station')
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
    select delegate_id
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
         (final_survey_stamps.delegate_id is not null) as survey_submitted,
         delegates.draw_status
    from public.delegates
    cross join active_station_count
    left join stamp_counts on stamp_counts.delegate_id = delegates.id
    left join final_survey_stamps on final_survey_stamps.delegate_id = delegates.id
   order by delegates.created_at desc;
$$;
