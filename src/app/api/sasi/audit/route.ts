import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUserId, serverError } from "@/lib/sasi/api-auth";

/* ============================================================
   GET  /api/sasi/audit?ref=CASE-000123  — the user's audit trail.
   Rows are written by the SERVER when real events happen; nothing
   here can be triggered for an action that did not occur.

   POST /api/sasi/audit — reserved for explicit client-side events
   that correspond to real user actions on their own data
   (e.g. EVIDENCE_REVIEWED when the user marks their own evidence
   reviewed). The event type is allow-listed; the server stamps
   the actor and owner. AI can never write a "reviewed" event.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WRITE_EVENTS = new Set([
  "EVIDENCE_REVIEWED",
  "HUMAN_REVIEW_COMPLETED",
  "CASE_ARCHIVED",
]);

const WriteSchema = z.object({
  eventType: z.string().refine((v) => WRITE_EVENTS.has(v), "Unknown event type."),
  caseRef: z.string().trim().max(24).optional(),
  description: z.string().trim().min(1).max(300),
  resourceType: z.string().trim().max(24).optional(),
  resourceId: z.string().trim().max(80).optional(),
});

export async function GET(req: Request) {
  const auth = await requireUserId();
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const ref = url.searchParams.get("ref");

  try {
    const events = await db.auditEvent.findMany({
      where: {
        userId: auth.userId,
        ...(ref ? { caseRef: ref.slice(0, 24) } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: ref ? 100 : 60,
    });
    return NextResponse.json({ events });
  } catch (err) {
    return serverError(
      "[/api/sasi/audit GET]",
      err,
      "SASI could not load the audit trail right now."
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireUserId();
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = WriteSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid event." },
      { status: 400 }
    );
  }

  try {
    const event = await db.auditEvent.create({
      data: {
        userId: auth.userId, // owner is the session, never the client's claim
        eventType: parsed.data.eventType,
        actor: "USER", // a human review action, by the signed-in user
        description: parsed.data.description,
        caseRef: parsed.data.caseRef,
        resourceType: parsed.data.resourceType,
        resourceId: parsed.data.resourceId,
      },
    });
    return NextResponse.json({ ok: true, id: event.id }, { status: 201 });
  } catch (err) {
    return serverError(
      "[/api/sasi/audit POST]",
      err,
      "SASI could not record that event right now."
    );
  }
}
