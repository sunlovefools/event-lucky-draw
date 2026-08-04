-- Keep delegate draw overrides on the canonical vocabulary used by the draw
-- engine. These aliases were used by an older participant-management UI.
update public.delegates
set draw_status = 'eligible'
where draw_status = 'manual_include';

update public.delegates
set draw_status = 'excluded'
where draw_status = 'disqualified';
