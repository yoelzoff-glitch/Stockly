import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateWebhookEventStatus } from "@/lib/security/idempotency";
import { logger } from "@/lib/errors/logger";
import { jobDefinitions } from "./registry";
import { enqueueEvents, loadJobs } from "./queue";

export class YieldJob extends Error {
  constructor(public resumeAt: number) { super("Background job yielded"); }
}

export function durationMs(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(value);
  if (!match) throw new Error(`Unsupported duration: ${value}`);
  return Number(match[1]) * ({ ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]]!);
}

export async function executeJob(job: any, owner: string, deadline: number, client = createAdminClient()) {
  const definition = jobDefinitions.get(job.function_id);
  if (!definition) throw new Error(`Unknown background function ${job.function_id}`);
  const steps = job.steps || {};
  async function save(values: Record<string, any>) {
    const { data, error } = await client.from("background_jobs").update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", job.id).eq("lease_owner", owner).eq("status", "running").select("id").maybeSingle();
    if (error || !data) throw new Error(error?.message || "Background job lease lost");
  }
  const step = {
    async run<T>(id: string, fn: () => Promise<T>): Promise<T> {
      if (Object.hasOwn(steps, id) && steps[id].done) return steps[id].value as T;
      if (Date.now() >= deadline) throw new YieldJob(Date.now());
      const value = await fn();
      steps[id] = { done: true, value: value ?? null };
      await save({ steps });
      return value;
    },
    async sendEvent(id: string, events: any) {
      return step.run(id, async () => {
        return enqueueEvents((Array.isArray(events) ? events : [events]).map((event, index) => ({
          event, dedupeKey: `${job.id}:${id}:${index}`,
        })), client);
      });
    },
    async sleep(id: string, duration: string) {
      const key = `sleep:${id}`;
      if (!steps[key]) {
        steps[key] = { resumeAt: Date.now() + durationMs(duration) };
        await save({ steps });
      }
      if (Date.now() < steps[key].resumeAt) throw new YieldJob(steps[key].resumeAt);
    },
  };
  try {
    await definition.handler({ event: job.event, step });
    if (job.event.data?.eventId) await updateWebhookEventStatus(job.event.data.eventId, "completed");
    await save({ status: "completed", steps: {}, lease_owner: null, lease_expires_at: null, last_error: null });
    return "completed";
  } catch (error: any) {
    if (error instanceof YieldJob) {
      await save({ status: "pending", available_at: new Date(error.resumeAt).toISOString(),
        attempts: Math.max(0, job.attempts - 1), lease_owner: null, lease_expires_at: null });
      return "yielded";
    }
    const failed = job.attempts >= job.max_attempts;
    if (failed && definition.onFailure) {
      await definition.onFailure({ event: { data: { event: job.event } }, error });
    }
    if (job.event.data?.eventId) await updateWebhookEventStatus(job.event.data.eventId, failed ? "dead_letter" : "retrying", {
      lastErrorCode: "VERCEL_BACKGROUND_FAILED", lastErrorMessage: error?.message,
    });
    const exponentialDelay = Math.min(3600000, 30000 * 2 ** Math.min(job.attempts - 1, 7));
    // Inngest's RetryAfterError exposes seconds (numeric string) or an ISO date.
    const retryAfter = error?.retryAfter;
    const requestedDelay = typeof retryAfter === "string"
      ? /^\d+(\.\d+)?$/.test(retryAfter) ? Number(retryAfter) * 1000
        : Math.max(0, (Date.parse(retryAfter) || Date.now()) - Date.now())
      : 0;
    await save({ status: failed ? "failed" : "pending", last_error: String(error?.message || error).slice(0, 1000),
      available_at: new Date(Date.now() + Math.max(exponentialDelay, requestedDelay)).toISOString(),
      lease_owner: null, lease_expires_at: null });
    logger.error({ event: "VERCEL_BACKGROUND_JOB_FAILED", functionId: job.function_id, jobId: job.id, attempt: job.attempts });
    return failed ? "failed" : "retrying";
  }
}

export async function drainJobs(budgetMs = 180000, client = createAdminClient(), options: { liveOnly?: boolean; maxJobs?: number } = {}) {
  await loadJobs();
  const deadline = Date.now() + budgetMs;
  const owner = randomUUID();
  const counts: Record<string, number> = {};
  // Start no new job/step after the budget. maxDuration leaves a margin for
  // the last API operation. A killed process is reclaimed after its lease.
  let processed = 0;
  while (Date.now() < deadline && processed < (options.maxJobs ?? 20)) {
    const { data, error } = await client.rpc("claim_background_job", { p_owner: owner, p_live_only: options.liveOnly ?? false });
    if (error) throw new Error(error.message);
    const job = data?.[0];
    if (!job) break;
    const status = await executeJob(job, owner, deadline, client);
    processed++;
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}
