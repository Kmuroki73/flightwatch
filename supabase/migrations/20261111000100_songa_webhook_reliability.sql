-- Songa commerce webhook processing leases.
-- Apply after 20261109000100_songa_shared_commerce.sql.
alter table public.songa_commerce_webhook_events
  add column if not exists processing_started_at timestamptz,
  add column if not exists last_error text,
  add column if not exists attempt_count integer not null default 0;

create or replace function public.songa_claim_commerce_webhook_event(
  p_event_id text,
  p_event_type text,
  p_payload jsonb
)
returns table(claimed boolean, processed boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_id uuid;
  already_processed boolean;
begin
  insert into public.songa_commerce_webhook_events
    (event_id, event_type, payload, processed, processing_started_at, attempt_count)
  values
    (p_event_id, p_event_type, p_payload, false, now(), 1)
  on conflict (event_id) do update
    set processing_started_at = now(),
        attempt_count = public.songa_commerce_webhook_events.attempt_count + 1,
        last_error = null
    where public.songa_commerce_webhook_events.processed = false
      and (
        public.songa_commerce_webhook_events.processing_started_at is null
        or public.songa_commerce_webhook_events.processing_started_at < now() - interval '5 minutes'
      )
  returning id into claimed_id;

  if claimed_id is not null then
    return query select true, false;
    return;
  end if;

  select e.processed into already_processed
  from public.songa_commerce_webhook_events e
  where e.event_id = p_event_id;

  return query select false, coalesce(already_processed, false);
end;
$$;

revoke all on function public.songa_claim_commerce_webhook_event(text, text, jsonb) from public;
revoke all on function public.songa_claim_commerce_webhook_event(text, text, jsonb) from anon, authenticated;
grant execute on function public.songa_claim_commerce_webhook_event(text, text, jsonb) to service_role;
