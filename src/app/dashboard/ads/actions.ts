"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdsData } from "@/services/meli/getAdsData";

export async function getAdsDataAction(period: string = "30days") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) throw new Error("No tenant");

  return await getAdsData(profile.tenant_id, period);
}
