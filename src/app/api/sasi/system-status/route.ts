import { NextResponse } from "next/server";

import { db } from "@/lib/db";

/* ============================================================
   SASI — honest system status.

   Reports REAL infrastructure state only (booleans + provider
   names). Never echoes keys, connection strings, counts or error
   bodies. Public so pre-sign-in diagnostics work on the device.

   database.provider : "sqlite" (local dev) | "postgres" (Supabase)
   database.ok       : the app's primary database answers queries
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

export async function GET() {
  /* 1 — primary database (the one Prisma talks to) */
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const provider = databaseUrl.startsWith("file:") ? "sqlite" : "postgres";
  let databaseOk = false;
  try {
    await db.$queryRawUnsafe("SELECT 1");
    databaseOk = true;
  } catch (err) {
    console.error("[system-status] primary database probe failed", err);
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
      database: { provider, ok: databaseOk },
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
