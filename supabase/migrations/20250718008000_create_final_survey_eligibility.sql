alter table public.delegates
  add column if not exists eligible_at timestamptz,
  add column if not exists draw_status text not null default 'not_eligible';

create table if not exists public.final_survey_responses (
  id uuid primary key default gen_random_uuid(),
  delegate_id uuid not null unique references public.delegates(id) on delete cascade,
  satisfaction text not null,
  favorite_station text not null,
  feedback text not null default '',
  submitted_at timestamptz not null default now()
);

create index if not exists delegates_draw_status_idx
  on public.delegates (draw_status);

create index if not exists final_survey_responses_submitted_at_idx
  on public.final_survey_responses (submitted_at);
