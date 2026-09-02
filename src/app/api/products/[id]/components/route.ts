import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantContext, toAuthErrorResponse } from "@/lib/security/tenantAuth";
import { CORRELATION_ID_HEADER } from "@/lib/observability/correlationId";
import { logger } from "@/lib/errors/logger";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  let correlationId: string | undefined;

  try {
    const authContext = await requireTenantContext(request);
    correlationId = authContext.correlationId;
    const tenantId = authContext.tenantId;

    const params = await context.params;
    const productId = params.id;

    if (!productId || typeof productId !== "string") {
      return NextResponse.json(
        { error: "Product ID is required" },
        { status: 400, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    const supabase = createAdminClient();

    // 1. Fetch product strictly scoped to tenant
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, title, sku, price, available_quantity, category_id, cost, raw_data")
      .eq("id", productId.trim())
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (productError || !product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // 2. Fetch components joined with inventory_items
    const { data: components, error: componentsError } = await supabase
      .from("product_components")
      .select(`
        id,
        component_sku,
        component_normalized,
        quantity,
        inventory_item_id,
        inventory_items (
          current_stock,
          average_cost,
          last_purchase_cost,
          minimum_stock
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("product_id", productId.trim());

    if (componentsError) {
      logger.error({
        event: "FETCH_PRODUCT_COMPONENTS_ERROR",
        correlationId,
        tenantId,
        error: componentsError,
        message: "Error fetching components",
      });
      return NextResponse.json(
        { error: "Error fetching components" },
        { status: 500, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // 3. Fetch active extra costs
    const { data: extraCosts, error: extraCostsError } = await supabase
      .from("product_extra_costs")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    if (extraCostsError) {
      logger.error({
        event: "FETCH_EXTRA_COSTS_ERROR",
        correlationId,
        tenantId,
        error: extraCostsError,
        message: "Error fetching extra costs",
      });
      return NextResponse.json(
        { error: "Error fetching extra costs" },
        { status: 500, headers: { [CORRELATION_ID_HEADER]: correlationId } }
      );
    }

    // 4. Calculate available combo stock from physical components
    let minComboStock = Infinity;
    const resolvedComponents = [];

    for (const comp of (components || [])) {
      const invItem = (comp as any).inventory_items;
      const currentStock = invItem?.current_stock || 0;
      const reqQty = comp.quantity || 1;
      const potentialCombo = Math.floor(currentStock / reqQty);

      if (potentialCombo < minComboStock) {
        minComboStock = potentialCombo;
      }

      resolvedComponents.push({
        id: comp.id,
        component_sku: comp.component_sku,
        component_normalized: comp.component_normalized,
        quantity: reqQty,
        inventory_item_id: comp.inventory_item_id,
        current_stock: currentStock,
        average_cost: invItem?.average_cost || 0,
        last_purchase_cost: invItem?.last_purchase_cost || 0,
        minimum_stock: invItem?.minimum_stock || 0
      });
    }

    const internalComboStock = minComboStock === Infinity ? 0 : minComboStock;

    // 5. Filter active extra costs
    const resolvedExtraCosts = [];
    const productPrice = product.price || 0;

    for (const cost of (extraCosts || [])) {
      let applies = false;
      if (cost.applies_to === "all") {
        applies = true;
      } else if (cost.applies_to === "product" && cost.product_id === productId.trim()) {
        applies = true;
      } else if (cost.applies_to === "category" && product.category_id) {
        if (cost.name.toLowerCase() === product.category_id.toLowerCase() || 
            (cost.metadata && cost.metadata.category_id === product.category_id)) {
          applies = true;
        }
      }

      if (applies) {
        let costAmount = 0;
        if (cost.cost_type === "fixed") {
          costAmount = Number(cost.amount);
        } else if (cost.cost_type === "percent") {
          costAmount = (Number(cost.amount) * productPrice) / 100;
        }
        resolvedExtraCosts.push({
          id: cost.id,
          name: cost.name,
          amount: costAmount,
          cost_type: cost.cost_type,
          rate: cost.amount
        });
      }
    }

    // 6. Alert logic
    const hasStockAlert = internalComboStock < product.available_quantity;
    const alertMessage = hasStockAlert
      ? `Stock real de depósito es inferior al publicado en Mercado Libre (${internalComboStock} combos disponibles en depósito vs ${product.available_quantity} en ML)`
      : "";

    return NextResponse.json({
      product: {
        id: product.id,
        title: product.title,
        sku: product.sku,
        price: product.price,
        meli_stock: product.available_quantity,
        cost: product.cost,
        breakdown: product.raw_data?.cost_breakdown
      },
      components: resolvedComponents,
      extra_costs: resolvedExtraCosts,
      internal_combo_stock: internalComboStock,
      has_stock_alert: hasStockAlert,
      alert_message: alertMessage
    }, { status: 200, headers: { [CORRELATION_ID_HEADER]: correlationId } });
  } catch (error: any) {
    return toAuthErrorResponse(error, correlationId);
  }
}
