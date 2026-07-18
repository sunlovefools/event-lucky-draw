alter table public.delegate_station_stamps
  add column if not exists qr_token_id uuid references public.station_qr_tokens(id) on delete set null;

create index if not exists delegate_station_stamps_qr_token_idx
  on public.delegate_station_stamps (qr_token_id);
