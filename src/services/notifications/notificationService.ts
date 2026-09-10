import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/errors/logger";

export type NotificationCategory = "attention" | "activity";
export type NotificationSeverity = "info" | "warning" | "danger";
export type NotificationStatus = "open" | "resolved" | "archived";
export type NotificationSource = "system" | "platform_admin";

export type NotificationType =
  | "sale_created"
  | "sale_cancelled"
  | "missing_costs"
  | "critical_stock"
  | "negative_margin"
  | "integration_disconnected"
  | "sync_failed"
  | "custom";

export interface ImmutableEventParams {
  tenantId: string;
  type: NotificationType;
  title: string;
  body: string;
  severity?: NotificationSeverity;
  actionUrl?: string;
  actionLabel?: string;
  entityType?: string;
  entityId?: string;
  dedupeKey: string;
  eventTimestamp?: Date | string;
  metadata?: Record<string, any>;
  source?: NotificationSource;
}

export interface StateAlertParams {
  tenantId: string;
  type: NotificationType;
  title: string;
  body: string;
  severity?: NotificationSeverity;
  actionUrl?: string;
  actionLabel?: string;
  entityType?: string;
  entityId?: string;
  dedupeKey: string;
  count: number;
  metadata?: Record<string, any>;
  source?: NotificationSource;
}

/**
 * Validates action URLs to prevent Open Redirect attacks.
 * Only internal dashboard URLs are permitted.
 */
export function sanitizeActionUrl(url?: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Reject external protocols, scheme-relative URLs, javascript:, etc.
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("//") ||
    trimmed.toLowerCase().startsWith("javascript:") ||
    trimmed.toLowerCase().startsWith("data:")
  ) {
    logger.warn({
      event: "NOTIFICATION_EXTERNAL_URL_REJECTED",
      url: trimmed,
    });
    return null;
  }

  // Must strictly begin with /dashboard
  if (!trimmed.startsWith("/dashboard")) {
    logger.warn({
      event: "NOTIFICATION_INVALID_URL_REJECTED",
      url: trimmed,
    });
    return null;
  }

  return trimmed;
}

/**
 * Publishes an immutable business event (e.g. sale created, sale cancelled).
 * - Atomic: uses dedupe_key to avoid race conditions.
 * - Watermark: checks tenant's notifications_watermark_at. Historical events before watermark are skipped.
 */
export async function publishImmutableEvent(
  params: ImmutableEventParams,
  client?: any
): Promise<{ success: boolean; skippedReason?: string }> {
  const supabase = client || createAdminClient();
  const source: NotificationSource = params.source || "system";

  // Check tenant watermark if eventTimestamp is provided
  if (params.eventTimestamp) {
    const eventTime = new Date(params.eventTimestamp).getTime();
    const { data: tenant } = await supabase
      .from("tenants")
      .select("notifications_watermark_at")
      .eq("id", params.tenantId)
      .maybeSingle();

    if (tenant?.notifications_watermark_at) {
      const watermark = new Date(tenant.notifications_watermark_at).getTime();
      if (eventTime < watermark) {
        logger.info({
          event: "NOTIFICATION_EVENT_PRE_WATERMARK_SKIPPED",
          tenantId: params.tenantId,
          type: params.type,
          dedupeKey: params.dedupeKey,
          eventTime: new Date(eventTime).toISOString(),
          watermark: new Date(watermark).toISOString(),
        });
        return { success: false, skippedReason: "pre_watermark" };
      }
    }
  }

  const sanitizedUrl = sanitizeActionUrl(params.actionUrl);

  try {
    const alertsTable = supabase.from("alerts") as any;
    let isDuplicate = false;

    if (typeof alertsTable.upsert === "function") {
      const { data, error } = await alertsTable.upsert({
        tenant_id: params.tenantId,
        type: params.type,
        category: "activity",
        severity: params.severity || "info",
        source,
        title: params.title,
        body: params.body,
        action_url: sanitizedUrl,
        action_label: params.actionLabel || null,
        entity_type: params.entityType || null,
        entity_id: params.entityId || null,
        dedupe_key: params.dedupeKey,
        status: "open",
        is_read: false,
        metadata: params.metadata || {},
      }, {
        onConflict: "tenant_id,dedupe_key",
        ignoreDuplicates: true,
      }).select("id");

      if (error) {
        if (error.code === "23505" || error.message?.includes("duplicate key")) {
          isDuplicate = true;
        } else {
          throw error;
        }
      } else if (!data || data.length === 0) {
        isDuplicate = true;
      }
    } else {
      const { error } = await alertsTable.insert({
        tenant_id: params.tenantId,
        type: params.type,
        category: "activity",
        severity: params.severity || "info",
        source,
        title: params.title,
        body: params.body,
        action_url: sanitizedUrl,
        action_label: params.actionLabel || null,
        entity_type: params.entityType || null,
        entity_id: params.entityId || null,
        dedupe_key: params.dedupeKey,
        status: "open",
        is_read: false,
        metadata: params.metadata || {},
      });

      if (error) {
        if (error.code === "23505" || error.message?.includes("duplicate key")) {
          isDuplicate = true;
        } else {
          throw error;
        }
      }
    }

    if (isDuplicate) {
      logger.info({
        event: "NOTIFICATION_DUPLICATE_EVENT_IGNORED",
        tenantId: params.tenantId,
        dedupeKey: params.dedupeKey,
      });
      return { success: false, skippedReason: "duplicate" };
    }

    return { success: true };
  } catch (err: any) {
    logger.error({
      event: "PUBLISH_IMMUTABLE_EVENT_FAILED",
      tenantId: params.tenantId,
      error: err?.message,
    });
    return { success: false, skippedReason: err?.message };
  }
}

