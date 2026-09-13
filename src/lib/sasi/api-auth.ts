import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";

/* ============================================================
   SASI — server-side API security primitives.

   requireUserId: every protected endpoint resolves the NextAuth
   session to a database user id. If there is no session the route
   answers 401 — authorization NEVER trusts a client-supplied id
   (the old anonymous sessionId protocol is gone).

   rateLimitService: the RateLimitService abstraction. Every
   throttle in the app goes through this one object so the backing
   store can be swapped without touching call sites.

   Honest scope: the active store is in-memory, fixed-window, per
   server process. It stops abusive bursts and cost sinks; it is
   NOT a distributed limiter and it does not survive a restart.
   The upgrade path is documented next to the store factory.
   ============================================================ */

export type AuthGuard =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

export async function requireUserId(): Promise<AuthGuard> {
  const session = await getAuthSession();
  const userId = session?.user?.id;
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sign in to continue." },
        { status: 401 }
      ),
    };
  }
  return { ok: true, userId };
}

/* ============================================================
   RateLimitService
   ============================================================ */

/** Result of a single rate-limit check. */
export interface RateLimitResult {
  allowed: boolean;
  /** calls still available in the current window (0 once denied) */
  remaining: number;
  /** ms until the window resets (0 while calls remain) */
  retryAfterMs: number;
}

/**
 * Storage contract for the rate limit service. A store MUST be safe
 * for concurrent calls and MUST NOT lose the caller's error — a
 * failing store fails closed is NOT required: throw honestly and let
 * the route's error handling answer 500.
 */
export interface RateLimitStore {
  check(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Active store: in-memory fixed-window counters.
 *
   - One Map entry per key; the window resets `windowMs` after the
     first hit in the window (fixed window, not sliding).
   - Periodic pruning (every PRUNE_INTERVAL_MS) drops expired keys so
     the map cannot grow without bound; a hard cap evicts the oldest
     entries even mid-window under a key-flood (e.g. spoofed IPs), so
     memory stays bounded at MAX_BUCKETS entries.
 */
export class InMemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, Bucket>();
  private lastPrunedAt = 0;

  private static readonly PRUNE_INTERVAL_MS = 60_000;
  private static readonly MAX_BUCKETS = 10_000;

  check(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    this.maybePrune(now);

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.evictIfNeeded();
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return Promise.resolve({
        allowed: true,
        remaining: Math.max(0, limit - 1),
        retryAfterMs: 0,
      });
    }
    if (bucket.count >= limit) {
      return Promise.resolve({
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(0, bucket.resetAt - now),
      });
    }
    bucket.count += 1;
    return Promise.resolve({
      allowed: true,
      remaining: Math.max(0, limit - bucket.count),
      retryAfterMs: 0,
    });
  }

  private maybePrune(now: number) {
    if (now - this.lastPrunedAt < InMemoryRateLimitStore.PRUNE_INTERVAL_MS)
      return;
    this.lastPrunedAt = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  /** Hard memory bound: drop expired, then oldest-inserted (Map keeps
      insertion order). The oldest entries are the closest to expiry. */
  private evictIfNeeded() {
    if (this.buckets.size < InMemoryRateLimitStore.MAX_BUCKETS) return;
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
    while (this.buckets.size >= InMemoryRateLimitStore.MAX_BUCKETS) {
      const oldest = this.buckets.keys().next().value;
      if (oldest === undefined) break;
      this.buckets.delete(oldest);
    }
  }
}

/* ------------------------------------------------------------
   UPGRADE PATH (do not fake persistence today)

   The in-memory store only throttles ONE server process. To make
   limits global (multi-instance/Vercel), implement RateLimitStore
   against one of:

   1. Upstash REST (recommended, zero schema):
      POST https://<id>.upstash.io/incr/<namespaced-key> with an
      atomic expiry pipeline (INCR + PEXPIRE when count === 1).
      Requires two env vars (UPSTASH_REDIS_REST_URL/TOKEN) — the
      secrets live only in .env / hosting dashboard.

   2. A "RateLimitHit" table (key TEXT, windowStart TIMESTAMPTZ,
      count INT, PRIMARY KEY (key, windowStart)) added by a FUTURE
      Prisma migration, driven with db.$executeRaw
      `INSERT ... ON CONFLICT ... DO UPDATE SET count = count + 1`
      and a RETURNING read. NOT implementable now: schema.prisma is
      frozen for this task and fabricating queries against a table
      that does not exist would be dishonest.

   The factory below is the ONLY place that changes.
   ------------------------------------------------------------ */

let cachedStore: RateLimitStore | null = null;

function getStore(): RateLimitStore {
  if (cachedStore) return cachedStore;
  const configured = (process.env.RATE_LIMIT_STORE ?? "memory")
    .trim()
    .toLowerCase();
  if (configured === "memory" || configured === "") {
    cachedStore = new InMemoryRateLimitStore();
    return cachedStore;
  }
  /* Fail loudly and honestly: an unknown store name is a deployment
     error, not something to silently degrade from. */
  throw new Error(
    `RATE_LIMIT_STORE "${configured}" is not configured. Supported values: "memory". ` +
      `For a distributed store see the upgrade path in src/lib/sasi/api-auth.ts.`
  );
}

/** The one object every throttle in the app goes through. */
export const rateLimitService = {
  limit(
    key: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    return getStore().check(key, limit, windowMs);
  },
};

/**
 * Compatibility wrapper kept for any external call sites: same
 * behaviour as rateLimitService.limit with the legacy result shape.
 * In-repo call sites use rateLimitService directly.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: boolean; retryAfterSec: number }> {
  const result = await rateLimitService.limit(key, limit, windowMs);
  return {
    ok: result.allowed,
    retryAfterSec: result.allowed
      ? 0
      : Math.max(1, Math.ceil(result.retryAfterMs / 1000)),
  };
}

/** Best-effort caller identity for ANONYMOUS endpoints. x-forwarded-for
    is client-spoofable on a direct connection — good enough to blunt
    bursts, never a security boundary. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0].trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "local";
}

/** Consistent 429 with a machine-readable Retry-After. */
export function tooManyRequests(
  retryAfterMs: number,
  message: string
): NextResponse {
  return NextResponse.json(
    { error: message },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
      },
    }
  );
}

/** Generic 500 that never leaks internals to the client. */
export function serverError(logContext: string, err: unknown, message: string) {
  console.error(`[${logContext}]`, err);
  return NextResponse.json({ error: message }, { status: 500 });
}
