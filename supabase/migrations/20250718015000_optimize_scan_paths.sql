-- Keep the hot delegate/vendor scan paths index-only and ordered for high event traffic.

-- Vendor station history is queried by station and newest-first after every stamp.
create index if not exists delegate_station_stamps_station_collected_at_idx
  on public.delegate_station_stamps (station_id, collected_at desc);

-- Delegate home loads a delegate's collected stations repeatedly during sign-in
-- and refreshes; include station_id for cheaper progress lookups.
create index if not exists delegate_station_stamps_delegate_station_idx
  on public.delegate_station_stamps (delegate_id, station_id);

-- Vendor scan audit exports/filtering read newest attempts by station/result.
create index if not exists scan_audit_logs_station_result_scanned_at_idx
  on public.scan_audit_logs (station_id, result, scanned_at desc);
