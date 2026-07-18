create table if not exists public.stations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.vendor_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  password_salt text not null,
  station_id uuid not null references public.stations(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists stations_active_name_idx
  on public.stations (active, name);

create index if not exists vendor_accounts_active_username_idx
  on public.vendor_accounts (username)
  where active = true;

create index if not exists vendor_accounts_station_idx
  on public.vendor_accounts (station_id);
