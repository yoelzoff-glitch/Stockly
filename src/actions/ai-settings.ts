"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantContext } from "@/lib/security/tenantAuth";
import { revalidatePath } from "next/cache";
import { assertTenantWritable } from "@/lib/demo/assert-demo-write-allowed";

export async function updateAISettings(model: string) {
  const context = await requireTenantContext();
  await assertTenantWritable(context.tenantId);
  const adminSupabase = createAdminClient();

  // Fetch current metadata
  const { data: tenant } = await adminSupabase
    .from("tenants")
    .select("metadata")
    .eq("id", context.tenantId)
    .single();

  const currentMetadata = (tenant?.metadata as Record<string, any>) || {};

  // Update AI settings
  const newMetadata = {
    ...currentMetadata,
    ai_settings: {
      ...currentMetadata.ai_settings,
      model: model,
      updated_at: new Date().toISOString(),
    },
  };

  const { error } = await adminSupabase
    .from("tenants")
    .update({ metadata: newMetadata })
    .eq("id", context.tenantId);

  if (error) {
    throw new Error("Error al actualizar configuración de IA");
  }

  revalidatePath("/dashboard/integrations");

  return { success: true };
}
