"use server";

import { createClient } from "@/lib/supabase/server";
import { getCompetitionAnalysis } from "@/services/ai/getCompetitionAnalysis";

export async function fetchCompetitionAnalysis(productId: string, sku: string | null, productTitle: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.tenant_id) return { error: "No tenant" };

  const query = sku || productTitle;
  return await getCompetitionAnalysis(profile.tenant_id, query);
}
