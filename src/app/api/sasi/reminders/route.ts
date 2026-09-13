import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ReminderDTO } from "@/lib/sasi/services-registry";

/* ============================================================
   /api/sasi/reminders — Phase 11: SASI-side reminders.

   POST   { sessionId, title, note?, dueAt? }   → create
   GET    ?sessionId=…                          → list (pending first)
   PATCH  { sessionId, id, done }               → mark done / not done
   DELETE ?sessionId=&id=                       → delete

   Ownership mirrors /api/sasi/state exactly: sessionId from the
   request, userId attached server-side from the NextAuth session
   when present (never trusted from the client).

   These reminders live in SASI only. They are never sent to any
   government system and the UI must label every one of them
   "SASI reminder — not from government".
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanSession(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  return s.length > 0 && s.length <= 128 ? s : null;
}

async function serverUserId(): Promise<string | null> {
  try {
    const session = await getAuthSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

function toDTO(row: {
  id: string;
  title: string;
  note: string | null;
  dueAt: Date | null;
  done: boolean;
  createdAt: Date;
}): ReminderDTO {
  return {
    id: row.id,
    title: row.title,
    note: row.note,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    done: row.done,
    createdAt: row.createdAt.toISOString(),
  };
}

/* ---------------- POST — create a reminder ---------------- */
export async function POST(req: Request) {
  let body: {
    sessionId?: string;
    title?: string;
    note?: string;
    dueAt?: string;
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

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title || title.length > 200) {
    return NextResponse.json(
      { error: "A title of 1–200 characters is required." },
      { status: 400 }
    );
  }

  const note =
    typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 1000) : null;

  let dueAt: Date | null = null;
  if (typeof body.dueAt === "string" && body.dueAt.trim()) {
    const d = new Date(body.dueAt.trim());
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "dueAt must be a valid date." }, { status: 400 });
    }
    dueAt = d;
  }

  try {
    const userId = await serverUserId();
    const row = await db.reminder.create({
      data: { sessionId, userId, title, note, dueAt },
    });
    return NextResponse.json({ ok: true, reminder: toDTO(row) });
  } catch (err) {
    console.error("[/api/sasi/reminders POST] create failed:", err);
    return NextResponse.json(
      { error: "SASI could not create that reminder just now." },
      { status: 500 }
    );
  }
}

/* ---------------- GET — list (pending first) ---------------- */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = cleanSession(url.searchParams.get("sessionId"));
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required." }, { status: 400 });
  }

  try {
    const rows = await db.reminder.findMany({
      where: { sessionId },
      orderBy: [{ done: "asc" }, { createdAt: "desc" }],
      take: 100,
    });
    return NextResponse.json({ reminders: rows.map(toDTO) });
  } catch (err) {
    console.error("[/api/sasi/reminders GET] list failed:", err);
    return NextResponse.json(
      { error: "SASI could not load your reminders just now." },
      { status: 500 }
    );
  }
}

/* ---------------- PATCH — mark done / not done ---------------- */
export async function PATCH(req: Request) {
  let body: {
    sessionId?: string;
    id?: string;
    done?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const sessionId = cleanSession(body.sessionId);
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!sessionId || !id) {
    return NextResponse.json({ error: "sessionId and id required." }, { status: 400 });
  }
  const done = Boolean(body.done);

  try {
    const res = await db.reminder.updateMany({
      where: { sessionId, id },
      data: { done },
    });
    if (res.count === 0) {
      return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id, done });
  } catch (err) {
    console.error("[/api/sasi/reminders PATCH] update failed:", err);
    return NextResponse.json(
      { error: "SASI could not update that reminder just now." },
      { status: 500 }
    );
  }
}

/* ---------------- DELETE — remove a reminder ---------------- */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const sessionId = cleanSession(url.searchParams.get("sessionId"));
  const id = cleanSession(url.searchParams.get("id"));
  if (!sessionId || !id) {
    return NextResponse.json({ error: "sessionId and id required." }, { status: 400 });
  }

  try {
    const res = await db.reminder.deleteMany({ where: { sessionId, id } });
    if (res.count === 0) {
      return NextResponse.json({ error: "Reminder not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, deleted: res.count });
  } catch (err) {
    console.error("[/api/sasi/reminders DELETE] delete failed:", err);
    return NextResponse.json(
      { error: "SASI could not delete that reminder just now." },
      { status: 500 }
    );
  }
}
