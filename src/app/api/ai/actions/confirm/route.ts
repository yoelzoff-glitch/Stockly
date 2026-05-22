import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { updatePrice } from '@/services/meli/actions/updatePrice';
import { updateStock } from '@/services/meli/actions/updateStock';
import { pauseProduct, activateProduct } from '@/services/meli/actions/statusProduct';
import { logger } from '@/lib/errors/logger';

export async function POST(req: Request) {
  try {
    const { action_id, tenant_id } = await req.json();
    if (!action_id || !tenant_id) return NextResponse.json({ error: "Missing parameters" }, { status: 400 });

    const supabase = createAdminClient();

    const { data: action, error } = await supabase
      .from("ai_actions")
      .select("*")
      .eq("id", action_id)
      .eq("tenant_id", tenant_id)
      .eq("status", "pending")
      .single();

    if (error || !action) {
      return NextResponse.json({ error: "Action not found or not pending" }, { status: 404 });
    }

    const payload = action.payload as any[];
    if (payload.length > 50) {
      return NextResponse.json({ error: "Límite de 50 productos excedido" }, { status: 400 });
    }

    const results = [];

    for (const item of payload) {
      try {
        if (action.action_type === 'update_price') {
          await updatePrice(tenant_id, item.product_id, item.new_value);
        } else if (action.action_type === 'update_stock') {
          await updateStock(tenant_id, item.product_id, item.new_value);
        } else if (action.action_type === 'pause_product') {
          await pauseProduct(tenant_id, item.product_id);
        } else if (action.action_type === 'activate_product') {
          await activateProduct(tenant_id, item.product_id);
        }
        results.push({ product_id: item.product_id, success: true });
      } catch (err: any) {
        logger.error(`Error executing action ${action.id} for product ${item.product_id}: ${err.message}`, "AI_ACTIONS");
        results.push({ product_id: item.product_id, success: false, error: err.message });
      }
    }

    await supabase.from("ai_actions").update({
      status: "executed",
      executed_at: new Date().toISOString(),
      result: results
    }).eq("id", action.id);

    return NextResponse.json({ success: true, results });

  } catch (error: any) {
    logger.error("Error in confirm action route", "AI_ACTIONS");
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
