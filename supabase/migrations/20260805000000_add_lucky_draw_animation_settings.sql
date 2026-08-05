alter table public.event_settings
  add column if not exists draw_spin_duration_ms integer not null default 10000,
  add column if not exists draw_name_interval_ms integer not null default 100;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'event_settings_draw_spin_duration_check'
  ) then
    alter table public.event_settings
      add constraint event_settings_draw_spin_duration_check
      check (draw_spin_duration_ms between 1000 and 60000);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'event_settings_draw_name_interval_check'
  ) then
    alter table public.event_settings
      add constraint event_settings_draw_name_interval_check
      check (draw_name_interval_ms between 50 and 2000);
  end if;
end $$;
