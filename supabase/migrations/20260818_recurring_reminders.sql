alter table public.reminders
  add column if not exists repeat_unit text,
  add column if not exists repeat_interval integer;

alter table public.reminders
  drop constraint if exists reminders_repeat_unit_check,
  add constraint reminders_repeat_unit_check check (repeat_unit is null or repeat_unit in ('day', 'month')),
  drop constraint if exists reminders_repeat_interval_check,
  add constraint reminders_repeat_interval_check check (
    (repeat_unit is null and repeat_interval is null)
    or (repeat_unit is not null and repeat_interval is not null and repeat_interval > 0)
  );
