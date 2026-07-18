create table if not exists public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password_hash text not null,
  password_salt text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_sessions (
  id uuid primary key,
  admin_id uuid not null references public.admin_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.event_settings (
  id integer primary key default 1 check (id = 1),
  participation_open boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by_admin_id uuid references public.admin_accounts(id) on delete set null
);

insert into public.event_settings (id, participation_open)
values (1, true)
on conflict (id) do nothing;

create index if not exists admin_accounts_active_username_idx
  on public.admin_accounts (username)
  where active = true;

create index if not exists admin_sessions_valid_idx
  on public.admin_sessions (id, expires_at);
