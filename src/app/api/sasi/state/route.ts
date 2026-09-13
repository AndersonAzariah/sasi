import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimitService, tooManyRequests } from "@/lib/sasi/api-auth";
import type {
  AppNotification,
  CityBriefing,
  EvidenceItem,
  SasiCase,
} from "@/lib/sasi/types";

/* ============================================================
   /api/sasi/state — the "survive a reload" layer.

   GET    ?sessionId=…               → user cases + chat + saved location + evidence + briefings + live notifications
   POST   { type:"case", … }         → upsert a user-created case payload
   POST   { type:"location", … }     → persist saved location
   POST   { type:"evidence", … }     → upsert an evidence item
   POST   { type:"briefing", … }     → append a City briefing snapshot (history)
   POST   { type:"notification", … } → append a live notification (idempotent by notificationId)
   POST   { type:"notification-read" } → mark one (notificationId) or all live notifications read
   DELETE ?sessionId=&scope=chat     → clear chat history for the session
   DELETE ?sessionId=&scope=notifications → clear live notifications for the session

   OWNERSHIP MODEL (schema is frozen — honest scope):
   - Every query is scoped by the caller's sessionId (a 122-bit random
     UUID kept in the browser; it is the bearer secret for session data).
   - When the caller ALSO has a NextAuth session, CaseRecord rows are
     additionally bound to the account: writes stamp/claim userId, a
     row claimed by one account can never be read or rewritten by
     another account, and reads include only unclaimed rows or the
     caller's own.
   - ChatMessage / EvidenceRecord / BriefingRecord / NotificationRecord
     / Profile have NO userId column, so they are sessionId-scoped
     only — a future migration should add userId to bind them too.
   - The shared fallback id "sasi-anon" (emitted by the client when
     localStorage is blocked) is REJECTED: it would otherwise be one
     public bucket every storage-blocked browser reads and writes.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The client's storage-blocked fallback (src/lib/sasi/utils.ts) is a
    SHARED constant — accepting it would make every storage-blocked
    browser read and write one public bucket. */
const SHARED_FALLBACK_SESSION_ID = "sasi-anon";

/** Payload caps — a JSON body may be huge even when the object shape
    is small; stringify first, then bound what reaches PostgreSQL. */
const MAX_CASE_PAYLOAD_CHARS = 200_000;
const MAX_EVIDENCE_PAYLOAD_CHARS = 200_000;
const MAX_BRIEFING_PAYLOAD_CHARS = 100_000;
const MAX_NOTIFICATION_PAYLOAD_CHARS = 20_000;

interface SavedLocation {
  province: string;
  city: string;
  suburb: string;
}

function cleanSession(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  return s.length > 0 && s.length <= 128 ? s : null;
}

/** Validated, private session id — null when absent or shared. */
function privateSession(raw: string | null | undefined): string | null {
  const sessionId = cleanSession(raw);
  if (!sessionId || sessionId === SHARED_FALLBACK_SESSION_ID) return null;
  return sessionId;
}

function badSession(): NextResponse {
  return NextResponse.json(
    {
      error:
        "A private session id is required. SASI will not store data in a shared browser session.",
    },
    { status: 400 }
  );
}

async function callerUserId(): Promise<string | null> {
  const session = await getAuthSession();
  return session?.user?.id ?? null;
}

