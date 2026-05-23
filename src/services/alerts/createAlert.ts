import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";

export async function createAlert({
  tenantId,
  title,
  body = "",
  severity = "info",
}: {
  tenantId: string;
  title: string;
  body?: string;
  severity?: "info" | "warning" | "error" | "critical";
}) {
  try {
    const supabase = createAdminClient();
    
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);

    const { data: existing } = await supabase
      .from("alerts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("title", title)
      .gte("created_at", yesterday.toISOString())
      .limit(1);

    if (existing && existing.length > 0) {
      return; // Skip duplicate
    }

    await supabase.from("alerts").insert({
      tenant_id: tenantId,
      title,
      body,
      severity,
      is_read: false,
    });
    
  } catch (error) {
    logger.error(error, "CREATE_ALERT");
  }
}
