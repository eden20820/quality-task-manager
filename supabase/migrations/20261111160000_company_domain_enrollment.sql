-- One-time setup for automatic enrollment of verified @caeli.pro accounts.
-- No service-role key is needed by the application. No anonymous access.
begin;

-- Retire profile-email-based enrollment: profile fields are not identity proof.
drop trigger if exists activate_caeli_allowlisted_profile on public.profiles;
drop trigger if exists add_caeli_allowlisted_membership on public.profiles;

create or replace function public.join_caeli_workspace()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  company constant uuid := '00000000-0000-4000-8000-000000000001'::uuid;
  verified_email text;
  display_name text;
  membership_active boolean;
  profile_active boolean;
  has_membership boolean;
begin
  if caller is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select lower(trim(u.email)), coalesce(nullif(trim(u.raw_user_meta_data->>'full_name'), ''), nullif(trim(u.raw_user_meta_data->>'name'), ''), u.email)
    into verified_email, display_name
  from auth.users u
  where u.id = caller and u.email_confirmed_at is not null
    and (u.banned_until is null or u.banned_until <= now());
  if verified_email is null or verified_email !~ '^[^@[:space:]]+@caeli[.]pro$' then
    raise exception 'A confirmed company email is required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = company and o.is_active) then
    raise exception 'Company workspace is inactive' using errcode = '42501';
  end if;

  -- Serialize simultaneous first-login requests; preserve manager roles.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(caller::text, 0));
  select m.is_active into membership_active from public.organization_members m
    where m.organization_id = company and m.user_id = caller for update;
  has_membership := found;
  select p.is_active into profile_active from public.profiles p where p.id = caller for update;
  -- A manual suspension must never be undone by refreshing or logging in.
  if has_membership and (membership_active is false or profile_active is false) then
    raise exception 'Company access is suspended' using errcode = '42501';
  end if;

  insert into public.profiles (id, email, full_name, is_active, active_organization_id)
  values (caller, verified_email, left(display_name, 200), true, company)
  on conflict (id) do update set email = excluded.email, is_active = true,
    active_organization_id = excluded.active_organization_id;

  insert into public.organization_members (organization_id, user_id, role, is_active)
  values (company, caller, 'member', true)
  on conflict (organization_id, user_id) do nothing;
  return company;
end;
$$;

revoke all on function public.join_caeli_workspace() from public, anon;
grant execute on function public.join_caeli_workspace() to authenticated;

-- Shared read access for every business tab, not only forms. Existing write
-- permissions and restrictive organization policies remain untouched.
do $$
declare
  business_table text;
begin
  foreach business_table in array array[
    'tasks', 'task_files', 'expiry_items', 'expiry_imports', 'reminders',
    'quality_documents', 'calibration_items', 'quality_followups', 'suppliers',
    'portal_settings', 'supplier_binders', 'supplier_binder_entries',
    'quality_parts_catalog'
  ] loop
    if to_regclass(format('public.%I', business_table)) is not null then
      if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = business_table and column_name = 'organization_id') then
        raise exception 'Organization isolation missing on %', business_table;
      end if;
      execute format('alter table public.%I enable row level security', business_table);
      execute format('grant select on public.%I to authenticated', business_table);
      execute format('drop policy if exists "Caeli staff shared read" on public.%I', business_table);
      execute format('create policy "Caeli staff shared read" on public.%I for select to authenticated using (organization_id = %L::uuid and public.is_organization_member(organization_id))', business_table, '00000000-0000-4000-8000-000000000001');
    end if;
  end loop;
end;
$$;

commit;
