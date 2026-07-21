# Lucky Draw (Event Station Quest)

The event lucky-draw subsystem: how winners are selected on stage, recorded, and reset across an event.

## Language

**Draw Round**:
A bounded sequence of draws. Within a round, no delegate may be selected twice. "Reset" closes the current round (archiving it as completed) and opens a fresh one.
_Avoid_: cycle, session, game

**Draw (verb) / Lucky Draw**:
The admin action that randomly selects one eligible delegate from the current round's candidate pool and records them as a winner. No prize or label is attached.
_Avoid_: raffle, pick, pull

**Winner**:
A delegate selected in a draw. Recorded in Winner History together with the round it belongs to; carries no prize label.
_Avoid_: grand-prize winner, prize winner

**Winner History**:
The cumulative, round-tagged record of every delegate ever drawn. Contains no prize/label column.
_Avoid_: prize history, draw log

**Reset**:
Admin action that archives the current round as completed and starts a fresh round; all base-eligible delegates become drawable again.
_Avoid_: clear, restart, wipe

**Delete Previous Round**:
Admin action that removes a completed (non-current) round's Winner History rows. Pure record cleanup — it does not change any delegate's current-round eligibility. The current round is not deletable.
_Avoid_: clear round, delete round

**Eligible Participant**:
A delegate who may be drawn in the current round. Base eligibility requires **all station stamps collected AND the final survey submitted**; an admin may override this with the eligible/excluded toggle (eligible = force-include, excluded = force-exclude). On top of base eligibility, a delegate must not have already been drawn in the current round.
_Avoid_: qualified delegate, drawable
