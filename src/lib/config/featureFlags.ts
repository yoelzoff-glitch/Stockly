/**
 * Sprint 40 Phase 18: Centralized Feature Flags configuration.
 * All frequency, sync detachment, and optimization changes can be toggled without code deployment.
 */

export const SPRINT40_FEATURE_FLAGS = {
  /** Orders require a five-minute safety net; the old reduced mode is retired. */
  getOrdersReconciliationMode: (): "legacy" => "legacy",

  /**
   * Whether syncOrders executes syncShipments upon completion.
   * Default: false (shipments synced via webhook or dedicated background job).
   */
  isShipmentsFromOrdersFullSyncEnabled: (): boolean => {
    return process.env.LIBRETAX_SHIPMENTS_FROM_ORDERS_FULL_SYNC === "true";
  },

  /**
   * Whether syncOrders executes syncCancellations full scan upon completion.
   * Default: false (cancellations synced via targeted transitions or dedicated hourly job).
   */
  isCancellationsFromOrdersFullSyncEnabled: (): boolean => {
    return process.env.LIBRETAX_CANCELLATIONS_FROM_ORDERS_FULL_SYNC === "true";
  },

  /**
   * Whether navigating to /dashboard/shipments triggers a background sync.
   * Default: false (UI read paths must never trigger heavy syncs).
   */
  isShipmentSyncOnPageLoadEnabled: (): boolean => {
    return process.env.LIBRETAX_SHIPMENT_SYNC_ON_PAGE_LOAD === "true";
  },

  /**
   * Mode for products reconciliation job.
   * 'reduced': runs hourly and skips clean/untouched catalogs.
   * 'legacy': runs every 15 minutes.
   */
  getProductsReconciliationMode: (): "reduced" | "legacy" => {
    return (process.env.LIBRETAX_PRODUCTS_RECONCILIATION_MODE || "reduced").toLowerCase() === "legacy"
      ? "legacy"
      : "reduced";
  },

  /**
   * Whether product webhooks are coalesced with a 45-second debounce window.
   * Default: true.
   */
  isProductWebhookCoalescingEnabled: (): boolean => {
    return process.env.LIBRETAX_PRODUCT_WEBHOOK_COALESCING !== "false";
  },

  /**
   * Whether syncOrders uses incremental watermark querying (last_sync_at - 30m).
   * Default: true.
   */
  isIncrementalOrdersSyncEnabled: (): boolean => {
    return process.env.LIBRETAX_INCREMENTAL_ORDERS_SYNC !== "false";
  },

  /**
   * Whether deep reconciliation (7-day historical window) runs every 4 hours.
   * Default: true.
   */
  isDeepOrderReconciliationEnabled: (): boolean => {
    return process.env.LIBRETAX_DEEP_ORDER_RECONCILIATION !== "false";
  },
};
