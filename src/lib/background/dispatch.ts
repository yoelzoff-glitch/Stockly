import "server-only";
import { after } from "next/server";
import { inngest } from "@/inngest/client";
import { logger } from "@/lib/errors/logger";
import { markProductCatalogDirty } from "@/services/meli/productCoalescer";
import { updateWebhookEventStatus } from "@/lib/security/idempotency";
import { usesVercelJobs, type BackgroundEvent } from "./registry";

export async function dispatchBackgroundEvent(event: BackgroundEvent) {
  if (!usesVercelJobs()) return inngest.send(event);
  if (event.name === "meli/items.updated") {
    // Product notifications can arrive in bursts. Persist one dirty catalog
    // instead of creating a function/job per notification. Cron reads this flag.
    await markProductCatalogDirty(event.data.tenantId);
    if (event.data.eventId) await updateWebhookEventStatus(event.data.eventId, "completed");
    return { ids: [event.data.eventId].filter(Boolean) };
  }
  const { enqueueEvent } = await import("./queue");
  const result = await enqueueEvent(event);
  // The database receipt exists before returning 200 to the provider. after()
  // is only the fast path; cron resumes work after errors or process termination.
  after(async () => {
    try {
      const { drainJobs } = await import("./worker");
      await drainJobs(30000, undefined, { liveOnly: true, maxJobs: 3 });
    } catch (error: any) {
      logger.error({ event: "VERCEL_BACKGROUND_DRAIN_FAILED", message: error?.message });
    }
  });
  return result;
}
