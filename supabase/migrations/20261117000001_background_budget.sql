-- Bound simultaneous work across serverless instances; keep capacity for live sales.
create index background_jobs_active_key on public.background_jobs(concurrency_key, lease_expires_at) where status='running';
create index background_jobs_completed_cleanup on public.background_jobs(updated_at) where status='completed';
drop function public.claim_background_job(uuid, uuid);
create or replace function public.claim_background_job(p_owner uuid, p_job_id uuid default null, p_live_only boolean default false)
returns setof public.background_jobs language plpgsql security definer set search_path = public as $$
declare candidate uuid; active_count integer;
begin
  -- Serialize claims only (not execution), so two requests cannot claim the
  -- same concurrency key. SKIP LOCKED handles other row-level maintenance.
  perform pg_advisory_xact_lock(179491, 17);
  update background_jobs set status = 'failed', last_error = 'Worker timed out after final attempt', updated_at = now()
    where status = 'running' and lease_expires_at <= now() and attempts >= max_attempts;
  select count(*) into active_count from background_jobs where status = 'running' and lease_expires_at > now();
  if active_count >= 2 then return; end if;
  select j.id into candidate from background_jobs j
    where (p_job_id is null or j.id = p_job_id)
      and j.attempts < j.max_attempts
      and (not p_live_only or (j.event->>'name' <> 'inngest/scheduled.timer' and j.priority < 20))
      and (j.priority < 20 or active_count = 0)
      and ((j.status = 'pending' and j.available_at <= now()) or
           (j.status = 'running' and j.lease_expires_at <= now()))
      and not exists (select 1 from background_jobs active
        where active.concurrency_key = j.concurrency_key and active.status = 'running'
          and active.lease_expires_at > now())
    order by j.priority, j.available_at, j.created_at
    limit 1 for update skip locked;
  return query update background_jobs set status = 'running', lease_owner = p_owner,
    lease_expires_at = now() + interval '330 seconds', attempts = attempts + 1, updated_at = now()
    where id = candidate returning *;
end;
$$;
revoke all on function public.claim_background_job(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.claim_background_job(uuid, uuid, boolean) to service_role;
