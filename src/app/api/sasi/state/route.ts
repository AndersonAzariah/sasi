import { NextResponse } from "next/server";
import { db } from "@/lib/db";
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
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/* ---------------- GET — hydrate ---------------- */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = cleanSession(url.searchParams.get("sessionId"));
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required." }, { status: 400 });
  }

  try {
    const [caseRows, chatRows, profile, evidenceRows, briefingRows, notificationRows] =
      await Promise.all([
        db.caseRecord.findMany({
          where: { sessionId },
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

  const sessionId = cleanSession(body.sessionId);
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required." }, { status: 400 });
  }

  try {
    if (body.type === "case" && body.case) {
      const c = body.case;
      if (!c.id || !c.ref) {
        return NextResponse.json({ error: "case.id and case.ref required." }, { status: 400 });
      }
      /* refs are unique per session — two browsers may both have CASE-000124 */
      await db.caseRecord.upsert({
        where: { sessionId_ref: { sessionId, ref: c.ref } },
        create: {
          ref: c.ref,
          sessionId,
          service: c.service ?? "other",
          title: (c.title ?? "Report").slice(0, 200),
          payload: JSON.stringify(c),
        },
        update: { payload: JSON.stringify(c), title: (c.title ?? "Report").slice(0, 200) },
      });
      return NextResponse.json({ ok: true, ref: c.ref });
    }

    if (body.type === "evidence" && body.evidence) {
      const ev = body.evidence;
      if (!ev.id) {
        return NextResponse.json({ error: "evidence.id required." }, { status: 400 });
      }
      await db.evidenceRecord.upsert({
        where: { evidenceId: ev.id },
        create: {
          evidenceId: ev.id,
          sessionId,
          payload: JSON.stringify(ev),
        },
        update: { payload: JSON.stringify(ev) },
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
      /* append-only history — the client caps what it keeps (8) */
      const row = await db.briefingRecord.create({
        data: {
          sessionId,
          risk: String(b.risk ?? "ELEVATED").slice(0, 12),
          headline: b.headline.slice(0, 200),
          payload: JSON.stringify(b),
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
      /* idempotent by client id — a re-push never duplicates a row */
      await db.notificationRecord.upsert({
        where: { notificationId: n.id },
        create: {
          notificationId: n.id,
          sessionId,
          read: Boolean(n.read),
          payload: JSON.stringify(n),
        },
        update: { payload: JSON.stringify(n) },
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
  const sessionId = cleanSession(url.searchParams.get("sessionId"));
  const scope = url.searchParams.get("scope") ?? "chat";
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required." }, { status: 400 });
  }
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
