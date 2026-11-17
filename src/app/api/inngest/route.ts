import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { registeredJobs } from "@/jobs/registry";
import { usesVercelJobs } from "@/lib/background/registry";

const handlers = serve({ client: inngest, functions: registeredJobs });
// A stale Inngest registration must not run jobs after the cutover.
const disabled = async () => Response.json({ error: "Inngest temporarily disabled", provider: "vercel" }, { status: 503 });
export const GET: typeof handlers.GET = (...args) => usesVercelJobs() ? disabled() : handlers.GET(...args);
export const POST: typeof handlers.POST = (...args) => usesVercelJobs() ? disabled() : handlers.POST(...args);
export const PUT: typeof handlers.PUT = (...args) => usesVercelJobs() ? disabled() : handlers.PUT(...args);
