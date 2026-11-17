import { timingSafeEqual } from "node:crypto";
import { enqueueSchedules } from "@/lib/background/queue";
import { drainJobs } from "@/lib/background/worker";
import { usesVercelJobs } from "@/lib/background/registry";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (!secret || Buffer.byteLength(authorization) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(authorization), Buffer.from(expected))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!usesVercelJobs()) return Response.json({ skipped: true, provider: "inngest" });
  try {
    const scheduled = await enqueueSchedules();
    const processed = await drainJobs();
    return Response.json({ provider: "vercel", scheduled, processed });
  } catch (error) {
    console.error("VERCEL_BACKGROUND_CRON_FAILED", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Background execution failed" }, { status: 500 });
  }
}
