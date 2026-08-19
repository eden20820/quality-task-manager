alter table public.quality_followups
  drop constraint if exists quality_followups_assignee_key_check;

alter table public.quality_followups
  add constraint quality_followups_assignee_key_check
  check (
    assignee_key is null
    or assignee_key in ('eden', 'sergey')
    or (assignee_key = 'quality_manager' and category in ('nonconformity', 'eco'))
  );