/* ---------------- GET — hydrate ---------------- */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = privateSession(url.searchParams.get("sessionId"));
  if (!sessionId) return badSession();
  const userId = await callerUserId();

  try {
    const [caseRows, chatRows, profile, evidenceRows, briefingRows, notificationRows] =
      await Promise.all([
        db.caseRecord.findMany({
          where: {
            sessionId,
            /* unclaimed rows (created before sign-in) plus the caller's
               own — never another account's claimed rows */
            ...(userId ? { OR: [{ userId: null }, { userId }] } : {}),
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        db.chatMessage.findMany({
          where: { sessionId },
          orderBy: { createdAt: "asc" },
          take: 100,
        }),
        db.profile.findUnique({ where: { sessionId } }),
        db.evidenceRecord.findMany({
          where: { sessionId },
          orderBy: { createdAt: "desc" },
          take: 60,
        }),
        db.briefingRecord.findMany({
          where: { sessionId },
          orderBy: { createdAt: "desc" },
          take: 8,
        }),
        db.notificationRecord.findMany({
          where: { sessionId },
          orderBy: { createdAt: "desc" },
          take: 40,
        }),
      ]);

    const cases: SasiCase[] = [];
    for (const row of caseRows) {
      try {
        const payload = JSON.parse(row.payload) as SasiCase;
        if (payload && payload.id && payload.ref) cases.push(payload);
      } catch {
        /* corrupted row — skip, never block hydration */
      }
    }

    const evidence: EvidenceItem[] = [];
    for (const row of evidenceRows) {
      try {
        const payload = JSON.parse(row.payload) as EvidenceItem;
        if (payload && payload.id) evidence.push(payload);
      } catch {
        /* skip corrupt rows */
      }
    }

    const briefings: CityBriefing[] = [];
    for (const row of briefingRows) {
      try {
        const payload = JSON.parse(row.payload) as CityBriefing;
        if (payload && payload.headline && Array.isArray(payload.sections)) {
          briefings.push(payload);
        }
      } catch {
        /* skip corrupt rows */
      }
    }

    const chat = chatRows
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        content: m.content,
        at: m.createdAt.toISOString(),
        state: "done" as const,
        refs: m.refs ? (JSON.parse(m.refs) as string[]) : undefined,
      }));

    let location: SavedLocation | null = null;
    if (profile?.location) {
      try {
        const parsed = JSON.parse(profile.location) as SavedLocation;
        if (parsed && typeof parsed.city === "string") location = parsed;
      } catch {
        /* ignore */
      }
    }

    const notifications: AppNotification[] = [];
    for (const row of notificationRows) {
      try {
        const payload = JSON.parse(row.payload) as AppNotification;
        if (payload && payload.id && payload.title) {
          /* the read flag lives on the column — wins over the payload copy */
          notifications.push({ ...payload, read: row.read });
        }
      } catch {
        /* skip corrupt rows */
      }
    }

    return NextResponse.json({
      cases,
      chat,
      evidence,
      briefings,
      notifications,
      location,
    });
  } catch (err) {
    console.error("[/api/sasi/state GET] hydrate failed:", err);
    return NextResponse.json(
      { error: "SASI could not load your saved data. The demo still works without it." },
      { status: 500 }
    );
  }
}

