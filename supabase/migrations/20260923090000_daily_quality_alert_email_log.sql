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
    subject_text := 'משימות ותזכורות יומיות';
    changed_at := new.updated_at;
  else
    kind := 'expiry_alert';
    subject_text := 'התראות איכות יומיות – תפוגות, ספקים וכיולים';
    changed_at := new.updated_at;
  end if;

  insert into public.email_delivery_log (
    notification_type,
    recipient_email,
    subject,
    status,
    provider_message_id,
    error_message,
    related_entity_type,
    related_entity_id,
    source_table,
    source_notification_id,
    created_at,
    updated_at
  ) values (
    kind,
    new.recipient_email,
    subject_text,
    new.status,
    new.provider_message_id,
    new.error_message,
    entity_type,
    entity_id,
    tg_table_name,
    new.id,
    new.created_at,
    changed_at
  )
  on conflict (source_table, source_notification_id) do update
  set status = excluded.status,
      provider_message_id = excluded.provider_message_id,
      error_message = excluded.error_message,
      subject = excluded.subject,
      updated_at = excluded.updated_at;

  return new;
end;
$$;
