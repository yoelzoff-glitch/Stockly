import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getListingFees } from "@/services/meli/getListingFees";
import { getShippingCostEstimate } from "@/services/meli/getShippingCostEstimate";
import { calculateRealProfitability } from "@/services/profitability/calculateRealProfitability";
import * as Sentry from "@sentry/nextjs";

export async function POST() {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const tenantId = profile?.tenant_id;
    if (!tenantId) return NextResponse.json({ error: "No tenant assigned" }, { status: 403 });

    // Obtener Meli Account para el token
    const { data: meliAccount } = await adminSupabase
      .from("meli_accounts")
      .select("access_token")
      .eq("tenant_id", tenantId)
      .single();

    if (!meliAccount) {
      return NextResponse.json({ error: "No Mercado Libre account connected" }, { status: 400 });
    }

    // Obtener costo de embalaje del tenant
    const { data: tenantData } = await adminSupabase
      .from("tenants")
      .select("metadata")
      .eq("id", tenantId)
      .single();
    
    const tenantMetadata = (tenantData?.metadata as any) || {};
    const packagingCost = tenantMetadata.packaging_cost || 0;

    // Obtener todos los productos del tenant
    const { data: products } = await adminSupabase
      .from("products")
      .select("*")
      .eq("tenant_id", tenantId);

    if (!products || products.length === 0) {
      return NextResponse.json({ message: "No products to recalculate", updated: 0 });
    }

    let updatedCount = 0;

    for (const product of products) {
      const siteId = product.raw_data?.site_id || "MLA";
      
      const feeData = await getListingFees(
        siteId, 
        product.price, 
        product.category_id, 
        product.listing_type_id, 
        tenantId
      );
      
      const shippingData = await getShippingCostEstimate(product.meli_item_id, meliAccount.access_token);

      const estimatedFee = feeData?.sale_fee_amount ?? null;
      const estimatedShipping = shippingData.estimated_shipping_cost;

      const profitResult = calculateRealProfitability({
        price: product.price,
        cost: product.cost,
        estimated_fee: estimatedFee,
        extra_fee_amount: product.extra_fee_amount || 0,
        estimated_shipping_cost: estimatedShipping,
        promotion_discount_amount: product.promotion_discount_amount || 0,
        estimated_tax: product.estimated_tax || 0,
        packaging_cost: packagingCost
      });

      await adminSupabase.from("products").update({
        estimated_fee: estimatedFee,
        estimated_shipping_cost: estimatedShipping,
        margin_amount: profitResult.margin_amount,
        margin_percent: profitResult.margin_percent,
        profit_real_estimated: profitResult.real_margin_amount,
        profit_real_margin: profitResult.real_margin_percent,
        profitability_status: profitResult.profitability_status,
        profit_last_calculated_at: new Date().toISOString()
      }).eq("id", product.id).eq("tenant_id", tenantId);

      updatedCount++;
    }

    return NextResponse.json({ success: true, updated: updatedCount });

  } catch (error: any) {
    Sentry.captureException(error, { extra: { context: "PROFITABILITY_RECALCULATE" } });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
