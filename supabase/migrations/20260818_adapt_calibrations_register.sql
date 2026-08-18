alter table public.calibration_items
  alter column next_calibration_date drop not null,
  add column if not exists model text,
  add column if not exists last_calibration_date date,
  add column if not exists certificate_number text,
  add column if not exists calibration_lab text,
  add column if not exists is_active boolean not null default true,
  add column if not exists row_key text;

create unique index if not exists calibration_items_row_key_idx
  on public.calibration_items(row_key);

create index if not exists calibration_items_active_next_date_idx
  on public.calibration_items(is_active, next_calibration_date asc);
