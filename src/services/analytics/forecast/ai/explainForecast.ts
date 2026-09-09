// src/services/analytics/forecast/ai/explainForecast.ts

import { z } from "zod";
import { openai } from "@/lib/ai/openai";
import { ForecastAiExplanation, MonthlyProfitForecast } from "../types";

export const ForecastExplanationSchema = z.object({
  summary: z.string(),
  mainDriver: z.string(),
  riskNote: z.string(),
});

/**
 * Generates a rule-based explanation (fallback when OpenAI is unavailable, rate-limited, or disabled).
 */
export function generateRuleBasedForecastExplanation(
  forecast: MonthlyProfitForecast
): ForecastAiExplanation {
  let summary = "";
  if (forecast.trendPercent > 5) {
    summary = `La cuenta mantiene una tendencia positiva moderada (+${forecast.trendPercent}%). La proyección central de cierre se sitúa en $${forecast.forecastExpected.toLocaleString("es-AR")}.`;
  } else if (forecast.trendPercent < -5) {
    summary = `Se registra una desaceleración reciente en el ritmo diario (${forecast.trendPercent}%). El forecast ajusta la proyección restante para reflejar la menor velocidad.`;
  } else {
    summary = `El ritmo de rentabilidad diaria se mantiene estable respecto al histórico reciente. La proyección central se proyecta en $${forecast.forecastExpected.toLocaleString("es-AR")}.`;
  }

  let mainDriver = "";
  if (forecast.daysElapsed >= 20) {
    mainDriver = `La mayor parte del mes ya está consolidada (${forecast.daysElapsed} de ${forecast.daysInMonth} días transcurridos). El peso de la ganancia real acumulada domina el resultado final.`;
  } else {
    mainDriver = `La proyección restante se fundamenta en la estacionalidad por día de la semana y los últimos días de actividad comercial.`;
  }

  let riskNote = "";
  if (forecast.outlierDaysCount > 0) {
    riskNote = `Se identificaron ${forecast.outlierDaysCount} jornadas con resultados extraordinarios; su influencia sobre los días restantes fue amortiguada para evitar distorsiones.`;
  } else if (forecast.confidence === "low") {
    riskNote = `Historial limitado o variabilidad elevada entre días. El rango proyectado contempla mayor margen de incertidumbre.`;
  } else {
    riskNote = `Comportamiento comercial consistente entre días de semana. Dispersión dentro de los parámetros habituales.`;
  }

  return { summary, mainDriver, riskNote };
}

/**
 * Requests OpenAI Structured Output explanation for the calculated forecast.
 * Enforces: OpenAI explains context, but never alters the calculated numbers.
 */
export async function explainMonthlyProfitForecast(
  forecast: MonthlyProfitForecast
): Promise<ForecastAiExplanation> {
  const killSwitchActive =
    process.env.LIBRETAX_DISABLE_AI_WRITES === "true" ||
    process.env.STOCKLY_DISABLE_AI_WRITES === "true";

  if (killSwitchActive || !process.env.OPENAI_API_KEY) {
    return generateRuleBasedForecastExplanation(forecast);
  }

  try {
    const promptPayload = {
      actualMTD: forecast.actualProfitMTD,
      forecastExpected: forecast.forecastExpected,
      forecastLow: forecast.forecastLow,
      forecastHigh: forecast.forecastHigh,
      expectedRemainingProfit: forecast.expectedRemainingProfit,
      daysElapsed: forecast.daysElapsed,
      daysRemaining: forecast.daysRemaining,
      daysInMonth: forecast.daysInMonth,
      trendPercent: forecast.trendPercent,
      confidence: forecast.confidence,
      outlierDaysCount: forecast.outlierDaysCount,
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Sos el analista financiero de LibretaX.
Tu tarea es explicar de forma concisa y ejecutiva la proyección de cierre de ganancia mensual calculada por el sistema.
Reglas estrictas:
- NO inventes datos ni alteres los números provistos.
- NO prometas resultados futuros garantizados.
- Explicá cómo influyen el ritmo reciente, la estacionalidad semanal y los días transcurridos.
- Devuelve un JSON válido acorde al schema: summary, mainDriver, riskNote.`,
        },
        {
          role: "user",
          content: JSON.stringify(promptPayload),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 300,
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      return generateRuleBasedForecastExplanation(forecast);
    }

    const parsed = JSON.parse(rawContent);
    const validated = ForecastExplanationSchema.safeParse(parsed);
    if (!validated.success) {
      return generateRuleBasedForecastExplanation(forecast);
    }

    return validated.data;
  } catch (err: any) {
    console.warn("Forecast OpenAI explanation failed, using rule-based fallback:", err.message);
    return generateRuleBasedForecastExplanation(forecast);
  }
}
