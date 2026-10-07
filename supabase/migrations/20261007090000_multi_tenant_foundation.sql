-- Multi-tenant foundation.
--
-- The existing production data is assigned to the first organization (Caeli).
-- New records inherit the user's active organization automatically, so the
-- current application keeps working while future customers remain isolated.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) between 1 and 120),
  legal_name text,
  logo_path text,
  primary_color text not null default '#0f172a'
    check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  timezone text not null default 'Asia/Jerusalem',
  locale text not null default 'he-IL',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists organizations_slug_lower_idx
  on public.organizations (lower(slug));

insert into public.organizations (
  id, slug, name, legal_name, timezone, locale
)
values (
  '00000000-0000-4000-8000-000000000001',
  'caeli',
  'Caeli',
  'Caeli',
  'Asia/Jerusalem',
  'he-IL'
)
on conflict (id) do nothing;

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'quality_manager', 'member', 'viewer')),
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_members_user_idx
  on public.organization_members (user_id, is_active, organization_id);

alter table public.profiles
  add column if not exists active_organization_id uuid
    references public.organizations(id) on delete restrict;

insert into public.organization_members (organization_id, user_id, role, is_active)
select
  '00000000-0000-4000-8000-000000000001'::uuid,
  profiles.id,
  case
    when lower(coalesce(profiles.email, '')) like 'eden%' then 'owner'
    else 'member'
  end,
  profiles.is_active
from public.profiles
on conflict (organization_id, user_id) do update
set is_active = excluded.is_active;

update public.profiles
set active_organization_id = '00000000-0000-4000-8000-000000000001'::uuid
where active_organization_id is null;

create or replace function public.is_organization_member(
  requested_organization_id uuid,
  requested_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members membership
    join public.profiles profile on profile.id = membership.user_id
    join public.organizations organization on organization.id = membership.organization_id
    where membership.organization_id = requested_organization_id
      and membership.user_id = requested_user_id
      and membership.is_active
      and profile.is_active
      and organization.is_active
  );
$$;

create or replace function public.has_organization_role(
  requested_organization_id uuid,
  allowed_roles text[],
  requested_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members membership
    join public.profiles profile on profile.id = membership.user_id
    where membership.organization_id = requested_organization_id
      and membership.user_id = requested_user_id
      and membership.role = any(allowed_roles)
      and membership.is_active
      and profile.is_active
  );
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select membership.organization_id
  from public.organization_members membership
  join public.profiles profile on profile.id = membership.user_id
  join public.organizations organization on organization.id = membership.organization_id
  where membership.user_id = auth.uid()
    and membership.is_active
    and profile.is_active
    and organization.is_active
  order by
    (membership.organization_id = profile.active_organization_id) desc,
    membership.joined_at asc
  limit 1;
$$;

revoke all on function public.is_organization_member(uuid, uuid) from public;
revoke all on function public.has_organization_role(uuid, text[], uuid) from public;
revoke all on function public.current_organization_id() from public;
grant execute on function public.is_organization_member(uuid, uuid) to authenticated;
grant execute on function public.has_organization_role(uuid, text[], uuid) to authenticated;
grant execute on function public.current_organization_id() to authenticated;

create table if not exists public.organization_modules (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  module_key text not null check (module_key in (
    'dashboard', 'tasks', 'calendar', 'expiry', 'calibrations',
    'suppliers', 'followups', 'documents', 'integrations'
  )),
  is_enabled boolean not null default true,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (organization_id, module_key)
);

create table if not exists public.organization_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  email_from_name text,
  daily_digest_enabled boolean not null default true,
  daily_digest_time time not null default '08:00',
  working_days smallint[] not null default array[0, 1, 2, 3, 4],
  notification_recipients jsonb not null default '[]'::jsonb,
  custom_fields jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (working_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
);

insert into public.organization_modules (organization_id, module_key)
select
  '00000000-0000-4000-8000-000000000001'::uuid,
  module_key
from unnest(array[
  'dashboard', 'tasks', 'calendar', 'expiry', 'calibrations',
  'suppliers', 'followups', 'documents', 'integrations'
]) as module_key
on conflict (organization_id, module_key) do nothing;

insert into public.organization_settings (organization_id, email_from_name)
values ('00000000-0000-4000-8000-000000000001', 'Caeli Quality Hub')
on conflict (organization_id) do nothing;

