import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";

/* ============================================================
   SASI — server-side API security primitives.

   requireUserId: every protected endpoint resolves the NextAuth
   session to a database user id. If there is no session the route
   answers 401 — authorization NEVER trusts a client-supplied id
   (the old anonymous sessionId protocol is gone).

   rateLimit: small in-memory fixed-window limiter for the AI
   endpoints. Honest scope: it throttles abusive bursts on one
   server process; it is not a distributed rate limiter.
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

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

function pruneExpired(now: number) {
  if (buckets.size < 500) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  pruneExpired(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  if (bucket.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

/** Generic 500 that never leaks internals to the client. */
export function serverError(logContext: string, err: unknown, message: string) {
  console.error(`[${logContext}]`, err);
  return NextResponse.json({ error: message }, { status: 500 });
}
