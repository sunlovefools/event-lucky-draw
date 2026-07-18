create table if not exists public.delegate_station_stamps (
  id uuid primary key default gen_random_uuid(),
  delegate_id uuid not null references public.delegates(id) on delete cascade,
  station_id uuid not null references public.stations(id) on delete restrict,
  collected_at timestamptz not null default now(),
  unique (delegate_id, station_id)
);

create index if not exists delegate_station_stamps_delegate_idx
  on public.delegate_station_stamps (delegate_id);

create index if not exists delegate_station_stamps_station_idx
  on public.delegate_station_stamps (station_id);
