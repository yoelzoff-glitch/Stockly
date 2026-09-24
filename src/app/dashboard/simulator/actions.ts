// src/app/dashboard/simulator/actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertTenantWritable } from "@/lib/demo/assert-demo-write-allowed";
import { getSellingCosts } from "@/services/meli/profitability/getSellingCosts";
import {
  SimulatorInputs,
  SimulationResult,
  MarginComparisonRow,
  calculateNetProfit,
  solveTargetPrice,
  solveBreakEvenPrice,
  generateMarginComparisonTable,
} from "@/services/profitability/simulatorEngine";
import { revalidatePath } from "next/cache";

/**
 * Obtiene el contexto seguro de sesión y tenant para el usuario actual.
 */
async function getAuthenticatedTenant() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) throw new Error("Tenant no encontrado");

  return { userId: user.id, tenantId: profile.tenant_id, supabase };
}

/**
 * MODO A: Simula la rentabilidad de un producto dado su precio de venta y costo.
 * CRÍTICO: Es 100% STATELESS. Genera 0 escrituras en Supabase.
 */
export async function simulateProfitAction(inputs: SimulatorInputs): Promise<{
  success: boolean;
  result?: SimulationResult;
  comparisonRows?: MarginComparisonRow[];
  error?: string;
}> {
  try {
    const { tenantId } = await getAuthenticatedTenant();

    if (!inputs.salePrice || inputs.salePrice <= 0) {
      return { success: false, error: "El precio de venta debe ser mayor a 0." };
    }
    if (!inputs.categoryId) {
      return { success: false, error: "Seleccioná una categoría de Mercado Libre." };
    }

    const costs = await getSellingCosts({
      tenantId,
      price: inputs.salePrice,
      categoryId: inputs.categoryId,
      listingTypeId: inputs.listingTypeId || "gold_special",
      logisticType: inputs.logisticType,
      billableWeight: inputs.billableWeight,
      freeShipping: inputs.freeShipping,
      meliItemId: inputs.meliItemId,
    });

    const result = calculateNetProfit(inputs, costs);

    // Calcular punto de equilibrio (ganancia neta = 0)
    const getCostsFn = async (p: number) => {
      return await getSellingCosts({
        tenantId,
        price: p,
        categoryId: inputs.categoryId,
        listingTypeId: inputs.listingTypeId || "gold_special",
        logisticType: inputs.logisticType,
        billableWeight: inputs.billableWeight,
        freeShipping: inputs.freeShipping,
        meliItemId: inputs.meliItemId,
      });
    };

    const breakEven = await solveBreakEvenPrice(inputs, getCostsFn);
    result.breakEvenPrice = breakEven;

    // Comparador rápido de márgenes
    const comparisonRows = await generateMarginComparisonTable(inputs, getCostsFn);

    return {
      success: true,
      result,
      comparisonRows,
    };
  } catch (error: any) {
    console.error("[simulateProfitAction] Error:", error);
    return {
      success: false,
      error: error.message || "Error al calcular simulación de rentabilidad.",
    };
  }
}

/**
 * MODO B: Resuelve el precio necesario para alcanzar un margen objetivo (Solver).
 * CRÍTICO: Es 100% STATELESS. Genera 0 escrituras en Supabase.
 */
export async function solveTargetPriceAction(
  inputs: SimulatorInputs,
  targetMarginPercent: number
): Promise<{
  success: boolean;
  targetPrice?: number;
  result?: SimulationResult;
  comparisonRows?: MarginComparisonRow[];
  error?: string;
}> {
  try {
    const { tenantId } = await getAuthenticatedTenant();

    if (!inputs.supplierCost || inputs.supplierCost <= 0) {
      return { success: false, error: "Ingresá un costo de proveedor mayor a 0." };
    }
    if (targetMarginPercent <= 0 || targetMarginPercent >= 90) {
      return { success: false, error: "El margen objetivo debe estar entre 1% y 89%." };
    }
    if (!inputs.categoryId) {
      return { success: false, error: "Seleccioná una categoría de Mercado Libre." };
    }

    const getCostsFn = async (p: number) => {
      return await getSellingCosts({
        tenantId,
        price: p,
        categoryId: inputs.categoryId,
        listingTypeId: inputs.listingTypeId || "gold_special",
        logisticType: inputs.logisticType,
        billableWeight: inputs.billableWeight,
        freeShipping: inputs.freeShipping,
        meliItemId: inputs.meliItemId,
      });
    };

    const { targetPrice, simulation } = await solveTargetPrice(
      targetMarginPercent,
      { ...inputs, targetMarginPercent },
      getCostsFn
    );

    const breakEven = await solveBreakEvenPrice(inputs, getCostsFn);
    simulation.breakEvenPrice = breakEven;

    const comparisonRows = await generateMarginComparisonTable(inputs, getCostsFn);

    return {
      success: true,
      targetPrice,
      result: simulation,
      comparisonRows,
    };
  } catch (error: any) {
    console.error("[solveTargetPriceAction] Error:", error);
    return {
      success: false,
      error: error.message || "Error al resolver precio sugerido.",
    };
  }
}

/**
 * MODO C: Resuelve el costo máximo que se puede pagar al proveedor.
 * CRÍTICO: Es 100% STATELESS. Genera 0 escrituras en Supabase.
 */
