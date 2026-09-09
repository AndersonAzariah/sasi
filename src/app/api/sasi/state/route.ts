import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { EvidenceItem, SasiCase } from "@/lib/sasi/types";

/* ============================================================
   /api/sasi/state — the "survive a reload" layer.

   GET    ?sessionId=…            → user cases + chat + saved location
   POST   { type:"case", … }      → upsert a user-created case payload
   POST   { type:"location", … }  → persist saved location
   DELETE ?sessionId=&scope=chat  → clear chat history for the session
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
    const [caseRows, chatRows, profile, evidenceRows] = await Promise.all([
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

    return NextResponse.json({ cases, chat, evidence, location });
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
      await db.caseRecord.upsert({
        where: { ref: c.ref },
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
  if (scope !== "chat") {
    return NextResponse.json({ error: "Unsupported scope." }, { status: 400 });
  }

  try {
    const res = await db.chatMessage.deleteMany({ where: { sessionId } });
    return NextResponse.json({ ok: true, deleted: res.count });
  } catch (err) {
    console.error("[/api/sasi/state DELETE] clear failed:", err);
    return NextResponse.json({ error: "SASI could not clear that just now." }, { status: 500 });
  }
}
