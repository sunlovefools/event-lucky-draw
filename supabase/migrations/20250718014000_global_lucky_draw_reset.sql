-- Lucky draw winners are globally unique until the admin reset clears history.
-- The draw_rounds table remains only as a compatibility parent for winner_history.round_id.

alter table public.winner_history
  drop constraint if exists winner_history_round_delegate_unique;

alter table public.winner_history
  add constraint winner_history_delegate_unique unique (delegate_id);
