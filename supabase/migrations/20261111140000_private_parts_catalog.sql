-- Schema only. Actual company catalog records must never be committed here.
begin;

create table if not exists public.quality_parts_catalog (
  organization_id uuid not null default public.current_organization_id()
    references public.organizations(id) on delete cascade,
  catalog_number text not null check (char_length(trim(catalog_number)) between 1 and 200),
  part_name text not null check (char_length(trim(part_name)) between 1 and 500),
  revision text not null default '' check (char_length(revision) <= 80),
  primary key (organization_id, catalog_number, part_name, revision)
);

alter table public.quality_parts_catalog enable row level security;
alter table public.quality_parts_catalog force row level security;
revoke all on table public.quality_parts_catalog from public, anon;
grant select, insert, update, delete on table public.quality_parts_catalog to authenticated;

drop policy if exists parts_catalog_company_read on public.quality_parts_catalog;
create policy parts_catalog_company_read on public.quality_parts_catalog
for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.is_organization_member(organization_id)
);

drop policy if exists parts_catalog_company_insert on public.quality_parts_catalog;
create policy parts_catalog_company_insert on public.quality_parts_catalog
for insert to authenticated
with check (
  organization_id = public.current_organization_id()
  and public.is_organization_member(organization_id)
  and public.has_organization_role(organization_id, array['owner', 'admin', 'quality_manager'])
);

drop policy if exists parts_catalog_company_update on public.quality_parts_catalog;
create policy parts_catalog_company_update on public.quality_parts_catalog
for update to authenticated
using (
  organization_id = public.current_organization_id()
  and public.is_organization_member(organization_id)
  and public.has_organization_role(organization_id, array['owner', 'admin', 'quality_manager'])
)
with check (
  organization_id = public.current_organization_id()
  and public.is_organization_member(organization_id)
  and public.has_organization_role(organization_id, array['owner', 'admin', 'quality_manager'])
);

drop policy if exists parts_catalog_company_delete on public.quality_parts_catalog;
create policy parts_catalog_company_delete on public.quality_parts_catalog
for delete to authenticated
using (
  organization_id = public.current_organization_id()
  and public.is_organization_member(organization_id)
  and public.has_organization_role(organization_id, array['owner', 'admin', 'quality_manager'])
);

commit;
