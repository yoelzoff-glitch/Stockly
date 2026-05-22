"use server"

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProductCost(productId: string, cost: number) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) return { success: false, error: "No tenant" };

  const { error } = await supabase
    .from("products")
    .update({ cost })
    .eq("id", productId)
    .eq("tenant_id", profile.tenant_id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard");
  return { success: true };
}
