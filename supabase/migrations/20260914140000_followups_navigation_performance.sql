-- These match the filter/sort patterns used by the followups screen.
create index if not exists quality_followups_category_status_reference_created_idx
  on public.quality_followups (category, status, reference_number, created_at desc);

create index if not exists quality_followups_active_category_idx
  on public.quality_followups (category)
  where status <> 'closed';
