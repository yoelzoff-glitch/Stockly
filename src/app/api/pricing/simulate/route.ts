// src/app/api/pricing/simulate/route.ts
import { simulatePriceAdjustment } from "@/services/pricing/priceAdjustmentSimulator";

export async function POST(request: Request) {
  try {
    const { tenantId, targetMarginPercent, filter } = await request.json();
    if (!tenantId || typeof targetMarginPercent !== "number") {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
    }
    const preview = await simulatePriceAdjustment(tenantId, targetMarginPercent, filter);
    return new Response(JSON.stringify({ preview }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
