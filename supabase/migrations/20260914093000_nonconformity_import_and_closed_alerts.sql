alter table public.quality_followups
  add column if not exists supplier_complaint text,
  add column if not exists customer_complaint text,
  add column if not exists effectiveness_due text,
  add column if not exists effectiveness_actual text;

update public.quality_followups
set alerts_enabled = false
where status = 'closed' and alerts_enabled;

create or replace function public.disable_closed_followup_alerts()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'closed' then new.alerts_enabled := false; end if;
  return new;
end;
$$;

drop trigger if exists disable_closed_followup_alerts on public.quality_followups;
create trigger disable_closed_followup_alerts
before insert or update on public.quality_followups
for each row execute function public.disable_closed_followup_alerts();
