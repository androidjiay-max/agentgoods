/**
 * In-memory rate limiter — lightweight stopgap until Upstash Redis in Phase 2.
 *
 * Limits requests per key (API key or IP) within a sliding window.
 * Auto-cleans expired entries on each check.
 *
 * Phase 2: Replace with Upstash Redis for distributed rate limiting across
 * multiple Vercel edge functions / serverless instances.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number; // epoch ms
}

interface RateLimitConfig {
  windowMs: number;   // e.g. 60_000 for 1 minute
  maxRequests: number; // e.g. 100
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 100,
};

// Stricter limits for transaction endpoint
const TRANSACT_CONFIG: RateLimitConfig = {
  windowMs: 60_000,
  maxRequests: 30,
};

const store = new Map<string, RateLimitEntry>();

/** Periodic cleanup: remove entries whose windows have expired. */
function cleanup(now: number): void {
  for (const [key, entry] of store) {
    if (now - entry.windowStart > DEFAULT_CONFIG.windowMs * 2) {
      store.delete(key);
    }
  }
}

let lastCleanup = 0;
const CLEANUP_INTERVAL = 60_000; // every 60 seconds

/**
 * Check whether a request identified by `key` is within the rate limit.
 * Returns `{ allowed: boolean; remaining: number; resetMs: number }`.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();

  // Periodic cleanup
  if (now - lastCleanup > CLEANUP_INTERVAL) {
    cleanup(now);
    lastCleanup = now;
  }

  const existing = store.get(key);

  if (!existing || now - existing.windowStart > config.windowMs) {
    // New window
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: config.maxRequests - 1, resetMs: config.windowMs };
  }

  existing.count++;

  if (existing.count > config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: config.windowMs - (now - existing.windowStart),
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests - existing.count,
    resetMs: config.windowMs - (now - existing.windowStart),
  };
}

export { DEFAULT_CONFIG, TRANSACT_CONFIG };
