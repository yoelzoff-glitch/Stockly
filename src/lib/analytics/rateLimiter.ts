import "server-only";
import crypto from "node:crypto";

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, RateLimitBucket>();
const CLEANUP_INTERVAL_MS = 60 * 1000;
let lastCleanup = Date.now();

const MAX_REQUESTS_PER_MINUTE = 60;
const WINDOW_MS = 60 * 1000;

/**
 * Periodically removes expired rate limit buckets to prevent memory leaks.
 */
function cleanupExpiredBuckets(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
    return;
  }
  lastCleanup = now;

  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.lastRefill > WINDOW_MS * 2) {
      buckets.delete(key);
    }
  }
}

/**
 * Creates an anonymous hash from the request IP and optional visitorId.
 * The raw IP is NEVER stored.
 */
export function getClientFingerprint(req: Request, visitorId?: string): string {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0].trim() || "127.0.0.1";
  const rawKey = `${ip}:${visitorId || "anon"}`;

  return crypto.createHash("sha256").update(rawKey).digest("hex").slice(0, 16);
}

/**
 * Checks if the client has exceeded the analytics collection rate limit.
 * Returns true if allowed, false if blocked.
 */
export function checkAnalyticsRateLimit(fingerprint: string): boolean {
  cleanupExpiredBuckets();

  const now = Date.now();
  let bucket = buckets.get(fingerprint);

  if (!bucket) {
    bucket = { tokens: MAX_REQUESTS_PER_MINUTE - 1, lastRefill: now };
    buckets.set(fingerprint, bucket);
    return true;
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefill;
  if (elapsed > WINDOW_MS) {
    bucket.tokens = MAX_REQUESTS_PER_MINUTE;
    bucket.lastRefill = now;
  }

  if (bucket.tokens > 0) {
    bucket.tokens -= 1;
    return true;
  }

  return false;
}
