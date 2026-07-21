# Lucky draw uses cumulative, round-tagged winner history with reset and delete-round

The original draw permanently excluded winners: a delegate's `draw_status` was flipped to `winner` and each `winner_history` row was required to carry a prize `draw_label`. The redesign drops prize labels entirely and must let admins re-draw the same people via a reset. That is impossible while "already won" is a permanent, delegate-level fact.

## Decision

Introduce a **Draw Round**. Winner History becomes **cumulative and round-tagged, with no prize/label column**. Within a round a delegate may be drawn at most once. **Reset** archives the current round as completed and opens a fresh round, making all base-eligible delegates drawable again. **Delete Previous Round** removes a *completed* (non-current) round's history rows only — pure record cleanup with no effect on current-round eligibility; the current round is never deletable.

## Consequences

- `winner_history` gains a round identifier; the `draw_label` column is removed.
- Eligibility to be drawn is derived **per current round** from Winner History, so the delegate `winner` status is removed (the won-lock is no longer a delegate property).
- The public `/draw` screen shows the current round's latest winner (or "waiting" when none yet this round).
- The admin dashboard lists past rounds with confirm-gated delete controls, and the `winner-history` CSV export reflects whatever remains in history after deletes.
- **The Draw action computes the winner server-side, at request time, from the current open round and current eligibility.** The client-side animation is purely cosmetic. Therefore a reset performed in another window affects the *next* draw, not an in-flight one.
- The Draw screen is an admin page at `/admin/draw` (admin presents it to the crowd by sharing their screen); the public `/draw` route is retired in favour of it.
