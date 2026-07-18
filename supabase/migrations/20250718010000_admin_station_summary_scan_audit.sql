create table if not exists public.scan_audit_logs (
  id uuid primary key default gen_random_uuid(),
  delegate_id uuid references public.delegates(id) on delete set null,
  station_id uuid references public.stations(id) on delete set null,
  qr_token_id uuid references public.station_qr_tokens(id) on delete set null,
  qr_token text not null,
  result text not null,
  consumed boolean not null,
  scanned_at timestamptz not null default now()
);

create index if not exists scan_audit_logs_scanned_at_idx
  on public.scan_audit_logs (scanned_at desc);

create index if not exists scan_audit_logs_station_idx
  on public.scan_audit_logs (station_id, scanned_at desc);

create or replace function public.admin_station_summaries()
returns table (
  station_id uuid,
  station_name text,
  active boolean,
  completions integer
)
language sql
security definer
set search_path = public
as $$
  select stations.id as station_id,
         stations.name as station_name,
         stations.active,
         count(delegate_station_stamps.id)::integer as completions
    from public.stations
    left join public.delegate_station_stamps
      on delegate_station_stamps.station_id = stations.id
   group by stations.id, stations.name, stations.active
   order by stations.name;
$$;

create or replace function public.admin_scan_audit_logs()
returns table (
  id uuid,
  delegate_id uuid,
  delegate_full_name text,
  station_id uuid,
  station_name text,
  scanned_at timestamptz,
  qr_token_id uuid,
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
         delegates.full_name as delegate_full_name,
         scan_audit_logs.station_id,
         stations.name as station_name,
         scan_audit_logs.scanned_at,
         scan_audit_logs.qr_token_id,
         scan_audit_logs.qr_token,
         scan_audit_logs.result,
         scan_audit_logs.consumed
    from public.scan_audit_logs
    left join public.delegates on delegates.id = scan_audit_logs.delegate_id
    left join public.stations on stations.id = scan_audit_logs.station_id
   order by scan_audit_logs.scanned_at desc;
$$;