/**
 * Upserts a state alert (e.g. missing costs, critical stock, sync failed).
 * Lifecycle:
 * - If count > 0: alert is opened/updated with latest count and body without duplicate rows.
 * - If count === 0: any open alert with this dedupe_key is marked as resolved.
 */
export async function upsertStateAlert(
  params: StateAlertParams,
  client?: any
): Promise<{ success: boolean; status: "opened" | "updated" | "resolved" }> {
  const supabase = client || createAdminClient();
  const source: NotificationSource = params.source || "system";

  try {
    // If the condition is resolved (count is 0)
    if (params.count <= 0) {
      const { data: openAlert } = await supabase
        .from("alerts")
        .select("id")
        .eq("tenant_id", params.tenantId)
        .eq("dedupe_key", params.dedupeKey)
        .eq("status", "open")
        .maybeSingle();

      if (openAlert) {
        await supabase
          .from("alerts")
          .update({
            status: "resolved",
            resolved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", openAlert.id);

        logger.info({
          event: "STATE_ALERT_AUTO_RESOLVED",
          tenantId: params.tenantId,
          dedupeKey: params.dedupeKey,
          alertId: openAlert.id,
        });
      }

      return { success: true, status: "resolved" };
    }

    // Condition is active (count > 0)
    const sanitizedUrl = sanitizeActionUrl(params.actionUrl);

    // Atomic Upsert using dedupe_key conflict target
    const { data: existing } = await supabase
      .from("alerts")
      .select("id, status")
      .eq("tenant_id", params.tenantId)
      .eq("dedupe_key", params.dedupeKey)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("alerts")
        .update({
          title: params.title,
          body: params.body,
          severity: params.severity || "warning",
          action_url: sanitizedUrl,
          action_label: params.actionLabel || null,
          status: "open",
          resolved_at: null,
          updated_at: new Date().toISOString(),
          metadata: {
            ...(params.metadata || {}),
            count: params.count,
            last_evaluated_at: new Date().toISOString(),
          },
        })
        .eq("id", existing.id);

      return { success: true, status: "updated" };
    } else {
      const { error: insertErr } = await supabase.from("alerts").insert({
        tenant_id: params.tenantId,
        type: params.type,
        category: "attention",
        severity: params.severity || "warning",
        source,
        title: params.title,
        body: params.body,
        action_url: sanitizedUrl,
        action_label: params.actionLabel || null,
        entity_type: params.entityType || null,
        entity_id: params.entityId || null,
        dedupe_key: params.dedupeKey,
        status: "open",
        is_read: false,
        metadata: {
          ...(params.metadata || {}),
          count: params.count,
          last_evaluated_at: new Date().toISOString(),
        },
      });

      if (insertErr) {
        if (insertErr.code === "23505") {
          // Race condition recovery: update existing
          await supabase
            .from("alerts")
            .update({
              title: params.title,
              body: params.body,
              status: "open",
              resolved_at: null,
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", params.tenantId)
            .eq("dedupe_key", params.dedupeKey);
          return { success: true, status: "updated" };
        }
        throw insertErr;
      }

      return { success: true, status: "opened" };
    }
  } catch (err: any) {
    logger.error({
      event: "UPSERT_STATE_ALERT_FAILED",
      tenantId: params.tenantId,
      dedupeKey: params.dedupeKey,
      error: err?.message,
    });
    return { success: false, status: "opened" };
  }
}

/**
 * Reconciles aggregated operational alerts for a given tenant:
 * 1. missing_costs: counts active products without costs loaded
 * 2. critical_stock: counts active products with available_quantity <= 5
 * 3. negative_margin: counts active products with margin_percent < 0
 */
export async function reconcileTenantStateAlerts(tenantId: string, client?: any) {
  const supabase = client || createAdminClient();

  try {
    const { data: products } = await supabase
      .from("products")
      .select("id, title, cost, available_quantity, margin_percent, status")
      .eq("tenant_id", tenantId)
      .eq("status", "active");

    const activeProds: any[] = products || [];

    // 1. Missing Costs
    const missingCostProds = activeProds.filter(
      (p: any) => p.cost === null || p.cost === undefined || Number(p.cost) <= 0
    );
    const missingCostsCount = missingCostProds.length;
    await upsertStateAlert(
      {
        tenantId,
        type: "missing_costs",
        severity: "warning",
        title: `Hay ${missingCostsCount} ${missingCostsCount === 1 ? "producto" : "productos"} sin costo`,
        body: "La rentabilidad de las ventas asociadas no puede calcularse correctamente.",
        actionUrl: "/dashboard/products?filter=no-cost",
        actionLabel: "Cargar costos",
        entityType: "products",
        dedupeKey: `tenant:${tenantId}:state:missing_costs`,
        count: missingCostsCount,
        metadata: { missing_count: missingCostsCount },
      },
      supabase
    );

    // 2. Critical Stock
    const criticalStockProds = activeProds.filter(
      (p: any) => typeof p.available_quantity === "number" && p.available_quantity <= 5
    );
    const criticalStockCount = criticalStockProds.length;
    await upsertStateAlert(
      {
        tenantId,
        type: "critical_stock",
        severity: "danger",
        title: `Hay ${criticalStockCount} ${criticalStockCount === 1 ? "producto" : "productos"} con stock crítico`,
        body: "Riesgo de pausar publicaciones por quiebre de inventario.",
        actionUrl: "/dashboard/internal-stock",
        actionLabel: "Revisar stock",
        entityType: "inventory",
        dedupeKey: `tenant:${tenantId}:state:critical_stock`,
        count: criticalStockCount,
        metadata: { critical_count: criticalStockCount },
      },
      supabase
    );

    // 3. Negative Margin (only evaluate if cost is present)
    const negativeMarginProds = activeProds.filter(
      (p: any) =>
        p.cost !== null &&
        p.cost !== undefined &&
        Number(p.cost) > 0 &&
        typeof p.margin_percent === "number" &&
        p.margin_percent < 0
    );
    const negativeMarginCount = negativeMarginProds.length;
    await upsertStateAlert(
      {
        tenantId,
        type: "negative_margin",
        severity: "danger",
        title: `Hay ${negativeMarginCount} ${negativeMarginCount === 1 ? "producto" : "productos"} con margen negativo`,
        body: "Los costos y descuentos superan el margen estimado.",
        actionUrl: "/dashboard/products?filter=negative-margin",
        actionLabel: "Revisar precios",
        entityType: "pricing",
        dedupeKey: `tenant:${tenantId}:state:negative_margin`,
        count: negativeMarginCount,
        metadata: { negative_margin_count: negativeMarginCount },
      },
      supabase
    );
  } catch (err: any) {
    logger.error({
      event: "RECONCILE_TENANT_STATE_ALERTS_FAILED",
      tenantId,
      error: err?.message,
    });
  }
}
