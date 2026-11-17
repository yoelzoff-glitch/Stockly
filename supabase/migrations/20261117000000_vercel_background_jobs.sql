-- Durable queue for the temporary Vercel executor. No browser/client access.
create table public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  dedupe_key text not null unique,
  function_id text not null,
  event jsonb not null,
  concurrency_key text not null,
  priority integer not null default 10,
  status text not null default 'pending' check (status in ('pending','running','completed','failed')),
  attempts integer not null default 0,
  max_attempts integer not null default 7,
  available_at timestamptz not null default now(),
  lease_owner uuid,
  lease_expires_at timestamptz,
  steps jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index background_jobs_pending on public.background_jobs(priority, available_at, created_at)
  where status in ('pending','running');
alter table public.background_jobs enable row level security;
revoke all on public.background_jobs from anon, authenticated;
grant all on public.background_jobs to service_role;

create or replace function public.claim_background_job(p_owner uuid, p_job_id uuid default null)
returns setof public.background_jobs language plpgsql security definer set search_path = public as $$
declare candidate uuid;
begin
  -- Serialize claims only (not execution), so two requests cannot claim the
  -- same concurrency key. SKIP LOCKED handles other row-level maintenance.
  perform pg_advisory_xact_lock(179491, 17);
  update background_jobs set status = 'failed', last_error = 'Worker timed out after final attempt', updated_at = now()
    where status = 'running' and lease_expires_at <= now() and attempts >= max_attempts;
  select j.id into candidate from background_jobs j
    where (p_job_id is null or j.id = p_job_id)
      and j.attempts < j.max_attempts
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
revoke all on function public.claim_background_job(uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_background_job(uuid, uuid) to service_role;
