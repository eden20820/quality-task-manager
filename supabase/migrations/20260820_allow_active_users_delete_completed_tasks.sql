create policy "Active users can delete completed tasks"
on public.tasks
for delete
to authenticated
using (
  status = 'completed'
  and exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.is_active
  )
);
