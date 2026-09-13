import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  journeyStepsFor,
  registryEntryByJourneyId,
  type JourneyRunPayload,
  type JourneyRunStatus,
} from "@/lib/sasi/services-registry";

/* ============================================================
   /api/sasi/journeys — Phase 9: persistent journey progress.

   GET  ?sessionId=…                          → this session's JourneyRun rows
   POST { sessionId, journeyId, status,
          stepsDone?, payload? }               → upsert by (sessionId, journeyId)

   Ownership mirrors /api/sasi/state exactly: the session id comes
   from the request, the authenticated user id (NextAuth session)
   is attached server-side when the caller is signed in — it is
   NEVER trusted from the client.

   Honesty: journeyId must exist in the service registry (unknown
   journeys are rejected with a plain error). Status reflects only
   the resident's own checklist progress — COMPLETED means the
   SASI checklist is finished, NOT that any government application
   is complete.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES: readonly string[] = ["ACTIVE", "PAUSED", "COMPLETED"];

function cleanSession(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  return s.length > 0 && s.length <= 128 ? s : null;
}

/** Server-side user id from the NextAuth session (or null for anonymous). */
async function serverUserId(): Promise<string | null> {
  try {
    const session = await getAuthSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

function parseStepsDone(raw: string): number[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0)
      .slice(0, 100);
  } catch {
    return [];
  }
}

function parsePayload(raw: string): JourneyRunPayload | null {
  try {
    const parsed = JSON.parse(raw) as JourneyRunPayload;
    if (parsed && typeof parsed.journeyId === "string" && Array.isArray(parsed.steps)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/* ---------------- GET — list this session's runs ---------------- */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = cleanSession(url.searchParams.get("sessionId"));
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required." }, { status: 400 });
  }

  try {
    const rows = await db.journeyRun.findMany({
      where: { sessionId },
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      runs: rows.map((row) => ({
        journeyId: row.journeyId,
        status: row.status as JourneyRunStatus,
        stepsDone: parseStepsDone(row.stepsDone),
        payload: parsePayload(row.payload),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[/api/sasi/journeys GET] list failed:", err);
    return NextResponse.json(
      { error: "SASI could not load your journeys just now." },
      { status: 500 }
    );
  }
}

/* ---------------- POST — upsert one run ---------------- */
export async function POST(req: Request) {
  let body: {
    sessionId?: string;
    journeyId?: string;
    status?: string;
    stepsDone?: unknown;
    payload?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const sessionId = cleanSession(body.sessionId);
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required." }, { status: 400 });
  }

  const journeyId = typeof body.journeyId === "string" ? body.journeyId.trim() : "";
  if (!journeyId || journeyId.length > 160) {
    return NextResponse.json({ error: "journeyId required." }, { status: 400 });
  }

  /* Reject unknown journeys honestly — SASI never pretends to guide a
     journey it does not actually have. */
  const entry = registryEntryByJourneyId(journeyId);
  if (!entry || !journeyStepsFor(journeyId)) {
    return NextResponse.json(
      { error: "Unknown journey. This journey is not in SASI's service registry." },
      { status: 400 }
    );
  }

  const status =
    typeof body.status === "string" && STATUSES.includes(body.status) ? body.status : "ACTIVE";

  let stepsDone: number[] = [];
  if (body.stepsDone !== undefined) {
    if (!Array.isArray(body.stepsDone)) {
      return NextResponse.json(
        { error: "stepsDone must be an array of step indexes." },
        { status: 400 }
      );
    }
    stepsDone = (body.stepsDone as unknown[]).filter(
      (n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 999
    );
    if (stepsDone.length > 100) stepsDone = stepsDone.slice(0, 100);
  }

  /* payload: the journey snapshot is built SERVER-SIDE from the registry so
     a client cannot inject fabricated journey content into the stored run. */
  const payload = JSON.stringify({
    journeyId,
    slug: entry.slug,
    title: entry.title,
    department: entry.department,
    steps: journeyStepsFor(journeyId),
    startedAt: new Date().toISOString(),
  });

  try {
    const userId = await serverUserId();

    const row = await db.journeyRun.upsert({
      where: { sessionId_journeyId: { sessionId, journeyId } },
      create: {
        sessionId,
        userId,
        journeyId,
        status,
        stepsDone: JSON.stringify(stepsDone),
        payload,
      },
      update: {
        status,
        stepsDone: JSON.stringify(stepsDone),
        /* strengthen ownership when the same session signs in later */
        ...(userId ? { userId } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      run: {
        journeyId: row.journeyId,
        status: row.status as JourneyRunStatus,
        stepsDone: parseStepsDone(row.stepsDone),
        payload: parsePayload(row.payload),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[/api/sasi/journeys POST] save failed:", err);
    return NextResponse.json(
      { error: "SASI could not save your journey progress just now." },
      { status: 500 }
    );
  }
}
