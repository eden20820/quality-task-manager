create or replace function public.get_dashboard_data(
  p_today date,
  p_thirty_days date,
  p_week_start date,
  p_week_end date,
  p_dashboard_cleared_at timestamptz default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $function$
  select jsonb_build_object(
    'active_tasks', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.created_at desc)
      from (
        select id, task_number, title, description, status_note, assignees,
               status, priority, due_date, created_at
        from public.tasks
        where status <> 'completed'
        order by created_at desc
      ) t
    ), '[]'::jsonb),
    'new_tasks', (
      select count(*)
      from public.tasks
      where status = 'new'
    ),
    'expiring_items', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.expiry_date)
      from (
        select id, material_name, expiry_date
        from public.expiry_items
        where is_active = true
          and expiry_date between p_today and p_thirty_days
      ) e
    ), '[]'::jsonb),
    'weekly_reminders', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.reminder_date)
      from (
        select id, title, reminder_date, repeat_unit, repeat_interval
        from public.reminders
        where reminder_date <= p_week_end
      ) r
    ), '[]'::jsonb),
    'weekly_deadline_tasks', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.due_date)
      from (
        select id, title, due_date
        from public.tasks
        where status not in ('completed', 'cancelled')
          and due_date between p_week_start and p_week_end
      ) t
    ), '[]'::jsonb),
    'upcoming_calibrations', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.next_calibration_date)
      from (
        select id, equipment_name, next_calibration_date
        from public.calibration_items
        where is_active = true
          and next_calibration_date between p_today and p_thirty_days
      ) c
    ), '[]'::jsonb),
    'upcoming_suppliers', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.expiration_date)
      from (
        select id, supplier_name, expiration_date
        from public.suppliers
        where expiration_date between p_today and p_thirty_days
      ) s
    ), '[]'::jsonb),
    'alert_settings', coalesce((
      select to_jsonb(s)
      from (
        select calibration_alerts_enabled, supplier_alerts_enabled
        from public.portal_settings
        where id = 'global'
        limit 1
      ) s
    ), '{"calibration_alerts_enabled":true,"supplier_alerts_enabled":true}'::jsonb),
    'weekly_calibrations', coalesce((
      select jsonb_agg(to_jsonb(c) order by c.next_calibration_date)
      from (
        select id, equipment_name, next_calibration_date
        from public.calibration_items
        where is_active = true
          and next_calibration_date between p_week_start and p_week_end
      ) c
    ), '[]'::jsonb),
    'weekly_suppliers', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.expiration_date)
      from (
        select id, supplier_name, expiration_date
        from public.suppliers
        where expiration_date between p_week_start and p_week_end
      ) s
    ), '[]'::jsonb),
    'weekly_followups', coalesce((
      select jsonb_agg(to_jsonb(f) order by f.created_at)
      from (
        select id, category, reference_number, name, created_at
        from public.quality_followups
        where status in ('open', 'waiting')
          and alerts_enabled = true
          and created_at <= (p_week_end::timestamp + interval '1 day' - interval '1 millisecond')
      ) f
    ), '[]'::jsonb),
    'weekly_expiry_items', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.expiry_date)
      from (
        select id, material_name, location, expiry_date
        from public.expiry_items
        where is_active = true
          and expiry_date between p_week_start and p_week_end
      ) e
    ), '[]'::jsonb)
  );
$function$;

revoke all on function public.get_dashboard_data(date, date, date, date, timestamptz) from public, anon;
grant execute on function public.get_dashboard_data(date, date, date, date, timestamptz) to authenticated;
