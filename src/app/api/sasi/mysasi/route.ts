import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import type {
  AppNotificationLiteDTO,
  ConversationDayDTO,
  JourneyRunPayload,
  MySasiResponse,
} from "@/lib/sasi/services-registry";
import type { AppNotification } from "@/lib/sasi/types";

/* ============================================================
   /api/sasi/mysasi — Phase 11: one honest aggregate for MY SASI.

   GET ?sessionId=…
     → { activeJourneys, savedItems, reminders,
         recentConversations, recentNotifications }

   Every array is scoped to the caller's own session. When there is
   nothing yet the arrays are EMPTY — SASI never fabricates rows to
   make the page look alive.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanSession(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  return s.length > 0 && s.length <= 128 ? s : null;
}

/** UTC day key for grouping chat messages by day ("2026-02-10"). */
function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/* ---------------- GET — the My SASI aggregate ---------------- */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = cleanSession(url.searchParams.get("sessionId"));
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required." }, { status: 400 });
  }

  try {
    const [journeyRows, savedRows, reminderRows, chatRows, notificationRows] = await Promise.all([
      /* Continue: runs still in progress (ACTIVE or PAUSED) */
      db.journeyRun.findMany({
        where: { sessionId, status: { in: ["ACTIVE", "PAUSED"] } },
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
      db.savedItem.findMany({
        where: { sessionId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.reminder.findMany({
        where: { sessionId },
        orderBy: [{ done: "asc" }, { createdAt: "desc" }],
        take: 50,
      }),
      /* last 20 chat rows; grouped client-visibly by day below */
      db.chatMessage.findMany({
        where: { sessionId, role: { in: ["user", "assistant"] } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.notificationRecord.findMany({
        where: { sessionId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const activeJourneys = journeyRows.map((row) => {
      let stepsDone: number[] = [];
      try {
        const parsed = JSON.parse(row.stepsDone) as unknown;
        if (Array.isArray(parsed)) {
          stepsDone = parsed.filter(
            (n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0
          );
        }
      } catch {
        /* corrupt row — keep empty, never block the page */
      }
      let payload: JourneyRunPayload | null = null;
      try {
        const parsed = JSON.parse(row.payload) as JourneyRunPayload;
        if (parsed && typeof parsed.journeyId === "string" && Array.isArray(parsed.steps)) {
          payload = parsed;
        }
      } catch {
        /* corrupt row — null payload, the view falls back to the registry */
      }
      return {
        journeyId: row.journeyId,
        status: row.status as "ACTIVE" | "PAUSED",
        stepsDone,
        payload,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });

    const savedItems = savedRows.map((row) => {
      let payload: MySasiResponse["savedItems"][number]["payload"] = null;
      try {
        const parsed = JSON.parse(row.payload) as { title?: string };
        if (parsed && typeof parsed === "object" && typeof parsed.title === "string") {
          payload = parsed as MySasiResponse["savedItems"][number]["payload"];
        }
      } catch {
        /* skip corrupt rows */
      }
      return {
        id: row.id,
        kind: row.kind,
        itemId: row.itemId,
        payload,
        createdAt: row.createdAt.toISOString(),
      };
    });

    const reminders = reminderRows.map((row) => ({
      id: row.id,
      title: row.title,
      note: row.note,
      dueAt: row.dueAt ? row.dueAt.toISOString() : null,
      done: row.done,
      createdAt: row.createdAt.toISOString(),
    }));

    /* oldest-first within the window, then bucketed by UTC day, newest day first */
    const orderedChat = [...chatRows].reverse();
    const dayMap = new Map<string, ConversationDayDTO>();
    for (const row of orderedChat) {
      const day = utcDayKey(row.createdAt);
      let bucket = dayMap.get(day);
      if (!bucket) {
        bucket = { day, messages: [] };
        dayMap.set(day, bucket);
      }
      bucket.messages.push({
        id: row.id,
        role: row.role === "assistant" ? "assistant" : "user",
        content: row.content,
        at: row.createdAt.toISOString(),
      });
    }
    const recentConversations = [...dayMap.values()].sort((a, b) => b.day.localeCompare(a.day));

    const recentNotifications: AppNotificationLiteDTO[] = [];
    for (const row of notificationRows) {
      try {
        const payload = JSON.parse(row.payload) as AppNotification;
        if (payload && payload.id && payload.title) {
          /* the read flag lives on the column — wins over the payload copy */
          recentNotifications.push({
            id: payload.id,
            kind: payload.kind,
            title: payload.title,
            body: payload.body,
            at: payload.at ?? row.createdAt.toISOString(),
            read: row.read,
            caseRef: payload.caseRef,
          });
        }
      } catch {
        /* skip corrupt rows */
      }
    }

    const body: MySasiResponse = {
      activeJourneys,
      savedItems,
      reminders,
      recentConversations,
      recentNotifications,
    };
    return NextResponse.json(body);
  } catch (err) {
    console.error("[/api/sasi/mysasi GET] aggregate failed:", err);
    return NextResponse.json(
      { error: "SASI could not load your workspace just now." },
      { status: 500 }
    );
  }
}
