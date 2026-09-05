"use server";

import { createClient } from "@/lib/supabase/server";
import { recalculateProductCostFromComponents } from "@/services/inventory/recalculateProductCostFromComponents";
import { revalidatePath } from "next/cache";
import { assertTenantWritable } from "@/lib/demo/assert-demo-write-allowed";

/**
 * Obtiene los costos extra configurados para el tenant.
 */
export async function getExtraCosts() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) throw new Error("No tenant");

  const { data: costs, error } = await supabase
    .from("product_extra_costs")
    .select("*")
    .eq("tenant_id", profile.tenant_id)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Fetch extra costs failed: ${error.message}`);
  return costs || [];
}

/**
 * Agrega un nuevo costo extra.
 */
export async function createExtraCost(
  name: string,
  amount: number,
  costType: "fixed" | "percent" = "fixed",
  appliesTo: "product" | "category" | "all" = "all",
  productId?: string,
  categoryId?: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) throw new Error("No tenant");

  const tenantId = profile.tenant_id;
  await assertTenantWritable(tenantId);

  const metadata: any = {};
  if (categoryId) {
    metadata.category_id = categoryId;
  }

  const { data: cost, error } = await supabase
    .from("product_extra_costs")
    .insert({
      tenant_id: tenantId,
      name,
      amount,
      cost_type: costType,
      applies_to: appliesTo,
      product_id: productId || null,
      is_active: true,
      metadata
    })
    .select("id")
    .single();

  if (error || !cost) {
    throw new Error(`Failed to create extra cost: ${error?.message}`);
  }

  // Recalcular costos de productos afectados
  // Para hacerlo simple y consistente, recalculamos todos los productos del tenant
  const { data: products } = await supabase
    .from("products")
    .select("id")
    .eq("tenant_id", tenantId);

  if (products) {
    for (const p of products) {
      try {
        await recalculateProductCostFromComponents(tenantId, p.id);
      } catch (err: any) {
        console.error(`Recalculate failed during extra cost addition for product ${p.id}:`, err.message);
      }
    }
  }

  revalidatePath("/dashboard/settings/costs");
  revalidatePath("/dashboard/products");

  return { success: true };
}

/**
 * Elimina un costo extra.
 */
export async function deleteExtraCost(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) throw new Error("No tenant");

  const tenantId = profile.tenant_id;
  await assertTenantWritable(tenantId);

  const { error } = await supabase
    .from("product_extra_costs")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) throw new Error(`Delete extra cost failed: ${error.message}`);

  // Recalcular costos de todos los productos afectados
  const { data: products } = await supabase
    .from("products")
    .select("id")
    .eq("tenant_id", tenantId);

  if (products) {
    for (const p of products) {
      try {
        await recalculateProductCostFromComponents(tenantId, p.id);
      } catch (err: any) {
        console.error(`Recalculate failed during extra cost deletion for product ${p.id}:`, err.message);
      }
    }
  }

  revalidatePath("/dashboard/settings/costs");
  revalidatePath("/dashboard/products");

  return { success: true };
}
