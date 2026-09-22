import { SupabaseClient } from "@supabase/supabase-js";
import { getFinancialData, FinancialData } from "@/services/finance/getFinancialData";
import { calculateBalance, BalanceCalculationResult, BalancePurchaseOrderInput } from "./calculateBalance";
import { logEgressSample } from "@/lib/observability/egress";

export interface BalanceData {
  financials: FinancialData;
  balance: BalanceCalculationResult;
  dateFrom: string;
  dateTo: string;
  timezone: string;
}

export interface GetBalanceDataParams {
  supabase: SupabaseClient;
  tenantId: string;
  dateFrom: Date;
  dateTo: Date;
  packagingCost: number;
  ignoredOrderIds: string[];
  disableProration?: boolean;
  timezone?: string;
}

/**
 * Fetches all necessary data from Finance and Purchases to compute the Balance.
 * 
 * Guarantees:
 * - Tenant isolation enforced via strict tenant_id filtering.
 * - Reuses getFinancialData directly to ensure 100% financial consistency with Finance module.
 * - Chunks purchase queries to prevent Supabase 1000-row response truncation.
 * - Does not silently swallow query errors; surfaces them as actionable errors.
 */
export async function getBalanceData(params: GetBalanceDataParams): Promise<BalanceData> {
  const {
    supabase,
    tenantId,
    dateFrom,
    dateTo,
    packagingCost,
    ignoredOrderIds,
    disableProration = false,
    timezone = "America/Argentina/Buenos_Aires",
  } = params;

  if (!tenantId) {
    throw new Error("Tenant ID is required to fetch balance data.");
  }

  // 1. Fetch sales and financial metrics
  let financials: FinancialData;
  try {
    financials = await getFinancialData(
      supabase,
      tenantId,
      dateFrom,
      dateTo,
      packagingCost,
      ignoredOrderIds,
      disableProration,
      timezone
    );
  } catch (finErr: any) {
    console.error("Error fetching financial data in getBalanceData:", finErr.message);
    throw new Error(`Error obteniendo datos financieros de ventas: ${finErr.message}`);
  }

  // 2. Fetch purchase orders with items in chunks to prevent truncation
  const PAGE_SIZE = 1000;
  let offset = 0;
  const allPurchases: BalancePurchaseOrderInput[] = [];
  let hasMore = true;

  while (hasMore) {
    const { data: purchasesData, error: purchasesErr } = await supabase
      .from("purchase_orders")
      .select(`
        id,
        supplier_name,
        purchase_date,
        created_at,
        total_amount,
        extra_costs,
        status,
        source,
        purchase_order_items (
          id,
          quantity,
          unit_cost,
          total_cost,
          sku,
          sku_normalized
        )
      `)
      .eq("tenant_id", tenantId)
      .gte("purchase_date", dateFrom.toISOString())
      .lte("purchase_date", dateTo.toISOString())
      .order("purchase_date", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (purchasesErr) {
      console.error("Error fetching purchase orders in getBalanceData:", purchasesErr.message);
      throw new Error(`Error obteniendo compras registradas del período: ${purchasesErr.message}`);
    }

    const batch = (purchasesData || []) as unknown as BalancePurchaseOrderInput[];
    allPurchases.push(...batch);

    if (batch.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      offset += PAGE_SIZE;
    }
  }

  logEgressSample({
    tenantId,
    operation: "balance.purchases",
    table: "purchase_orders",
    data: allPurchases,
  });

  // 3. Perform pure balance calculation
  const balance = calculateBalance({
    gananciaDespuesDeGastos: financials.gananciaBolsilloLimpia,
    cmv: financials.costosProductos,
    purchases: allPurchases
  });

  return {
    financials,
    balance,
    dateFrom: dateFrom.toISOString(),
    dateTo: dateTo.toISOString(),
    timezone
  };
}
