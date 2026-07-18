create table if not exists public.vendor_sessions (
  id uuid primary key,
  vendor_id uuid not null references public.vendor_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.station_qr_tokens (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations(id) on delete restrict,
  token text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  invalidated_at timestamptz,
  consumed_at timestamptz
);

create index if not exists vendor_sessions_valid_idx
  on public.vendor_sessions (id, expires_at);

create index if not exists station_qr_tokens_current_idx
  on public.station_qr_tokens (station_id, expires_at, created_at)
  where invalidated_at is null and consumed_at is null;
