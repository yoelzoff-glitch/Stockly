/**
 * In-memory sliding-window rate limiter for public AI queries.
 * Operates with absolute zero database dependencies, tracking anonymous IP hashes
 * and publicSessionIds to prevent automated scraping or denial-of-service abuse.
 */

interface WindowTracker {
  timestamps: number[];
}

const ipBuckets = new Map<string, WindowTracker>();
const sessionBuckets = new Map<string, WindowTracker>();

// Cleanup older entries periodically every 10 minutes
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpired(map: Map<string, WindowTracker>, windowMs: number) {
  const cutoff = Date.now() - windowMs;
  for (const [key, tracker] of map.entries()) {
    tracker.timestamps = tracker.timestamps.filter((ts) => ts > cutoff);
    if (tracker.timestamps.length === 0) {
      map.delete(key);
    }
  }
}

export interface PublicRateLimitResult {
  allowed: boolean;
  reason?: "ip_limit_exceeded" | "session_limit_exceeded";
  maxLimit: number;
  remaining: number;
}

/**
 * Checks and records rate limiting for an anonymous public AI request.
 */
export function checkPublicRateLimit(
  ipHash: string,
  publicSessionId?: string
): PublicRateLimitResult {
  const now = Date.now();

  // Periodic eviction
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    lastCleanup = now;
    cleanupExpired(ipBuckets, 60 * 60 * 1000); // 1 hour window
    cleanupExpired(sessionBuckets, 24 * 60 * 60 * 1000); // 24 hours window
  }

  const maxPerIpHour = Number(process.env.PUBLIC_AI_MAX_MESSAGES_PER_IP_HOUR) || 30;
  const maxPerSession = Number(process.env.PUBLIC_AI_MAX_MESSAGES_PER_SESSION) || 15;

  const oneHourAgo = now - 60 * 60 * 1000;

  // 1. Check IP Hash limit
  let ipTracker = ipBuckets.get(ipHash);
  if (!ipTracker) {
    ipTracker = { timestamps: [] };
    ipBuckets.set(ipHash, ipTracker);
  }
  ipTracker.timestamps = ipTracker.timestamps.filter((ts) => ts > oneHourAgo);

  if (ipTracker.timestamps.length >= maxPerIpHour) {
    return {
      allowed: false,
      reason: "ip_limit_exceeded",
      maxLimit: maxPerIpHour,
      remaining: 0,
    };
  }

  // 2. Check Session ID limit if provided
  if (publicSessionId) {
    let sessionTracker = sessionBuckets.get(publicSessionId);
    if (!sessionTracker) {
      sessionTracker = { timestamps: [] };
      sessionBuckets.set(publicSessionId, sessionTracker);
    }

    if (sessionTracker.timestamps.length >= maxPerSession) {
      return {
        allowed: false,
        reason: "session_limit_exceeded",
        maxLimit: maxPerSession,
        remaining: 0,
      };
    }

    sessionTracker.timestamps.push(now);
  }

  ipTracker.timestamps.push(now);

  return {
    allowed: true,
    maxLimit: maxPerIpHour,
    remaining: Math.max(0, maxPerIpHour - ipTracker.timestamps.length),
  };
}

/**
 * Resets rate limit tracker for testing purposes.
 */
export function resetPublicRateLimiterForTesting() {
  ipBuckets.clear;
  sessionBuckets.clear();
}
