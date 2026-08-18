alter table public.tasks
  add column if not exists previous_status public.task_status;