/* ---------------- POST — save case / location ---------------- */
export async function POST(req: Request) {
  let body: {
    type?: string;
    sessionId?: string;
    case?: SasiCase;
    evidence?: EvidenceItem;
    location?: SavedLocation;
    briefing?: CityBriefing;
    notification?: AppNotification;
    notificationId?: string;
    all?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const sessionId = privateSession(body.sessionId);
  if (!sessionId) return badSession();

  /* Light throttle: the client persists on every meaningful action
     (report, evidence, briefing, notification). 120/min per session
     absorbs normal use and blunts scripted flooding. */
  const limit = await rateLimitService.limit(`state-post:${sessionId}`, 120, 60_000);
  if (!limit.allowed) {
    return tooManyRequests(limit.retryAfterMs, "Too many saves in a minute. Try again shortly.");
  }

  const userId = await callerUserId();

  try {
    if (body.type === "case" && body.case) {
      const c = body.case;
      if (!c.id || !c.ref) {
        return NextResponse.json({ error: "case.id and case.ref required." }, { status: 400 });
      }
      const payload = JSON.stringify(c);
      if (payload.length > MAX_CASE_PAYLOAD_CHARS) {
        return NextResponse.json({ error: "That case is too large to save." }, { status: 413 });
      }
      /* refs are unique per session — two browsers may both have CASE-000124 */
      const existing = await db.caseRecord.findUnique({
        where: { sessionId_ref: { sessionId, ref: c.ref } },
        select: { userId: true },
      });
      if (existing && existing.userId && existing.userId !== userId) {
        /* claimed by a different account — never readable or rewritable here */
        return NextResponse.json(
          { error: "This case belongs to a different account." },
          { status: 403 }
        );
      }
      await db.caseRecord.upsert({
        where: { sessionId_ref: { sessionId, ref: c.ref } },
        create: {
          ref: c.ref,
          sessionId,
          userId, // null for anonymous callers; stamped once they sign in
          service: c.service ?? "other",
          title: (c.title ?? "Report").slice(0, 200),
          payload,
        },
        update: {
          payload,
          title: (c.title ?? "Report").slice(0, 200),
          /* claim unclaimed rows on the first authenticated save */
          ...(userId ? { userId } : {}),
        },
      });
      return NextResponse.json({ ok: true, ref: c.ref });
    }

    if (body.type === "evidence" && body.evidence) {
      const ev = body.evidence;
      if (!ev.id) {
        return NextResponse.json({ error: "evidence.id required." }, { status: 400 });
      }
      const payload = JSON.stringify(ev);
      if (payload.length > MAX_EVIDENCE_PAYLOAD_CHARS) {
        return NextResponse.json({ error: "That evidence item is too large to save." }, { status: 413 });
      }
      const existing = await db.evidenceRecord.findUnique({
        where: { evidenceId: ev.id },
        select: { sessionId: true },
      });
      if (existing && existing.sessionId !== sessionId) {
        return NextResponse.json(
          { error: "This evidence item belongs to a different session." },
          { status: 403 }
        );
      }
      await db.evidenceRecord.upsert({
        where: { evidenceId: ev.id },
        create: { evidenceId: ev.id, sessionId, payload },
        update: { payload },
      });
      return NextResponse.json({ ok: true, id: ev.id });
    }

    if (body.type === "briefing" && body.briefing) {
      const b = body.briefing;
      if (!b.headline || !Array.isArray(b.sections)) {
        return NextResponse.json(
          { error: "briefing.headline and briefing.sections required." },
          { status: 400 }
        );
      }
      const payload = JSON.stringify(b);
      if (payload.length > MAX_BRIEFING_PAYLOAD_CHARS) {
        return NextResponse.json({ error: "That briefing is too large to save." }, { status: 413 });
      }
      /* append-only history — the client caps what it keeps (8) */
      const row = await db.briefingRecord.create({
        data: {
          sessionId,
          risk: String(b.risk ?? "ELEVATED").slice(0, 12),
          headline: b.headline.slice(0, 200),
          payload,
        },
      });
      return NextResponse.json({ ok: true, id: row.id });
    }

    if (body.type === "notification" && body.notification) {
      const n = body.notification;
      if (!n.id || !n.title) {
        return NextResponse.json(
          { error: "notification.id and notification.title required." },
          { status: 400 }
        );
      }
      const payload = JSON.stringify(n);
      if (payload.length > MAX_NOTIFICATION_PAYLOAD_CHARS) {
        return NextResponse.json({ error: "That notification is too large to save." }, { status: 413 });
      }
      const existing = await db.notificationRecord.findUnique({
        where: { notificationId: n.id },
        select: { sessionId: true },
      });
      if (existing && existing.sessionId !== sessionId) {
        return NextResponse.json(
          { error: "This notification belongs to a different session." },
          { status: 403 }
        );
      }
      /* idempotent by client id — a re-push never duplicates a row */
      await db.notificationRecord.upsert({
        where: { notificationId: n.id },
        create: {
          notificationId: n.id,
          sessionId,
          read: Boolean(n.read),
          payload,
        },
        update: { payload },
      });
      return NextResponse.json({ ok: true, id: n.id });
    }

    if (body.type === "notification-read") {
      if (body.all) {
        await db.notificationRecord.updateMany({
          where: { sessionId },
          data: { read: true },
        });
      } else if (body.notificationId) {
        await db.notificationRecord.updateMany({
          where: { sessionId, notificationId: body.notificationId },
          data: { read: true },
        });
      } else {
        return NextResponse.json(
          { error: "notificationId or all required." },
          { status: 400 }
        );
      }
      return NextResponse.json({ ok: true });
    }

    if (body.type === "location" && body.location) {
      const loc = body.location;
      const data = JSON.stringify({
        province: String(loc.province ?? "Gauteng").slice(0, 80),
        city: String(loc.city ?? "Johannesburg").slice(0, 80),
        suburb: String(loc.suburb ?? "").slice(0, 120),
      });
      await db.profile.upsert({
        where: { sessionId },
        create: { sessionId, location: data },
        update: { location: data },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown type or missing payload." }, { status: 400 });
  } catch (err) {
    console.error("[/api/sasi/state POST] save failed:", err);
    return NextResponse.json({ error: "SASI could not save that just now." }, { status: 500 });
  }
}

/* ---------------- DELETE — clear chat ---------------- */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const sessionId = privateSession(url.searchParams.get("sessionId"));
  const scope = url.searchParams.get("scope") ?? "chat";
  if (!sessionId) return badSession();
  if (scope !== "chat" && scope !== "notifications") {
    return NextResponse.json({ error: "Unsupported scope." }, { status: 400 });
  }

  try {
    const res =
      scope === "chat"
        ? await db.chatMessage.deleteMany({ where: { sessionId } })
        : await db.notificationRecord.deleteMany({ where: { sessionId } });
    return NextResponse.json({ ok: true, deleted: res.count });
  } catch (err) {
    console.error("[/api/sasi/state DELETE] clear failed:", err);
    return NextResponse.json({ error: "SASI could not clear that just now." }, { status: 500 });
  }
}
