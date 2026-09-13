import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import {
  rateLimitService,
  requireUserId,
  serverError,
  tooManyRequests,
} from "@/lib/sasi/api-auth";

/* ============================================================
   DELETE /api/sasi/auth/account — real account deletion.

   Requires a verified NextAuth session; the session's user id is
   the ONLY ownership proof (never a client-supplied id).

   What actually happens (one atomic transaction — either all of it
   happens or nothing does):
   1. DELETE the user's AuditEvent rows and SubmissionRecord rows
      (both hold a real FK to User, so they must go before the User).
   2. DETACH every other user-owned row by setting userId = null:
      CaseRecord, ChatMessage, EvidenceRecord, BriefingRecord,
      NotificationRecord, Profile, JourneyRun, SavedItem, Reminder and
      DocumentRecord. Those rows belong to the browser session and stay
      with it — only the account identity is removed.
   3. DELETE the User row.

   No data is invented: the response is { deleted: true } on success
   or an honest error. Failures return 500 with a generic message;
   the transaction guarantees "nothing was changed" is then true.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE() {
  const auth = await requireUserId();
  if (!auth.ok) return auth.response;

  /* Destructive + irreversible — keep a tight throttle even for a
     signed-in caller (also blunts a hijacked session hammering it). */
  const limit = await rateLimitService.limit(
    `account-delete:${auth.userId}`,
    5,
    10 * 60 * 1000
  );
  if (!limit.allowed) {
    return tooManyRequests(
      limit.retryAfterMs,
      "Too many deletion attempts. Wait a few minutes and try again."
    );
  }

  try {
    /* Honest 404 when the session points at an account that is
       already gone (e.g. deleted on another device moments ago). */
    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "Account not found." },
        { status: 404 }
      );
    }

    await db.$transaction([
      /* FK-constrained rows first */
      db.auditEvent.deleteMany({ where: { userId: auth.userId } }),
      db.submissionRecord.deleteMany({ where: { userId: auth.userId } }),
      /* then detach every browser-session-owned row (Task 29: all
         user-owned tables are now covered) */
      db.caseRecord.updateMany({
        where: { userId: auth.userId },
        data: { userId: null },
      }),
      db.chatMessage.updateMany({
        where: { userId: auth.userId },
        data: { userId: null },
      }),
      db.evidenceRecord.updateMany({
        where: { userId: auth.userId },
        data: { userId: null },
      }),
      db.briefingRecord.updateMany({
        where: { userId: auth.userId },
        data: { userId: null },
      }),
      db.notificationRecord.updateMany({
        where: { userId: auth.userId },
        data: { userId: null },
      }),
      db.profile.updateMany({
        where: { userId: auth.userId },
        data: { userId: null },
      }),
      db.journeyRun.updateMany({
        where: { userId: auth.userId },
        data: { userId: null },
      }),
      db.savedItem.updateMany({
        where: { userId: auth.userId },
        data: { userId: null },
      }),
      db.reminder.updateMany({
        where: { userId: auth.userId },
        data: { userId: null },
      }),
      db.documentRecord.updateMany({
        where: { userId: auth.userId },
        data: { userId: null },
      }),
      /* finally the account itself */
      db.user.delete({ where: { id: auth.userId } }),
    ]);

    return NextResponse.json({ deleted: true });
  } catch (err) {
    return serverError(
      "[/api/sasi/auth/account DELETE]",
      err,
      "SASI could not delete the account right now. Nothing was changed — please try again."
    );
  }
}
