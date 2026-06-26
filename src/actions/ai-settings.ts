"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateAISettings(model: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) throw new Error("Tenant no encontrado");

  // Fetch current metadata
  const { data: tenant } = await supabase
    .from("tenants")
    .select("metadata")
    .eq("id", profile.tenant_id)
    .single();

  const currentMetadata = tenant?.metadata || {};
  
  // Update AI settings
  const newMetadata = {
    ...currentMetadata,
    ai_settings: {
      ...currentMetadata.ai_settings,
      model: model,
      updated_at: new Date().toISOString()
    }
  };

  await supabase
    .from("tenants")
    .update({ metadata: newMetadata })
    .eq("id", profile.tenant_id);

  revalidatePath("/dashboard/integrations");
  
  return { success: true };
}
