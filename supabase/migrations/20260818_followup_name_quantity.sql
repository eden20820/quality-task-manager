alter table public.quality_followups
  add column if not exists name text,
  add column if not exists quantity integer;

alter table public.quality_followups
  drop constraint if exists quality_followups_name_length_check,
  drop constraint if exists quality_followups_quantity_check;

alter table public.quality_followups
  add constraint quality_followups_name_length_check
    check (name is null or char_length(trim(name)) between 1 and 200),
  add constraint quality_followups_quantity_check
    check (quantity is null or (category = 'pka' and quantity >= 0));
