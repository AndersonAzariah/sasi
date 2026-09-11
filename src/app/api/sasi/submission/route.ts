import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { requireUserId, serverError } from "@/lib/sasi/api-auth";
import { submissionCapabilities, submitToInstitution } from "@/lib/sasi/submission";

/* ============================================================
   GET  /api/sasi/submission — honest capability report.
   Always answers { connected: false } while no real adapter
   exists, plus the user's past (never-faked) submission records.

   POST /api/sasi/submission — records a PREPARATION request.
   It does NOT submit anything and fabricates nothing: the row is
   stored with status NOT_CONNECTED and externalReference stays
   null. The request payload is kept so a future adapter could
   re-send it with the user's explicit approval.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SubmitSchema = z.object({
  caseRef: z.string().trim().regex(/^CASE-\d{6}$/, "A case reference is required."),
  institutionKey: z.string().trim().min(1).max(64),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export async function GET() {
  const auth = await requireUserId();
  if (!auth.ok) return auth.response;

  try {
    const records = await db.submissionRecord.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return NextResponse.json({
      ...submissionCapabilities(),
      records: records.map((r) => ({
        id: r.id,
        caseRef: r.caseRef,
        institutionKey: r.institutionKey,
        status: r.status, // NOT_CONNECTED is the only status that can exist today
        externalReference: r.externalReference, // always null today
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    return serverError(
      "[/api/sasi/submission GET]",
      err,
      "SASI could not load submission records right now."
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

  const parsed = SubmitSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 }
    );
  }

  const { caseRef, institutionKey, payload } = parsed.data;

  try {
    /* Ownership first: the case must belong to the signed-in user. */
    const owned = await db.caseRecord.findFirst({
      where: { userId: auth.userId, ref: caseRef },
      select: { id: true },
    });
    if (!owned) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    /* The honesty seam: no adapter exists, so nothing is sent. */
    const result = await submitToInstitution({
      userId: auth.userId,
      caseRef,
      institutionKey,
      payload,
    });

    const record = await db.submissionRecord.create({
      data: {
        userId: auth.userId,
        caseRef,
        institutionKey,
        institutionName: null, // no real institution is known yet
        status: result.status, // NOT_CONNECTED
        externalReference: result.externalReference, // null — always, today
        requestPayload: JSON.stringify(payload).slice(0, 20000),
        resultPayload: JSON.stringify({ message: result.message }),
      },
    });

    return NextResponse.json(
      {
        ok: true,
        id: record.id,
        status: result.status,
        externalReference: result.externalReference,
        message: result.message,
      },
      { status: 200 }
    );
  } catch (err) {
    return serverError(
      "[/api/sasi/submission POST]",
      err,
      "SASI could not record that submission request right now."
    );
  }
}
