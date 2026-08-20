alter table public.stations
  add column if not exists display_order integer;

with ordered_stations as (
  select id,
         row_number() over (
           order by
             case when lower(btrim(name)) in ('final survey', 'final survey station') then 1 else 0 end,
             name
         )::integer as station_order
    from public.stations
)
update public.stations
   set display_order = ordered_stations.station_order
  from ordered_stations
 where public.stations.id = ordered_stations.id
   and public.stations.display_order is null;

alter table public.stations
  alter column display_order set default 1,
  alter column display_order set not null,
  add constraint stations_display_order_positive check (display_order > 0);

drop function if exists public.delegate_home_progress(uuid);

create function public.delegate_home_progress(
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
  station_display_order integer,
  station_completed boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select delegate_sessions.id,
         delegates.id,
         delegates.title,
         delegates.full_name,
         delegates.registration_number,
         delegates.eligible_at,
         delegates.draw_status,
         stations.id,
         stations.name,
         stations.display_order,
         (delegate_station_stamps.id is not null)
    from public.delegate_sessions
    join public.delegates on delegates.id = delegate_sessions.delegate_id
    left join public.stations on stations.active = true
    left join public.delegate_station_stamps
      on delegate_station_stamps.delegate_id = delegates.id
     and delegate_station_stamps.station_id = stations.id
   where delegate_sessions.id = p_session_id
     and delegate_sessions.expires_at > now()
   order by stations.display_order asc nulls last, stations.name asc nulls last;
$$;

revoke all on function public.delegate_home_progress(uuid) from public;
grant execute on function public.delegate_home_progress(uuid) to anon, authenticated, service_role;
