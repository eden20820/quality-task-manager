alter table public.quality_followups
  add column if not exists opened_by_name text;

update public.quality_followups
set
  opened_by_name = coalesce(opened_by_name, eco_owner_name),
  name = coalesce(eco_description, name)
where category = 'eco';

create or replace function public.sync_eco_followup_names()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.category = 'eco' then
    new.opened_by_name := coalesce(new.opened_by_name, new.eco_owner_name);
    new.name := coalesce(nullif(trim(new.eco_description), ''), new.name);
  end if;
  return new;
end;
$$;

drop trigger if exists sync_eco_followup_names on public.quality_followups;
create trigger sync_eco_followup_names
before insert or update on public.quality_followups
for each row execute function public.sync_eco_followup_names();
