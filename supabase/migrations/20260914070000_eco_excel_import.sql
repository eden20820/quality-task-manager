alter table public.quality_followups
  add column if not exists eco_project text,
  add column if not exists eco_owner_name text,
  add column if not exists eco_description text,
  add column if not exists opened_by_name text,
  add column if not exists source_file_name text;

create or replace function public.merge_eco_import(p_rows jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  item jsonb;
  affected integer;
  added_count integer := 0;
  updated_count integer := 0;
  skipped_count integer := 0;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and is_active
  ) then
    raise exception 'Unauthorized';
  end if;

  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'Invalid import payload';
  end if;

  for item in select value from jsonb_array_elements(p_rows)
  loop
    if item->>'action' = 'new' then
      insert into public.quality_followups (
        category, reference_number, name, eco_project, eco_owner_name, opened_by_name,
        eco_description, opened_at, status, closed_at, alerts_enabled, notes,
        source_file_name, created_by, updated_at
      ) values (
        'eco', trim(item->>'reference_number'), trim(item->>'description'),
        nullif(trim(item->>'project'), ''), nullif(trim(item->>'owner_name'), ''), nullif(trim(item->>'owner_name'), ''),
        trim(item->>'description'), (item->>'opened_at')::date,
        item->>'status', nullif(item->>'closed_at', '')::date, item->>'status' <> 'closed',
        nullif(trim(item->>'notes'), ''), nullif(trim(item->>'source_file_name'), ''),
        auth.uid(), now()
      )
      on conflict (category, reference_number) do nothing;
      get diagnostics affected = row_count;
      if affected = 1 then added_count := added_count + 1;
      else skipped_count := skipped_count + 1;
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
        and category = 'eco'
        and reference_number = trim(item->>'reference_number');
      get diagnostics affected = row_count;
      if affected = 1 then updated_count := updated_count + 1;
      else skipped_count := skipped_count + 1;
      end if;
    else
      skipped_count := skipped_count + 1;
    end if;
  end loop;

  return jsonb_build_object('added', added_count, 'updated', updated_count, 'skipped', skipped_count);
end;
$$;

revoke all on function public.merge_eco_import(jsonb) from public;
grant execute on function public.merge_eco_import(jsonb) to authenticated;
