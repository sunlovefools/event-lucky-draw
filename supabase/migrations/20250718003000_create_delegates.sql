create table if not exists public.delegates (
  id uuid primary key default gen_random_uuid(),
  registration_number text not null unique,
  full_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.delegate_sessions (
  id uuid primary key,
  delegate_id uuid not null references public.delegates(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists delegates_registration_number_idx
  on public.delegates (registration_number);

create index if not exists delegate_sessions_valid_idx
  on public.delegate_sessions (id, expires_at);
