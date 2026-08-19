create or replace function public.verify_quality_cron_secret(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from vault.decrypted_secrets
      where name = 'quality_cron_secret'
        and decrypted_secret = candidate
    ),
    false
  );
$$;

revoke all on function public.verify_quality_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_quality_cron_secret(text) to service_role;
