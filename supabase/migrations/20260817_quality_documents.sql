create table if not exists public.quality_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 200),
  category text not null default 'אחר',
  description text,
  file_name text not null,
  file_size bigint not null check (file_size >= 0),
  mime_type text,
  storage_path text not null unique,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists quality_documents_created_at_idx
  on public.quality_documents(created_at desc);
create index if not exists quality_documents_category_idx
  on public.quality_documents(category);

alter table public.quality_documents enable row level security;
grant select, insert, delete on public.quality_documents to authenticated;

create policy "Active users can read quality documents"
on public.quality_documents for select to authenticated
using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));

create policy "Active users can add quality documents"
on public.quality_documents for insert to authenticated
with check (uploaded_by = (select auth.uid()) and exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));

create policy "Active users can delete quality documents"
on public.quality_documents for delete to authenticated
using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));

create policy "Active users can read quality document files"
on storage.objects for select to authenticated
using (bucket_id = 'quality-documents' and exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));

create policy "Active users can upload quality document files"
on storage.objects for insert to authenticated
with check (bucket_id = 'quality-documents' and owner_id = (select auth.uid()::text) and exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));

create policy "Active users can delete quality document files"
on storage.objects for delete to authenticated
using (bucket_id = 'quality-documents' and exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.is_active));
