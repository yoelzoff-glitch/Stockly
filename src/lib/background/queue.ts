import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { jobDefinitions, type BackgroundEvent } from "./registry";
import { intervalBucket, VERCEL_INTERVAL_MINUTES } from "./policy";

export async function loadJobs() {
  await import("@/jobs/registry");
}

export async function enqueueEvent(event: BackgroundEvent, dedupeKey?: string, client = createAdminClient()) {
  return enqueueEvents([{ event, dedupeKey }], client);
}

export async function enqueueEvents(entries: { event: BackgroundEvent; dedupeKey?: string }[], client = createAdminClient()) {
  if (!entries.length) return { ids: [] };
  await loadJobs();
  const rows = entries.flatMap(({ event, dedupeKey }) => {
    const matching = [...jobDefinitions.values()].filter(job => job.triggers.some(t => t.event === event.name));
    if (!matching.length) throw new Error(`No background handler for ${event.name}`);
    const key = event.name === "meli/orders.repair.requested" && event.data.repair
      ? `initial-repair:${event.data.tenantId}`
      : dedupeKey || event.id || event.data.eventId || randomUUID();
    return matching.map(job => ({
      dedupe_key: `${job.id}:${key}`,
      function_id: job.id,
      event: { ...event, id: event.id || String(key) },
      concurrency_key: `${job.id}:${event.data.tenantId || event.data.resourceId || "global"}`,
      priority: event.name === "meli/orders.updated" ? 0 : event.name.includes("repair") ? 30 : 10,
      max_attempts: (job.retries ?? 6) + 1,
    }));
  });
  const { error } = await client.from("background_jobs").upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) throw new Error(`Cannot persist background event: ${error.message}`);
  return { ids: rows.map(row => row.dedupe_key) };
}

// One Vercel cron tick dispatches due schedules. Buckets tolerate delayed ticks
// and repeated delivery, without recreating every missed five-minute execution.
export function scheduleBucket(cron: string, now: Date): string | null {
  const [minute, hour, day, month, weekday] = cron.split(" ");
  if (day !== "*" || month !== "*" || weekday !== "*") throw new Error(`Unsupported schedule: ${cron}`);
  const date = new Date(now);
  date.setUTCSeconds(0, 0);
  if (minute.startsWith("*/") && hour === "*") {
    date.setUTCMinutes(Math.floor(date.getUTCMinutes() / Number(minute.slice(2))) * Number(minute.slice(2)));
  } else if (minute === "0" && (hour === "*" || hour.startsWith("*/"))) {
    const period = hour === "*" ? 1 : Number(hour.slice(2));
    date.setUTCHours(Math.floor(date.getUTCHours() / period) * period, 0, 0, 0);
  } else if (minute === "0" && /^\d+$/.test(hour)) {
    date.setUTCHours(Number(hour), 0, 0, 0);
    if (date > now) date.setUTCDate(date.getUTCDate() - 1);
  } else throw new Error(`Unsupported schedule: ${cron}`);
  return date.toISOString();
}

export async function enqueueSchedules(now = new Date(), client = createAdminClient()) {
  await loadJobs();
  const rows = [...jobDefinitions.values()].flatMap(job => job.triggers.filter(t => t.cron).map(trigger => {
    const interval = VERCEL_INTERVAL_MINUTES[job.id];
    const bucket = interval ? intervalBucket(interval, now) : scheduleBucket(trigger.cron!, now);
    const key = `cron:${job.id}:${bucket}`;
    return {
      dedupe_key: key, function_id: job.id,
      event: { id: key, name: "inngest/scheduled.timer", data: { source: "vercel_cron" } },
      concurrency_key: `${job.id}:global`, priority: job.id === "sync-orders-dispatcher" ? 1 : 20,
      max_attempts: (job.retries ?? 6) + 1,
    };
  }));
  const { data: existing, error: readError } = await client.from("background_jobs").select("dedupe_key")
    .in("dedupe_key", rows.map(row => row.dedupe_key));
  if (readError) throw new Error(readError.message);
  const seen = new Set((existing || []).map(row => row.dedupe_key));
  const due = rows.filter(row => !seen.has(row.dedupe_key));
  if (!due.length) return 0;
  const { error } = await client.from("background_jobs").upsert(due, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) throw new Error(`Cannot persist cron jobs: ${error.message}`);
  // Retain a week of completed execution receipts, always longer than the
  // daily schedule's deduplication period. Failed/pending jobs are never purged.
  if (due.some(row => row.function_id === "cleanup-zombie-users")) {
    const { error: cleanupError } = await client.from("background_jobs").delete()
      .eq("status", "completed").lt("updated_at", new Date(now.getTime() - 7 * 86400000).toISOString());
    if (cleanupError) throw new Error(cleanupError.message);
  }
  return due.length;
}
