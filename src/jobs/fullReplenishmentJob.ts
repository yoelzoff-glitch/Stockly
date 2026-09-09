// src/jobs/fullReplenishmentJob.ts

import { inngest } from "../inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildReplenishmentSnapshots } from "@/services/inventory/replenishment/buildReplenishmentSnapshot";
import { calculateReplenishment } from "@/services/inventory/replenishment/calculateReplenishment";
import {
  generateRuleBasedExplanation,
  computeDedupeHash,
} from "@/services/inventory/replenishment/ai/explainReplenishment";
import { logger } from "@/lib/errors/logger";

/**
 * Job de Inngest: Análisis y cálculo diario / on-demand de reposición inteligente FULL.
 * Ejecuta el motor determinístico sin llamadas desatendidas a OpenAI en cron.
 */
export const fullReplenishmentAnalysisJob = inngest.createFunction(
  {
    id: "full-replenishment-analysis",
    triggers: [
      { cron: "0 4 * * *" },
      { event: "libretax/full.replenishment.requested" },
    ],
  },
  async ({ event, step }) => {
    const supabase = createAdminClient();

    // 1. Resolver tenants objetivo
    const tenantIds: string[] = await step.run("resolve-tenants", async () => {
      const explicitTenantId = (event.data as any)?.tenantId;
      if (explicitTenantId) {
        return [explicitTenantId];
      }

      const { data: accounts } = await supabase
        .from("meli_accounts")
        .select("tenant_id")
        .eq("status", "connected");

      return Array.from(new Set(accounts?.map((a) => a.tenant_id) || []));
    });

    if (tenantIds.length === 0) {
      return { processedTenants: 0, totalRecommendations: 0 };
    }

    let totalRecommendations = 0;

    // 2. Procesar cada tenant
    for (const tenantId of tenantIds) {
      const processedCount = await step.run(
        `process-replenishment-tenant-${tenantId}`,
        async () => {
          try {
            const snapshots = await buildReplenishmentSnapshots(tenantId, supabase);
            if (snapshots.length === 0) return 0;

            const recommendationsToUpsert = [];

            for (const snap of snapshots) {
              const rec = calculateReplenishment(snap);
              const dedupeHash = computeDedupeHash({
                sku: rec.sku,
                productId: rec.productId,
                recommendedUnits: rec.recommendedUnits,
                sales7d: rec.sales7d,
                sales30d: rec.sales30d,
                fullStock: rec.fullStock,
                priority: rec.priority,
              });

              // Explicación analítica base determinística
              const explanation = generateRuleBasedExplanation(rec);

              recommendationsToUpsert.push({
                tenant_id: tenantId,
                product_id: rec.productId,
                sku: rec.sku || `SKU-${rec.productId}`,
                title: rec.title,
                thumbnail_url: rec.thumbnailUrl,
                full_stock: rec.fullStock,
                internal_stock: rec.internalStock,
                sales_7d: rec.sales7d,
                sales_14d: rec.sales14d,
                sales_30d: rec.sales30d,
                sales_60d: rec.sales60d,
                velocity_7d: rec.velocity7,
                velocity_14d: rec.velocity14,
                velocity_30d: rec.velocity30,
                weighted_velocity: rec.weightedVelocity,
                forecast_velocity: rec.forecastVelocity,
                coverage_days: rec.coverageDays,
                target_coverage_days: rec.targetCoverageDays,
                safety_days: rec.safetyDays,
                recommended_units: rec.recommendedUnits,
                available_to_send: rec.availableToSend,
                priority: rec.priority,
                confidence: rec.confidence,
                trend_percent: rec.trendPercent,
                account_trend_percent: rec.accountTrendPercent,
                unit_cost: rec.unitCost,
                margin_percent: rec.marginPercent,
                capital_required: rec.capitalRequired,
                ads_active: rec.adsActive,
                ai_explanation: explanation,
                dedupe_hash: dedupeHash,
                calculated_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }

            if (recommendationsToUpsert.length > 0) {
              const { error } = await supabase
                .from("full_replenishment_recommendations")
                .upsert(recommendationsToUpsert, {
                  onConflict: "tenant_id,sku",
                });

              if (error) {
                logger.error({
                  event: "FULL_REPLENISHMENT_UPSERT_ERROR",
                  tenantId,
                  error: error.message,
                });
              }
            }

            return recommendationsToUpsert.length;
          } catch (err: any) {
            logger.error({
              event: "FULL_REPLENISHMENT_PROCESS_ERROR",
              tenantId,
              error: err?.message,
            });
            return 0;
          }
        }
      );

      totalRecommendations += processedCount;
    }

    return {
      processedTenants: tenantIds.length,
      totalRecommendations,
    };
  }
);
