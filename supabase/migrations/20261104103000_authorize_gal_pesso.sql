-- Authorize Gal Pesso for the Caeli workspace now and on first OAuth login.

update public.profiles
set
  is_active = true,
  active_organization_id = '00000000-0000-4000-8000-000000000001'::uuid
where lower(trim(email)) = 'gal.pesso@caeli.pro';

insert into public.organization_members (organization_id, user_id, role, is_active)
select
  '00000000-0000-4000-8000-000000000001'::uuid,
  id,
  'member',
  true
from public.profiles
where lower(trim(email)) = 'gal.pesso@caeli.pro'
on conflict (organization_id, user_id) do update
set is_active = true, updated_at = now();

create or replace function public.activate_caeli_allowlisted_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(trim(coalesce(new.email, ''))) = 'gal.pesso@caeli.pro' then
    new.is_active := true;
    new.active_organization_id := '00000000-0000-4000-8000-000000000001'::uuid;
  end if;
  return new;
end;
$$;

drop trigger if exists activate_caeli_allowlisted_profile on public.profiles;
create trigger activate_caeli_allowlisted_profile
before insert or update of email on public.profiles
for each row execute function public.activate_caeli_allowlisted_profile();

create or replace function public.add_caeli_allowlisted_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(trim(coalesce(new.email, ''))) = 'gal.pesso@caeli.pro' then
    insert into public.organization_members (organization_id, user_id, role, is_active)
    values ('00000000-0000-4000-8000-000000000001'::uuid, new.id, 'member', true)
    on conflict (organization_id, user_id) do update
    set is_active = true, updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists add_caeli_allowlisted_membership on public.profiles;
create trigger add_caeli_allowlisted_membership
after insert or update of email on public.profiles
for each row execute function public.add_caeli_allowlisted_membership();
