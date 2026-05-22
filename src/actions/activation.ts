"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type ActivationStep = {
  id: string;
  title: string;
  completed: boolean;
  actionUrl?: string;
};

export async function getActivationProgress() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!profile?.tenant_id) throw new Error("Tenant no encontrado");

  const tenantId = profile.tenant_id;

  // 1. Check DB states automatically
  const { data: meli } = await supabase.from("meli_accounts").select("id").eq("tenant_id", tenantId).single();
  const { count: productCount } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
  const { count: orderCount } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
  const { count: costCount } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gt("unit_cost", 0);
  const { data: tenant } = await supabase.from("tenants").select("metadata").eq("id", tenantId).single();

  // Read manually completed steps from tenant_progress
  const { data: manualProgress } = await supabase
    .from("tenant_progress")
    .select("step, completed")
    .eq("tenant_id", tenantId);

  const isManualCompleted = (stepId: string) => {
    return manualProgress?.some(p => p.step === stepId && p.completed) || false;
  };

  const steps: ActivationStep[] = [
    {
      id: "connect_meli",
      title: "Conectar Mercado Libre",
      completed: !!meli,
      actionUrl: "/api/auth/mercadolibre"
    },
    {
      id: "sync_products",
      title: "Sincronizar productos",
      completed: (productCount || 0) > 0,
      actionUrl: "/dashboard/products"
    },
    {
      id: "sync_orders",
      title: "Sincronizar órdenes",
      completed: (orderCount || 0) > 0,
      actionUrl: "/dashboard/sales"
    },
    {
      id: "load_costs",
      title: "Cargar costos",
      completed: (costCount || 0) > 0,
      actionUrl: "/dashboard/products"
    },
    {
      id: "config_ai",
      title: "Configurar preferencias IA",
      completed: tenant?.metadata?.ai_pricing_strategy !== undefined,
      actionUrl: "/dashboard/settings"
    },
    {
      id: "connect_whatsapp",
      title: "Conectar WhatsApp",
      completed: isManualCompleted("connect_whatsapp"), // Mocked
      actionUrl: "/dashboard/settings"
    },
    {
      id: "first_ai_query",
      title: "Hacer primera consulta IA",
      completed: isManualCompleted("first_ai_query"),
      actionUrl: "/dashboard/intelligence"
    }
  ];

  const completedSteps = steps.filter(s => s.completed).length;
  const totalSteps = steps.length;
  const percentage = Math.round((completedSteps / totalSteps) * 100);

  return { steps, percentage, completedSteps, totalSteps };
}

export async function markStepCompletedAction(stepId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("id", user.id).single();
  if (!profile?.tenant_id) throw new Error("Tenant no encontrado");

  // Upsert progress
  await supabase
    .from("tenant_progress")
    .upsert({
      tenant_id: profile.tenant_id,
      step: stepId,
      completed: true,
      completed_at: new Date().toISOString()
    }, { onConflict: "tenant_id, step" });

  revalidatePath("/dashboard/get-started");
  revalidatePath("/dashboard");
}
