// Minutes between safety checks on Vercel. Live webhooks remain event-driven.
export const VERCEL_INTERVAL_MINUTES: Record<string, number> = {
  "sync-orders-dispatcher": 45,
  "sync-products-dispatcher": 45, // only dirty/stale catalogs are dispatched
  "refresh-meli-tokens": 45, // renewal already checks the 90-minute expiry window
  "orders-deep-reconciliation": 1440,
  "reconcile-shipments-dispatcher": 360,
  "reconcile-cancellations-dispatcher": 180,
  "cleanup-zombie-users": 1440,
  "apply-subscription-downgrades": 60,
};

export function intervalBucket(minutes: number, now: Date): string {
  const interval = minutes * 60000;
  return new Date(Math.floor(now.getTime() / interval) * interval).toISOString();
}
