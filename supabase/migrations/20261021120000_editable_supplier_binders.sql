create table if not exists public.supplier_binders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 40),
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, label),
  unique (organization_id, id)
);

create table if not exists public.supplier_binder_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default public.current_organization_id() references public.organizations(id) on delete cascade,
  binder_id uuid not null,
  display_name text not null check (char_length(trim(display_name)) between 1 and 300),
  supplier_id uuid references public.suppliers(id) on delete set null,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplier_binder_entries_binder_fk
    foreign key (organization_id, binder_id)
    references public.supplier_binders(organization_id, id)
    on delete cascade,
  unique (binder_id, sort_order)
);

create index if not exists supplier_binders_organization_order_idx
  on public.supplier_binders (organization_id, sort_order);
create index if not exists supplier_binder_entries_binder_order_idx
  on public.supplier_binder_entries (binder_id, sort_order);
create index if not exists supplier_binder_entries_supplier_idx
  on public.supplier_binder_entries (supplier_id);

alter table public.supplier_binders enable row level security;
alter table public.supplier_binder_entries enable row level security;
grant select, insert, update, delete on public.supplier_binders to authenticated;
grant select, insert, update, delete on public.supplier_binder_entries to authenticated;

create policy "Members can read supplier binders" on public.supplier_binders
for select to authenticated using (public.is_organization_member(organization_id));
create policy "Members can add supplier binders" on public.supplier_binders
for insert to authenticated with check (public.is_organization_member(organization_id));
create policy "Members can update supplier binders" on public.supplier_binders
for update to authenticated using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));
create policy "Members can delete supplier binders" on public.supplier_binders
for delete to authenticated using (public.is_organization_member(organization_id));

create policy "Members can read supplier binder entries" on public.supplier_binder_entries
for select to authenticated using (public.is_organization_member(organization_id));
create policy "Members can add supplier binder entries" on public.supplier_binder_entries
for insert to authenticated with check (public.is_organization_member(organization_id));
create policy "Members can update supplier binder entries" on public.supplier_binder_entries
for update to authenticated using (public.is_organization_member(organization_id))
with check (public.is_organization_member(organization_id));
create policy "Members can delete supplier binder entries" on public.supplier_binder_entries
for delete to authenticated using (public.is_organization_member(organization_id));

insert into public.supplier_binders (id, organization_id, label, sort_order)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'I', 1),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'II', 2),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'III', 3),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'IV-B', 4),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'V', 5),
  ('10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', 'VI-B', 6),
  ('10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', 'VII-B', 7),
  ('10000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', 'VIII-B', 8)
on conflict (organization_id, label) do nothing;

