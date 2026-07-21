-- Retire the one-time Station QR token system (ADR-0001).
-- Stamps are now collected when a vendor scans the delegate's Badge QR, so the
-- single-use, expiring station token is no longer needed. The scan audit log is
-- kept and repurposed: `qr_token` now stores the scanned Badge QR payload.

-- Drop the function that consumed station QR tokens before dropping its table.
drop function if exists public.consume_station_qr_token(text, timestamptz);

alter table public.delegate_station_stamps
  drop column if exists qr_token_id;

alter table public.scan_audit_logs
  drop column if exists qr_token_id;

drop table if exists public.station_qr_tokens;

-- Recreate the admin scan-audit view without the removed qr_token_id column.
-- CREATE OR REPLACE cannot change a function's return type, so drop it first.
drop function if exists public.admin_scan_audit_logs();
create function public.admin_scan_audit_logs()
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
         delegates.full_name as delegate_full_name,
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
