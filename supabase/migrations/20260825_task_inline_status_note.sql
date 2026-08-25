alter table public.tasks
  add column if not exists status_note text not null default '';

alter table public.tasks
  add constraint tasks_status_note_length
  check (char_length(status_note) <= 1000) not valid;

alter table public.tasks
  validate constraint tasks_status_note_length;
