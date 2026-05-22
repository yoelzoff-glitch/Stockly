"use server";

import { createClient } from "@/lib/supabase/server";
import { preparePriceUpdate, prepareStockUpdate } from "@/services/ai/tools";
import { confirmPendingAction, cancelPendingAction } from "@/services/ai/actions/confirm";

export async function preparePriceChangeAction(productId: string, sku: string | null, productTitle: string, newPrice: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.tenant_id) return { error: "No tenant" };

  // Note: preparePriceUpdate in tools.ts expects an array or query.
  // Actually, tools.ts `preparePriceUpdate` takes (tenantId, query, newPrice, percentageChange).
  // If we pass SKU it will resolve the product.
  // Wait, if SKU is null, we can pass productTitle.
  const query = sku || productTitle;

  return await preparePriceUpdate(profile.tenant_id, query, newPrice, undefined);
}

export async function prepareStockChangeAction(productId: string, sku: string | null, productTitle: string, newQuantity: number, operation: 'set' | 'add' | 'subtract' = 'set') {
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

  return await prepareStockUpdate(profile.tenant_id, query, newQuantity, operation);
}

export async function confirmCommandCenterAction(actionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.tenant_id) return { success: false, error: "No tenant" };

  return await confirmPendingAction(profile.tenant_id, actionId);
}

export async function cancelCommandCenterAction(actionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.tenant_id) return { success: false, error: "No tenant" };

  return await cancelPendingAction(profile.tenant_id, actionId);
}
