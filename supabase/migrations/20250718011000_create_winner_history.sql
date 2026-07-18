create table if not exists public.winner_history (
  id uuid primary key default gen_random_uuid(),
  delegate_id uuid not null references public.delegates(id) on delete restrict,
  draw_label text not null,
  won_at timestamptz not null default now()
);

create index if not exists winner_history_won_at_idx
  on public.winner_history (won_at desc);

create index if not exists winner_history_delegate_idx
  on public.winner_history (delegate_id);
