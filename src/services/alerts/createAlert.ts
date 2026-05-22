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
  severity?: "info" | "warning" | "error";
}) {
  try {
    const supabase = createAdminClient();
    
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