insert into public.supplier_binder_entries (organization_id, binder_id, display_name, sort_order)
select '00000000-0000-4000-8000-000000000001'::uuid, binder_id, display_name, sort_order
from (values
  ('10000000-0000-4000-8000-000000000001'::uuid, 'WURTH', 1), ('10000000-0000-4000-8000-000000000001', 'טכנו-דורג', 2), ('10000000-0000-4000-8000-000000000001', 'אל.די.אר טכנולוגיות', 3), ('10000000-0000-4000-8000-000000000001', 'Plastomold', 4), ('10000000-0000-4000-8000-000000000001', 'har-zion', 5), ('10000000-0000-4000-8000-000000000001', 'אילון את גביש', 6), ('10000000-0000-4000-8000-000000000001', 'סרמט בע״מ', 7),
  ('10000000-0000-4000-8000-000000000002', 'אירוסל', 1), ('10000000-0000-4000-8000-000000000002', 'אורגת סחר', 2), ('10000000-0000-4000-8000-000000000002', 'טכנו עד', 3), ('10000000-0000-4000-8000-000000000002', 'פלונטר טכנולוגיות', 4), ('10000000-0000-4000-8000-000000000002', 'GalBoreg', 5), ('10000000-0000-4000-8000-000000000002', 'Jetlazer', 6), ('10000000-0000-4000-8000-000000000002', 'Rotal', 7), ('10000000-0000-4000-8000-000000000002', 'Decostop', 8), ('10000000-0000-4000-8000-000000000002', 'bental motian systems', 9), ('10000000-0000-4000-8000-000000000002', 'קפיצי בוחבוט אשגם בע״מ', 10),
  ('10000000-0000-4000-8000-000000000003', 'CHEMSOL', 1), ('10000000-0000-4000-8000-000000000003', 'WINEXT', 2), ('10000000-0000-4000-8000-000000000003', 'גדעון שמיים', 3), ('10000000-0000-4000-8000-000000000003', 'גבריאל-טק', 4), ('10000000-0000-4000-8000-000000000003', 'Tarantula', 5), ('10000000-0000-4000-8000-000000000003', 'DIGIKEY', 6), ('10000000-0000-4000-8000-000000000003', 'ברקוד סנטר', 7), ('10000000-0000-4000-8000-000000000003', 'גוטמן ברזילי', 8), ('10000000-0000-4000-8000-000000000003', 'AMRON', 9), ('10000000-0000-4000-8000-000000000003', 'MASTERAN LTD', 10), ('10000000-0000-4000-8000-000000000003', 'Shenzhen Tianzhi', 11),
  ('10000000-0000-4000-8000-000000000004', 'Sampling systems', 1), ('10000000-0000-4000-8000-000000000004', 'HLH', 2), ('10000000-0000-4000-8000-000000000004', 'סקופ מתכות', 3), ('10000000-0000-4000-8000-000000000004', 'Nautec', 4),
  ('10000000-0000-4000-8000-000000000005', 'סטילקוט', 1), ('10000000-0000-4000-8000-000000000005', 'Bladtech', 2), ('10000000-0000-4000-8000-000000000005', 'SMC', 3), ('10000000-0000-4000-8000-000000000005', 'בנבנית', 4), ('10000000-0000-4000-8000-000000000005', 'JMI', 5), ('10000000-0000-4000-8000-000000000005', 'PCB Way', 6),
  ('10000000-0000-4000-8000-000000000006', 'וולפסון סיליקון', 1), ('10000000-0000-4000-8000-000000000006', 'Breton', 2), ('10000000-0000-4000-8000-000000000006', 'Mouser', 3), ('10000000-0000-4000-8000-000000000006', 'Reefs RC', 4), ('10000000-0000-4000-8000-000000000006', 'תמיר ערן הנדסה', 5),
  ('10000000-0000-4000-8000-000000000007', 'LMI', 1), ('10000000-0000-4000-8000-000000000007', 'אלון טכנולוגיות', 2), ('10000000-0000-4000-8000-000000000007', 'דגות', 3), ('10000000-0000-4000-8000-000000000007', 'CONLOG', 4), ('10000000-0000-4000-8000-000000000007', 'מאי', 5), ('10000000-0000-4000-8000-000000000007', 'עולם הרפואה', 6), ('10000000-0000-4000-8000-000000000007', 'שמיר', 7), ('10000000-0000-4000-8000-000000000007', 'Marchton', 8), ('10000000-0000-4000-8000-000000000007', 'AMI', 9), ('10000000-0000-4000-8000-000000000007', 'עמוס גזית', 10), ('10000000-0000-4000-8000-000000000007', 'זיטק', 11), ('10000000-0000-4000-8000-000000000007', '3M', 12), ('10000000-0000-4000-8000-000000000007', 'DoorNet', 13),
  ('10000000-0000-4000-8000-000000000008', 'Poseidon', 1), ('10000000-0000-4000-8000-000000000008', 'Alconox', 2), ('10000000-0000-4000-8000-000000000008', 'Wirtheim', 3), ('10000000-0000-4000-8000-000000000008', 'FLIR', 4), ('10000000-0000-4000-8000-000000000008', 'רומיכל', 5), ('10000000-0000-4000-8000-000000000008', 'ליליטק', 6), ('10000000-0000-4000-8000-000000000008', '3M', 7), ('10000000-0000-4000-8000-000000000008', 'TTI', 8), ('10000000-0000-4000-8000-000000000008', 'Door Net', 9)
) as seed(binder_id, display_name, sort_order)
where exists (select 1 from public.supplier_binders b where b.id = seed.binder_id)
on conflict (binder_id, sort_order) do nothing;
