create or replace function public.consume_station_qr_token(qr_token text, consumed_at timestamptz)
returns table (
  id uuid,
  token text,
  station_id uuid,
  station_name text,
  consumed_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with consumed as (
    update public.station_qr_tokens qr
       set consumed_at = $2
     where qr.token = $1
       and qr.invalidated_at is null
       and qr.consumed_at is null
       and qr.expires_at > $2
     returning qr.id, qr.token, qr.station_id, qr.consumed_at
  )
  select consumed.id, consumed.token, consumed.station_id, stations.name as station_name, consumed.consumed_at
    from consumed
    join public.stations on stations.id = consumed.station_id;
$$;