create or replace function public.provision_organization_defaults()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_modules (organization_id, module_key)
  select new.id, module_key
  from unnest(array[
    'dashboard', 'tasks', 'calendar', 'expiry', 'calibrations',
    'suppliers', 'followups', 'documents', 'integrations'
  ]) as module_key
  on conflict (organization_id, module_key) do nothing;

  insert into public.organization_settings (organization_id, email_from_name)
  values (new.id, new.name || ' Quality Hub')
  on conflict (organization_id) do nothing;

  if to_regclass('public.portal_settings') is not null then
    insert into public.portal_settings (id, organization_id)
    values ('global', new.id)
    on conflict (organization_id, id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists provision_organization_defaults on public.organizations;
create trigger provision_organization_defaults
after insert on public.organizations
for each row execute function public.provision_organization_defaults();

-- Add organization ownership to every existing business and audit table. The
-- loop is intentionally tolerant of installations where an optional module has
-- not been created yet.
do $$
declare
  table_name text;
  tenant_tables constant text[] := array[
    'tasks',
    'task_files',
    'expiry_items',
    'expiry_imports',
    'reminders',
    'quality_documents',
    'daily_digest_notifications',
    'task_email_notifications',
    'calibration_items',
    'quality_followups',
    'expiry_alert_notifications',
    'portal_settings',
    'suppliers',
    'email_delivery_log'
  ];
begin
  foreach table_name in array tenant_tables
  loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format(
        'alter table public.%I add column if not exists organization_id uuid references public.organizations(id) on delete restrict',
        table_name
      );
      execute format(
        'update public.%I set organization_id = $1 where organization_id is null',
        table_name
      ) using '00000000-0000-4000-8000-000000000001'::uuid;
      execute format(
        'alter table public.%I alter column organization_id set default public.current_organization_id()',
        table_name
      );
      execute format(
        'alter table public.%I alter column organization_id set not null',
        table_name
      );
      execute format(
        'create index if not exists %I on public.%I (organization_id)',
        table_name || '_organization_idx',
        table_name
      );
      execute format('alter table public.%I enable row level security', table_name);

      -- Existing policies still control which operations each table permits.
      -- This restrictive policy adds tenant isolation without broadening them.
      if not exists (
        select 1
        from pg_policies
        where schemaname = 'public'
          and tablename = table_name
          and policyname = 'Organization isolation'
      ) then
        execute format(
          'create policy %I on public.%I as restrictive for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id))',
          'Organization isolation',
          table_name
        );
      end if;
    end if;
  end loop;
end;
$$;

-- Uniqueness must be scoped to a company so two customers may use the same
-- business identifiers independently.
alter table if exists public.quality_followups
  drop constraint if exists quality_followups_category_reference_number_key;
alter table if exists public.quality_followups
  add constraint quality_followups_organization_category_reference_key
  unique (organization_id, category, reference_number);

drop index if exists public.calibration_items_row_key_idx;
create unique index if not exists calibration_items_organization_row_key_idx
  on public.calibration_items (organization_id, row_key)
  where row_key is not null;

drop index if exists public.expiry_items_fingerprint_idx;
create unique index if not exists expiry_items_organization_fingerprint_idx
  on public.expiry_items (organization_id, fingerprint)
  where fingerprint is not null;

alter table if exists public.suppliers
  drop constraint if exists suppliers_import_key_key;
alter table if exists public.suppliers
  add constraint suppliers_organization_import_key_key
  unique (organization_id, import_key);

alter table if exists public.daily_digest_notifications
  drop constraint if exists daily_digest_notifications_digest_date_recipient_email_key;
alter table if exists public.daily_digest_notifications
  add constraint daily_digest_notifications_organization_date_recipient_key
  unique (organization_id, digest_date, recipient_email);

alter table if exists public.expiry_alert_notifications
  drop constraint if exists expiry_alert_notifications_expiry_date_recipient_email_key;
alter table if exists public.expiry_alert_notifications
  add constraint expiry_alert_notifications_organization_date_recipient_key
  unique (organization_id, expiry_date, recipient_email);

alter table if exists public.portal_settings
  drop constraint if exists portal_settings_pkey;
alter table if exists public.portal_settings
  add constraint portal_settings_pkey primary key (organization_id, id);

-- Keep the existing ECO merge operation atomic while scoping duplicate
-- detection and updates to the active company.
create or replace function public.merge_eco_import(p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  item jsonb;
  active_organization_id uuid := public.current_organization_id();
  affected integer;
  added_count integer := 0;
  updated_count integer := 0;
  skipped_count integer := 0;
begin
  if active_organization_id is null then
    raise exception 'Unauthorized';
  end if;

  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'Invalid import payload';
  end if;

  for item in select value from jsonb_array_elements(p_rows)
  loop
    if item->>'action' = 'new' then
      insert into public.quality_followups (
        organization_id, category, reference_number, name, eco_project,
        eco_owner_name, opened_by_name, eco_description, opened_at, status,
        closed_at, alerts_enabled, notes, source_file_name, created_by, updated_at
      ) values (
        active_organization_id, 'eco', trim(item->>'reference_number'),
        trim(item->>'description'), nullif(trim(item->>'project'), ''),
        nullif(trim(item->>'owner_name'), ''), nullif(trim(item->>'owner_name'), ''),
        trim(item->>'description'), (item->>'opened_at')::date,
        item->>'status', nullif(item->>'closed_at', '')::date,
        item->>'status' <> 'closed', nullif(trim(item->>'notes'), ''),
        nullif(trim(item->>'source_file_name'), ''), auth.uid(), now()
      )
      on conflict (organization_id, category, reference_number) do nothing;
      get diagnostics affected = row_count;
      if affected = 1 then
        added_count := added_count + 1;
      else
        skipped_count := skipped_count + 1;
      end if;
    elsif item->>'action' = 'update' and nullif(item->>'existing_id', '') is not null then
      update public.quality_followups
      set
        name = trim(item->>'description'),
        eco_project = nullif(trim(item->>'project'), ''),
        eco_owner_name = nullif(trim(item->>'owner_name'), ''),
        opened_by_name = nullif(trim(item->>'owner_name'), ''),
        eco_description = trim(item->>'description'),
        opened_at = (item->>'opened_at')::date,
        status = item->>'status',
        closed_at = nullif(item->>'closed_at', '')::date,
        alerts_enabled = item->>'status' <> 'closed',
        notes = nullif(trim(item->>'notes'), ''),
        source_file_name = nullif(trim(item->>'source_file_name'), ''),
        updated_at = now()
      where id = (item->>'existing_id')::uuid
        and organization_id = active_organization_id
        and category = 'eco'
        and reference_number = trim(item->>'reference_number');
      get diagnostics affected = row_count;
      if affected = 1 then
        updated_count := updated_count + 1;
      else
        skipped_count := skipped_count + 1;
      end if;
    else
      skipped_count := skipped_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'added', added_count,
    'updated', updated_count,
    'skipped', skipped_count
  );
end;
$$;

revoke all on function public.merge_eco_import(jsonb) from public;
grant execute on function public.merge_eco_import(jsonb) to authenticated;

-- Email log triggers run as a definer, so they must copy the tenant from the
-- source notification instead of relying on auth.uid().
create or replace function public.sync_email_delivery_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text;
  subject_text text;
  entity_type text;
  entity_id uuid;
  changed_at timestamptz;
begin
  if tg_table_name = 'task_email_notifications' then
    kind := 'task_assignment';
    subject_text := 'הקצאת משימה';
    entity_type := 'task';
    entity_id := new.task_id;
    changed_at := new.created_at;
  elsif tg_table_name = 'daily_digest_notifications' then
    kind := 'daily_digest';
    subject_text := 'עדכון איכות יומי';
    changed_at := new.updated_at;
  else
    kind := 'expiry_alert';
    subject_text := 'התראות איכות יומיות – תפוגות, ספקים וכיולים';
    changed_at := new.updated_at;
  end if;

  insert into public.email_delivery_log (
    organization_id, notification_type, recipient_email, subject, status,
    provider_message_id, error_message, related_entity_type, related_entity_id,
    source_table, source_notification_id, created_at, updated_at
  ) values (
    new.organization_id, kind, new.recipient_email, subject_text, new.status,
    new.provider_message_id, new.error_message, entity_type, entity_id,
    tg_table_name, new.id, new.created_at, changed_at
  )
  on conflict (source_table, source_notification_id) do update
  set organization_id = excluded.organization_id,
      status = excluded.status,
      provider_message_id = excluded.provider_message_id,
      error_message = excluded.error_message,
      subject = excluded.subject,
      updated_at = excluded.updated_at;

  return new;
end;
$$;

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_modules enable row level security;
alter table public.organization_settings enable row level security;

grant select on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant select, insert, update, delete on public.organization_modules to authenticated;
grant select, insert, update, delete on public.organization_settings to authenticated;

create policy "Members can read their organizations"
on public.organizations for select to authenticated
using (public.is_organization_member(id));

create policy "Members can read organization membership"
on public.organization_members for select to authenticated
using (public.is_organization_member(organization_id));

create policy "Members can read organization modules"
on public.organization_modules for select to authenticated
using (public.is_organization_member(organization_id));

create policy "Managers can manage organization modules"
on public.organization_modules for all to authenticated
using (public.has_organization_role(organization_id, array['owner', 'admin', 'quality_manager']))
with check (public.has_organization_role(organization_id, array['owner', 'admin', 'quality_manager']));

create policy "Members can read organization settings"
on public.organization_settings for select to authenticated
using (public.is_organization_member(organization_id));

create policy "Managers can manage organization settings"
on public.organization_settings for all to authenticated
using (public.has_organization_role(organization_id, array['owner', 'admin', 'quality_manager']))
with check (public.has_organization_role(organization_id, array['owner', 'admin', 'quality_manager']));

comment on table public.organizations is
  'Customer workspaces. Business data is isolated by organization_id.';
comment on table public.organization_members is
  'Users and their role in each customer workspace.';
comment on table public.organization_modules is
  'Per-customer feature flags and module configuration.';
comment on table public.organization_settings is
  'Per-customer notification and extensibility settings.';
