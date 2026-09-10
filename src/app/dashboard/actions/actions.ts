"use server";

import { createClient } from "@/lib/supabase/server";

export interface AiActionDetail {
  id: string;
  tenant_id: string;
  action_type: string;
  status: string;
  title: string;
  description: string | null;
  payload: Record<string, any>;
  result: Record<string, any> | null;
  failed_reason: string | null;
  created_at: string;
  executed_at: string | null;
  confirmed_at: string | null;
}

/**
 * Descarga perezosa (lazy) del payload y result completos para una única acción.
 * Respeta estricto aislamiento multi-tenant.
 */
export async function getAiActionDetail(actionId: string): Promise<AiActionDetail | null> {
  if (!actionId) return null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) throw new Error("Tenant not found");

  const { data: action, error } = await supabase
    .from("ai_actions")
    .select("id, tenant_id, action_type, status, title, description, payload, result, failed_reason, created_at, executed_at, confirmed_at")
    .eq("id", actionId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (error || !action) {
    return null;
  }

  return action as AiActionDetail;
}
