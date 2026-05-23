import { analyzeBusiness } from "./planner";
import { generateRecommendations } from "./recommendations";
import { createWorkflow } from "./workflows";

/**
 * Dispara el motor autónomo de Stockly para preparar un plan de mantenimiento integrado.
 * 1. Analiza el comercio buscando alertas comerciales críticas (márgenes bajos, quiebres de stock, productos muertos).
 * 2. Genera recomendaciones inteligentes para mitigar o solucionar cada alerta.
 * 3. Agrupa las acciones resultantes en un único Workflow pendiente de aprobación humana.
 * 4. Formatea un reporte narrado detallado para que el usuario conozca las advertencias y el plan propuesto.
 * 
 * @param tenantId Identificador único del comercio (tenant)
 * @returns Promesa que resuelve en el id del workflow generado y el mensaje textual descriptivo para el chat
 */
export async function prepareAutonomousWorkflow(tenantId: string) {
  // 1. Analizar
  const problems = await analyzeBusiness(tenantId);
  if (problems.length === 0) {
    return { message: "No encontré problemas urgentes en tu negocio. Todo parece estar en orden." };
  }

  // 2. Recomendar
  const recommendations = generateRecommendations(problems);

  if (recommendations.length === 0) {
    return { message: "Encontré algunos problemas, pero actualmente no tengo acciones automatizadas para sugerir." };
  }

  // 3. Crear Workflow
  const wfResult = await createWorkflow(tenantId, recommendations);

  if (wfResult.error) {
    return { error: wfResult.error };
  }

  // Formatear mensaje para el usuario
  const problemSummary = problems.map(p => `- ${p.details}`).join('\n');
  const actionSummary = recommendations.map(a => `- ${a.action_type === 'update_stock' ? 'Reponer' : a.action_type === 'update_price' ? 'Subir precio' : 'Pausar'} ${a.product_title}`).join('\n');

  return {
    workflow_id: wfResult.workflow_id,
    message: `**Análisis de Negocio Completado**\n\nEncontré:\n${problemSummary}\n\nPropongo el siguiente plan de acción:\n${actionSummary}\n\nRiesgo general: **${wfResult.risk_score}**\n\n**IMPORTANTE:** Para ejecutar todo este plan, por favor responde únicamente con la palabra: **CONFIRMO**`
  };
}
