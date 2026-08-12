-- Indexes used by the portal's most frequent filters and sort operations.
create index if not exists tasks_status_created_at_idx
  on public.tasks (status, created_at desc);

create index if not exists tasks_due_date_status_idx
  on public.tasks (due_date, status)
  where due_date is not null;

create index if not exists expiry_items_active_expiry_idx
  on public.expiry_items (is_active, expiry_date asc);

create unique index if not exists expiry_items_fingerprint_idx
  on public.expiry_items (fingerprint)
  where fingerprint is not null;

-- Required for Supabase Realtime updates between users.
do $$
begin
  alter publication supabase_realtime add table public.tasks;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.expiry_items;
exception when duplicate_object then null;
end $$;
