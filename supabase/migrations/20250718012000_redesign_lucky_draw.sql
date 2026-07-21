-- Redesign the lucky draw:
--  * winner history is cumulative and tagged by a draw round (no prize label)
--  * eligibility = all station stamps + final survey, with an admin eligible/excluded override
--  * a delegate may be drawn at most once per round (enforced by a unique constraint)

-- 1. Draw rounds ------------------------------------------------------------
create table if not exists public.draw_rounds (
  id uuid primary key default gen_random_uuid(),
  round_number integer not null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists draw_rounds_opened_at_idx
  on public.draw_rounds (opened_at desc);

create index if not exists draw_rounds_round_number_idx
  on public.draw_rounds (round_number);

-- Seed the initial round exactly once.
do $$
declare
  v_next integer;
begin
  if not exists (select 1 from public.draw_rounds) then
    select coalesce(max(round_number), 0) + 1 into v_next from public.draw_rounds;
    insert into public.draw_rounds (round_number, opened_at, closed_at)
    values (v_next, now(), null);
  end if;
end $$;

-- 2. Winner history: drop prize label, attach a round, enforce one win per round
alter table public.winner_history drop column if exists draw_label;

alter table public.winner_history add column if not exists round_id uuid;

do $$
declare
  v_round uuid;
begin
  select id into v_round from public.draw_rounds order by opened_at asc limit 1;
  if v_round is not null then
    update public.winner_history set round_id = v_round where round_id is null;
  end if;
end $$;

alter table public.winner_history
  add constraint winner_history_round_id_fkey
  foreign key (round_id) references public.draw_rounds (id) on delete restrict;

alter table public.winner_history alter column round_id set not null;

alter table public.winner_history
  add constraint winner_history_round_delegate_unique
  unique (round_id, delegate_id);

-- 3. Delegate draw status: simplify to auto / eligible / excluded
alter table public.delegates alter column draw_status set default 'auto';

update public.delegates set draw_status = 'auto'
  where draw_status is null or draw_status = 'not_eligible';
update public.delegates set draw_status = 'eligible'
  where draw_status = 'manual_include';
update public.delegates set draw_status = 'excluded'
  where draw_status = 'disqualified';
update public.delegates set draw_status = 'auto'
  where draw_status = 'winner';
