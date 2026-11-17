import { inngest } from "@/inngest/client";

export type BackgroundEvent = { id?: string; name: string; data: Record<string, any> };
export type JobDefinition = {
  id: string;
  triggers: { cron?: string; event?: string }[];
  retries?: number;
  handler: (context: any) => Promise<any>;
  onFailure?: (context: any) => Promise<any>;
};

export const jobDefinitions = new Map<string, JobDefinition>();

// Keep the existing SDK types and rollback definitions, but expose the handlers
// to the Vercel worker without relying on private Inngest runtime APIs.
export const defineJob: typeof inngest.createFunction = ((options: any, handler: any) => {
  jobDefinitions.set(options.id, { ...options, handler });
  return inngest.createFunction(options, handler);
}) as typeof inngest.createFunction;

export function usesVercelJobs() {
  return process.env.LIBRETAX_BACKGROUND_PROVIDER !== "inngest";
}
