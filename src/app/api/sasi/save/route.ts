import { NextResponse } from "next/server";

import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { registryEntryBySlug, type SavedItemDTO, type SavedItemPayload } from "@/lib/sasi/services-registry";

/* ============================================================
   /api/sasi/save — Phase 11: My SASI saved items.

   POST   { sessionId, kind, itemId, payload? }  → idempotent save (upsert on
                                                    (sessionId, kind, itemId))
   GET    ?sessionId=…                           → this session's saved items
   DELETE ?sessionId=&kind=&itemId=              → unsave

   Ownership mirrors /api/sasi/state exactly: sessionId from the
   request, userId attached server-side from the NextAuth session
   when present (never trusted from the client).

   Saved items are SASI BOOKMARKS. Saving a service never implies
   any relationship with the government body — the UI labels them
   as saved-in-SASI references.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS: readonly string[] = ["service", "journey", "answer", "info"];

function cleanSession(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  return s.length > 0 && s.length <= 128 ? s : null;
}

function cleanItem(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  return s.length > 0 && s.length <= 160 ? s : null;
}

async function serverUserId(): Promise<string | null> {
  try {
    const session = await getAuthSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

function parsePayload(raw: string): SavedItemPayload | null {
  try {
    const parsed = JSON.parse(raw) as SavedItemPayload;
    if (parsed && typeof parsed === "object" && "title" in parsed) return parsed;
    return null;
  } catch {
    return null;
  }
}

function toDTO(row: {
  id: string;
  kind: string;
  itemId: string;
  payload: string;
  createdAt: Date;
}): SavedItemDTO {
  return {
    id: row.id,
    kind: row.kind,
    itemId: row.itemId,
    payload: parsePayload(row.payload),
    createdAt: row.createdAt.toISOString(),
  };
}

/* ---------------- POST — save (idempotent) ---------------- */
export async function POST(req: Request) {
  let body: {
    sessionId?: string;
    kind?: string;
    itemId?: string;
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

  const kind = typeof body.kind === "string" ? body.kind.trim() : "";
  if (!KINDS.includes(kind)) {
    return NextResponse.json(
      { error: `kind must be one of: ${KINDS.join(", ")}.` },
      { status: 400 }
    );
  }

  const itemId = cleanItem(body.itemId);
  if (!itemId) {
    return NextResponse.json({ error: "itemId required." }, { status: 400 });
  }

  /* For services, the slug must be real — never save a service SASI
     does not have. */
  if (kind === "service" && !registryEntryBySlug(itemId)) {
    return NextResponse.json(
      { error: "Unknown service. This service is not in SASI's registry." },
      { status: 400 }
    );
  }

  /* payload: only a small display snapshot is stored. */
  const payload = JSON.stringify(
    typeof body.payload === "object" && body.payload !== null
      ? body.payload
      : { title: itemId }
  ).slice(0, 4000);

  try {
    const userId = await serverUserId();

    await db.savedItem.upsert({
      where: { sessionId_kind_itemId: { sessionId, kind, itemId } },
      create: { sessionId, userId, kind, itemId, payload },
      update: {
        payload,
        /* strengthen ownership when the same session signs in later */
        ...(userId ? { userId } : {}),
      },
    });

    return NextResponse.json({ ok: true, saved: true, kind, itemId });
  } catch (err) {
    console.error("[/api/sasi/save POST] save failed:", err);
    return NextResponse.json({ error: "SASI could not save that just now." }, { status: 500 });
  }
}

/* ---------------- GET — list saved items ---------------- */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = cleanSession(url.searchParams.get("sessionId"));
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required." }, { status: 400 });
  }

  try {
    const rows = await db.savedItem.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json({ items: rows.map(toDTO) });
  } catch (err) {
    console.error("[/api/sasi/save GET] list failed:", err);
    return NextResponse.json(
      { error: "SASI could not load your saved items just now." },
      { status: 500 }
    );
  }
}

/* ---------------- DELETE — unsave ---------------- */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const sessionId = cleanSession(url.searchParams.get("sessionId"));
  const kind = cleanItem(url.searchParams.get("kind"));
  const itemId = cleanItem(url.searchParams.get("itemId"));
  if (!sessionId || !kind || !itemId) {
    return NextResponse.json(
      { error: "sessionId, kind and itemId required." },
      { status: 400 }
    );
  }

  try {
    const res = await db.savedItem.deleteMany({
      where: { sessionId, kind, itemId },
    });
    return NextResponse.json({ ok: true, saved: false, deleted: res.count });
  } catch (err) {
    console.error("[/api/sasi/save DELETE] unsave failed:", err);
    return NextResponse.json({ error: "SASI could not remove that just now." }, { status: 500 });
  }
}
