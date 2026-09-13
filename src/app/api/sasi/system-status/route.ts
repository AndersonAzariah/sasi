import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { getAIStatus } from "@/lib/ai";
import {
  clientIp,
  rateLimitService,
  tooManyRequests,
} from "@/lib/sasi/api-auth";

/* ============================================================
   SASI — honest system status.

   Reports REAL infrastructure state only (booleans + provider
   names). Never echoes keys, connection strings, counts or error
   bodies. Public so pre-sign-in diagnostics work on the device.

   database.provider : "sqlite" (local dev) | "postgres" (Supabase)
   database.ok       : the app's primary database answers queries
   database.hint     : when the DB is unreachable, ONE honest hint
                       about the most likely deployment cause
                       (never any connection-string content)
   ai                : AI provider configuration status — provider
                       name + whether a key is configured. The key
                       itself is NEVER included or referenced.
   supabase:
     configured      : env vars present
     restReachable   : HTTPS reachable from this server
     schemaApplied   : tables exist on Supabase (secret-key probe)
     anonLocked      : the publishable key is DENIED table access
                       (true = RLS/grant hardening is effective)
   ============================================================ */

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

interface RestProbe {
  reachable: boolean;
  status: number | null;
}

async function probeRest(key: string, label: string): Promise<RestProbe> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/User?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(4000),
      cache: "no-store",
    });
    return { reachable: true, status: res.status };
  } catch (err) {
    console.error(`[system-status] rest probe (${label}) failed`, err);
    return { reachable: false, status: null };
  }
}

/** Classify a primary-DB failure into ONE honest, deployment-oriented
    hint. Message text never contains any connection details. */
function databaseHint(err: unknown): string | undefined {
  const msg = err instanceof Error ? `${err.message}` : "";
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code)
      : "";
  if (code === "ENOTFOUND" || /ENOTFOUND|getaddrinfo|ENOTDIR/i.test(msg)) {
    return "The database host could not be resolved. On Vercel, use the Supabase POOLER connection string (aws-*.pooler.supabase.com) — direct db.*.supabase.co hosts resolve only over IPv6, which serverless functions cannot use.";
  }
  if (code === "ETIMEDOUT" || /timed?\s?out|ETIMEDOUT|ECONNREFUSED/i.test(msg + code)) {
    return "The database did not answer in time. On Vercel, use the Supabase POOLER connection string; direct connections are frequently blocked from serverless networks.";
  }
  if (/password|authentication|10P-1|role .* does not exist/i.test(msg)) {
    return "The database rejected the credentials. Check the DATABASE_URL user/password in this environment.";
  }
  if (/relation .* does not exist|P2021/i.test(msg)) {
    return "The database is reachable but the schema has not been applied yet. Run the schema sync (supabase-db workflow or prisma db push).";
  }
  return "The application database is unreachable from this environment.";
}

export async function GET(req: Request) {
  /* Every call fires 2–3 outbound probes (Prisma + Supabase REST) —
     keep the honest diagnostics from becoming an amplifier. */
  const limit = await rateLimitService.limit(
    `system-status:${clientIp(req)}`,
    10,
    60_000
  );
  if (!limit.allowed) {
    return tooManyRequests(
      limit.retryAfterMs,
      "Too many status checks in a minute. Please wait a moment."
    );
  }

  /* 1 — primary database (the one Prisma talks to) */
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const provider = databaseUrl.startsWith("file:") ? "sqlite" : "postgres";
  let databaseOk = false;
  let databaseHintText: string | undefined;
  try {
    await db.$queryRawUnsafe("SELECT 1");
    databaseOk = true;
  } catch (err) {
    console.error("[system-status] primary database probe failed", err instanceof Error ? err.message : err);
    databaseHintText = databaseHint(err);
  }

  /* 2 — Supabase probes */
  const configured = Boolean(SUPABASE_URL && PUBLISHABLE_KEY);
  let restReachable = false;
  let anonLocked: boolean | null = null;
  let schemaApplied: boolean | null = null;

  if (configured && SUPABASE_URL && PUBLISHABLE_KEY) {
    // a) publishable key MUST be denied table access (RLS / grants locked)
    const anon = await probeRest(PUBLISHABLE_KEY, "publishable");
    restReachable = anon.reachable;
    if (anon.reachable) anonLocked = anon.status !== 200;

    // b) secret key (server-only) MUST see the User table once schema is applied
    if (SECRET_KEY && restReachable) {
      const service = await probeRest(SECRET_KEY, "secret");
      if (service.reachable) schemaApplied = service.status === 200;
    }
  }

  return NextResponse.json(
    {
      database: { provider, ok: databaseOk, ...(databaseHintText ? { hint: databaseHintText } : {}) },
      ai: getAIStatus(),
      supabase: {
        configured,
        restReachable,
        schemaApplied,
        anonLocked,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