export async function solveMaxSupplierCostAction(
  inputs: SimulatorInputs,
  targetMarginPercent: number
): Promise<{
  success: boolean;
  result?: SimulationResult;
  comparisonRows?: MarginComparisonRow[];
  error?: string;
}> {
  try {
    const { tenantId } = await getAuthenticatedTenant();

    if (!inputs.salePrice || inputs.salePrice <= 0) {
      return { success: false, error: "El precio de venta esperado debe ser mayor a 0." };
    }
    if (targetMarginPercent <= 0 || targetMarginPercent >= 90) {
      return { success: false, error: "El margen objetivo debe estar entre 1% y 89%." };
    }

    const costs = await getSellingCosts({
      tenantId,
      price: inputs.salePrice,
      categoryId: inputs.categoryId,
      listingTypeId: inputs.listingTypeId || "gold_special",
      logisticType: inputs.logisticType,
      billableWeight: inputs.billableWeight,
      freeShipping: inputs.freeShipping,
      meliItemId: inputs.meliItemId,
    });

    const result = calculateNetProfit(
      { ...inputs, targetMarginPercent },
      costs
    );

    const getCostsFn = async (p: number) => {
      return await getSellingCosts({
        tenantId,
        price: p,
        categoryId: inputs.categoryId,
        listingTypeId: inputs.listingTypeId || "gold_special",
        logisticType: inputs.logisticType,
        billableWeight: inputs.billableWeight,
        freeShipping: inputs.freeShipping,
        meliItemId: inputs.meliItemId,
      });
    };

    const breakEven = await solveBreakEvenPrice(inputs, getCostsFn);
    result.breakEvenPrice = breakEven;

    const comparisonRows = await generateMarginComparisonTable(inputs, getCostsFn);

    return {
      success: true,
      result,
      comparisonRows,
    };
  } catch (error: any) {
    console.error("[solveMaxSupplierCostAction] Error:", error);
    return {
      success: false,
      error: error.message || "Error al calcular costo máximo de compra.",
    };
  }
}

/**
 * Persistencia explícita: Guarda una simulación cuando el usuario hace clic en "Guardar simulación".
 * Genera EXACTAMENTE 1 escritura en Supabase.
 */
export async function saveSimulationAction(params: {
  name: string;
  scenarioMode: string;
  inputs: SimulatorInputs;
  result: SimulationResult;
}): Promise<{ success: boolean; simulationId?: string; error?: string }> {
  try {
    const { userId, tenantId, supabase } = await getAuthenticatedTenant();
    await assertTenantWritable(tenantId);

    const cleanName = (params.name || "").trim();
    if (!cleanName) {
      return { success: false, error: "Debes ingresar un nombre para la simulación." };
    }

    const adminDb = createAdminClient();
    const { data, error } = await adminDb
      .from("profitability_simulations")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        name: cleanName,
        scenario_mode: params.scenarioMode || "profit",
        inputs: params.inputs,
        result: params.result,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[saveSimulationAction] DB Error:", error);
      return { success: false, error: `Error guardando simulación: ${error.message}` };
    }

    revalidatePath("/dashboard/simulator");
    return { success: true, simulationId: data.id };
  } catch (error: any) {
    console.error("[saveSimulationAction] Exception:", error);
    return { success: false, error: error.message || "Error al guardar simulación." };
  }
}

/**
 * Obtiene las simulaciones guardadas por el tenant (PAGINADAS).
 */
export async function getSavedSimulationsAction(
  page: number = 1,
  pageSize: number = 10
): Promise<{
  success: boolean;
  simulations: any[];
  totalCount: number;
  error?: string;
}> {
  try {
    const { tenantId, supabase } = await getAuthenticatedTenant();

    const cleanPage = Math.max(1, page);
    const cleanSize = Math.min(50, Math.max(1, pageSize));
    const offset = (cleanPage - 1) * cleanSize;

    const { data, count, error } = await supabase
      .from("profitability_simulations")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(offset, offset + cleanSize - 1);

    if (error) {
      return { success: false, simulations: [], totalCount: 0, error: error.message };
    }

    return {
      success: true,
      simulations: data || [],
      totalCount: count || 0,
    };
  } catch (error: any) {
    return {
      success: false,
      simulations: [],
      totalCount: 0,
      error: error.message,
    };
  }
}

/**
 * Elimina una simulación guardada.
 */
export async function deleteSimulationAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { tenantId, supabase } = await getAuthenticatedTenant();
    await assertTenantWritable(tenantId);

    const { error } = await supabase
      .from("profitability_simulations")
      .delete()
      .eq("id", id)
      .eq("tenant_id", tenantId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/dashboard/simulator");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Datos iniciales para el simulador:
 * - Publicaciones existentes para autocompletar.
 * - Cotización de dólar configurada en el tenant.
 * - Costo fijo de empaque configurado.
 */
export async function getSimulatorInitialDataAction() {
  try {
    const { tenantId, supabase } = await getAuthenticatedTenant();

    // 1. Obtener tenant settings (usd rate & packaging cost)
    const { data: tenant } = await supabase
      .from("tenants")
      .select("metadata")
      .eq("id", tenantId)
      .single();

    const metadata = (tenant?.metadata as any) || {};
    const usdRate = Number(metadata.usd_exchange_rate) || 1500;
    const packagingCost = Number(metadata.packaging_cost) || 0;

    // 2. Obtener publicaciones sincronizadas existentes para autocompletar
    const { data: products } = await supabase
      .from("products")
      .select("id, meli_id, title, sku, price, category_id, listing_type_id, cost, cost_price, raw_data")
      .eq("tenant_id", tenantId)
      .order("title", { ascending: true })
      .limit(100);

    return {
      success: true,
      usdRate,
      packagingCost,
      products: products || [],
    };
  } catch (error: any) {
    console.error("[getSimulatorInitialDataAction] Error:", error);
    return {
      success: false,
      usdRate: 1500,
      packagingCost: 0,
      products: [],
      error: error.message,
    };
  }
}
