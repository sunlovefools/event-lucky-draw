-- Return the complete delegate home snapshot in one database round trip.
-- The session UUID is the bearer credential already stored in the delegate's
-- HTTP-only cookie; expired or unknown sessions return no rows.
create or replace function public.delegate_home_progress(
  p_session_id uuid
)
returns table (
  session_id uuid,
  delegate_id uuid,
  title text,
  full_name text,
  registration_number text,
  eligible_at timestamptz,
  draw_status text,
  station_id uuid,
  station_name text,
  station_completed boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select delegate_sessions.id as session_id,
         delegates.id as delegate_id,
         delegates.title,
         delegates.full_name,
         delegates.registration_number,
         delegates.eligible_at,
         delegates.draw_status,
         stations.id as station_id,
         stations.name as station_name,
         (delegate_station_stamps.id is not null) as station_completed
    from public.delegate_sessions
    join public.delegates
      on delegates.id = delegate_sessions.delegate_id
    left join public.stations
      on stations.active = true
    left join public.delegate_station_stamps
      on delegate_station_stamps.delegate_id = delegates.id
     and delegate_station_stamps.station_id = stations.id
   where delegate_sessions.id = p_session_id
     and delegate_sessions.expires_at > now()
   order by stations.name asc nulls last;
$$;

revoke all on function public.delegate_home_progress(uuid) from public;
grant execute on function public.delegate_home_progress(uuid) to anon, authenticated, service_role;
