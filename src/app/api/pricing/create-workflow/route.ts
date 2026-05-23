// src/app/api/pricing/create-workflow/route.ts
import { createPriceAdjustmentWorkflow } from "@/services/pricing/createPriceAdjustmentWorkflow";

export async function POST(request: Request) {
  try {
    const { tenantId, targetMarginPercent, adjustments } = await request.json();
    if (!tenantId || typeof targetMarginPercent !== "number" || !Array.isArray(adjustments)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400 });
    }
    const workflowId = await createPriceAdjustmentWorkflow(
      tenantId,
      targetMarginPercent,
      adjustments,
    );
    return new Response(JSON.stringify({ workflowId }), { status: 201, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
}
