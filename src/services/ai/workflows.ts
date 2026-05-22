import { createAdminClient } from "@/lib/supabase/admin";
import { SuggestedAction } from "./recommendations";
import { confirmPendingAction } from "./actions/confirm";

export async function createWorkflow(tenantId: string, actions: SuggestedAction[]) {
  const supabase = createAdminClient();

  if (actions.length === 0) {
    return { error: "No hay acciones sugeridas para crear un workflow." };
  }

  if (actions.length > 50) {
    return { error: "Límite de 50 acciones excedido para un solo workflow." };
  }

  // Determine global risk score
  let riskScore = "LOW";
  const hasCritical = actions.some(a => a.action_type === 'pause_product');
  if (actions.length > 10 || hasCritical) riskScore = "HIGH";
  else if (actions.length > 5) riskScore = "MEDIUM";

  // Create workflow
  const { data: workflow, error: wfError } = await supabase.from("action_workflows").insert({
    tenant_id: tenantId,
    title: "Mantenimiento Autónomo",
    summary: `Workflow generado por motor autónomo con ${actions.length} acciones sugeridas.`,
    risk_score: riskScore,
    status: "pending"
  }).select("id").single();

  if (wfError) {
    return { error: "Error al crear el workflow." };
  }

  // Create ai_actions
  let stepOrder = 1;
  const createdActions = [];

  for (const action of actions) {
    // Para simplificar, creamos una ai_action por cada recomendación
    const payloadItem: any = {
      product_id: action.product_id,
      title: action.product_title,
    };

    if (action.action_type === 'update_stock') {
      payloadItem.new_value = action.proposed_value;
    } else if (action.action_type === 'pause_product') {
      payloadItem.new_value = action.proposed_value;
    } else if (action.action_type === 'update_price') {
      // Necesitaríamos precio actual para porcentaje
      // Aquí lo dejamos simplificado para que confirm.ts maneje porcentaje
      payloadItem.percentageChange = action.proposed_value.percentageChange;
      // Fetch current price
      const { data: p } = await supabase.from("products").select("price").eq("id", action.product_id).single();
      if (p) {
        payloadItem.current_value = p.price;
        payloadItem.new_value = Math.round(p.price * (1 + (payloadItem.percentageChange / 100)));
      }
    }

    const { data: aiAction } = await supabase.from("ai_actions").insert({
      tenant_id: tenantId,
      action_type: action.action_type,
      title: `(Workflow) ${action.action_type} - ${action.product_title}`,
      payload: { items: [payloadItem], risk_score: riskScore },
      status: "pending",
      workflow_id: workflow.id
    }).select("id").single();

    if (aiAction) {
      createdActions.push(aiAction.id);
      await supabase.from("workflow_steps").insert({
        workflow_id: workflow.id,
        action_id: aiAction.id,
        step_order: stepOrder++
      });
    }
  }

  return { 
    workflow_id: workflow.id, 
    risk_score: riskScore, 
    actions_count: createdActions.length 
  };
}

export async function executeWorkflow(tenantId: string, workflowId: string) {
  const supabase = createAdminClient();

  const { data: workflow } = await supabase
    .from("action_workflows")
    .select("*")
    .eq("id", workflowId)
    .eq("tenant_id", tenantId)
    .single();

  if (!workflow || workflow.status !== 'pending') {
    return { error: "Workflow no encontrado o ya no está pendiente." };
  }

  await supabase.from("action_workflows").update({ status: 'executing' }).eq("id", workflowId);

  const { data: steps } = await supabase
    .from("workflow_steps")
    .select("id, action_id, step_order")
    .eq("workflow_id", workflowId)
    .order("step_order", { ascending: true });

  const results = [];
  let allSuccess = true;

  for (const step of steps || []) {
    const res = await confirmPendingAction(tenantId, step.action_id);
    
    await supabase.from("workflow_steps").update({
      status: res.success ? 'completed' : 'failed'
    }).eq("id", step.id);

    results.push(res);
    if (!res.success) allSuccess = false;
  }

  await supabase.from("action_workflows").update({ 
    status: allSuccess ? 'completed' : 'failed',
    confirmed_by: 'user' // Simplificado
  }).eq("id", workflowId);

  return { success: allSuccess, results };
}
