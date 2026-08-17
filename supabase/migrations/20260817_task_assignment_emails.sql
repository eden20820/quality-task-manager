alter table public.tasks
  add column if not exists assignees text[] not null default '{}';

create index if not exists tasks_assignees_gin_idx
  on public.tasks using gin (assignees);

create table if not exists public.task_email_notifications (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  assignee_key text not null check (assignee_key in ('eden', 'sergey', 'quality_manager')),
  recipient_email text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  provider_message_id text,
  error_message text,
  created_at timestamptz not null default now(),
  unique (task_id, assignee_key)
);

create index if not exists task_email_notifications_task_id_idx
  on public.task_email_notifications(task_id);

alter table public.task_email_notifications enable row level security;
grant select, insert on public.task_email_notifications to authenticated;

create policy "Active users can read task email notifications"
on public.task_email_notifications for select to authenticated
using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));

create policy "Active users can log task email notifications"
on public.task_email_notifications for insert to authenticated
with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));
