create table if not exists public.health_checks (
  id bigint generated always as identity primary key,
  checked_at timestamptz not null default now()
);

insert into public.health_checks default values;
