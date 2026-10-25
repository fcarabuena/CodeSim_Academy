/**
 * Fixed-window in-memory rate limiter.
 *
 * Good enough for a single free Render instance: the state is lost when the
 * service sleeps or restarts, which only ever makes the limiter more lenient,
 * never blocks a legitimate user. Swap for a shared store if you scale out.
 */

type Bucket = { count: number; resetAt: number };

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Milliseconds until the window resets. */
  retryAfterMs: number;
};

export function createRateLimiter(opts: { limit: number; windowMs: number }) {
  const buckets = new Map<string, Bucket>();

  return function check(key: string, now = Date.now()): RateLimitResult {
    // Opportunistic cleanup so the map cannot grow without bound.
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count++;

    const ok = bucket.count <= opts.limit;
    return {
      ok,
      remaining: Math.max(0, opts.limit - bucket.count),
      retryAfterMs: bucket.resetAt - now,
    };
  };
}

/** Sign-up and log-in attempts: 10 per IP/email per 15 minutes. */
export const authLimiter = createRateLimiter({ limit: 10, windowMs: 15 * 60_000 });

/** Code submissions: 20 per user per minute. */
export const submissionLimiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

/** Joining a class by code: 10 attempts per user per 10 minutes (stops code guessing). */
export const classJoinLimiter = createRateLimiter({ limit: 10, windowMs: 10 * 60_000 });

/** Admin and teacher management actions: 60 per user per minute. */
export const adminLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

/** Best-effort client IP from proxy headers (Render sets x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
