import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { CASES, INCIDENTS } from "@/lib/sasi/data";
import { SERVICES } from "@/lib/sasi/utils";
import type { BriefingRisk, BriefingSection, CityBriefing } from "@/lib/sasi/types";

/* ============================================================
   POST /api/sasi/briefing
   AI "City briefing" — a short daily digest written by the LLM
   from the user's demo dataset (their cases + tracked incidents
   + saved location). Backend-only — the z-ai SDK is never
   imported from client code.

   Returns STRICT JSON:
     { headline, risk, sections: [{title, body, refs[]}],
       watchlist: [] }
   Two modes:
   - default (city): digest grounded in the user's demo dataset
   - origin:"chat": distils the Ask SASI transcript passed by the
     client into the same briefing shape (chat → dashboard loop)
   The client renders it with honest "AI-generated · demo data"
   framing and clickable refs. Non-streaming on purpose: the
   payload is small and the UI shows a shimmer skeleton.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BriefingBody {
  location?: { province?: string; city?: string; suburb?: string };
  /** the user's own cases from the live client store — grounded into the prompt */
  extraCases?: {
    ref: string;
    title: string;
    status: string;
    service: string;
    city?: string;
    actionState?: string;
  }[];
  /** when "chat", `transcript` is the source material instead of the city dataset */
  origin?: "city" | "chat";
  /** Ask SASI conversation (done messages, ≤ 12) to distil into a briefing */
  transcript?: { role: "user" | "assistant"; content: string }[];
}

const REF_RE = /(CASE-\d{6}|INC-\d{4})/g;

const RISKS: BriefingRisk[] = ["CALM", "ELEVATED", "STRAINED", "CRITICAL"];

function compactContext(
  location: BriefingBody["location"],
  extraCases: BriefingBody["extraCases"]
): string {
  /* merge the user's live cases over the static dataset (dedupe by ref) */
  const merged: { ref: string; status: string; service: string; title: string; city: string; action?: string }[] = [];
  const seen = new Set<string>();
  for (const c of extraCases ?? []) {
    if (seen.has(c.ref)) continue;
    seen.add(c.ref);
    merged.push({
      ref: c.ref,
      status: c.status,
      service: c.service,
      title: c.title,
      city: c.city ?? location?.city ?? "Johannesburg",
      action: c.actionState,
    });
  }
  for (const c of CASES) {
    if (seen.has(c.ref)) continue;
    seen.add(c.ref);
    merged.push({
      ref: c.ref,
      status: c.status,
      service: c.service,
      title: c.title,
      city: c.location.city,
      action: c.proposedAction?.state,
    });
  }

  const cases = merged
    .slice(0, 12)
    .map(
      (c) =>
        `- ${c.ref} [${c.status}] (${c.service}) "${c.title}" — ${c.city}${
          c.action ? ` · action: ${c.action}` : ""
        }`
    )
    .join("\n");
  const incidents = INCIDENTS.slice(0, 8)
    .map(
      (i) =>
        `- ${i.ref} [${i.status}] (${i.service}) "${i.title}" — ${
          i.location.suburb ?? i.location.city
        }, severity ${i.severity}`
    )
    .join("\n");
  const services = Object.entries(SERVICES)
    .map(([key, s]) => `${key}: ${s.label}`)
    .join("; ");

  return [
    `User location: ${location?.suburb ?? "Melrose"}, ${location?.city ?? "Johannesburg"}, ${location?.province ?? "Gauteng"}, South Africa.`,
    "",
    "The user's SASI cases (demo data):",
    cases,
    "",
    "Incidents SASI is tracking nearby (demo data):",
    incidents,
    "",
    `Service directory keys: ${services}.`,
  ].join("\n");
}

const SYSTEM_PROMPT = (context: string) => `You are SASI's briefing editor — the South African Civic Intelligence Platform. Write a short "City briefing" digest for one resident, grounded ONLY in the demo dataset below.

Reply with STRICT JSON only (no markdown fences, no prose):
{
  "headline": "one sharp sentence (≤ 110 chars) summarising today's civic picture for the resident",
  "risk": "CALM|ELEVATED|STRAINED|CRITICAL",
  "sections": [
    { "title": "Service name (e.g. Water)", "body": "2-3 short lines. Use '- ' bullets and **bold** key phrases. Mention specific refs where relevant.", "refs": ["CASE-000123"] }
  ],
  "watchlist": ["1-3 short forward-looking items (≤ 90 chars each) the resident should keep an eye on"]
}

RULES
- 2-4 sections, ordered by relevance to THIS resident (their own cases first).
- GROUNDING IS ABSOLUTE: every factual statement must be traceable to a line in the dataset (a case status, a case title, an incident title/severity, a proposed-action state). Do NOT invent amounts, account numbers, dates, schedules, announcements or statistics. If the dataset only says "[INVESTIGATING] (water) \\"No water since yesterday evening\\"", say exactly that and no more.
- Only reference refs (CASE-xxxxxx / INC-xxxx) that appear in the dataset lines.
- South African civic voice: plain, practical, calm. Mention load-shedding / water-shedding only if supported by the data.
- risk: CALM = nothing needs attention; ELEVATED = the resident has open work; STRAINED = multiple active problems or an approval waiting; CRITICAL = reserve for genuine danger.
- watchlist items must be concrete and derived from the dataset (e.g. "Approval on CASE-000123 is waiting for you", not "stay informed").
- The briefing is independent and unarmed: SASI never claims to have contacted any authority.`;

/* ---------- chat-digest mode: the conversation is the source material ---------- */

function transcriptBlock(
  transcript: NonNullable<BriefingBody["transcript"]>
): string {
  return transcript
    .slice(-12)
    .map((m) => `${m.role === "user" ? "RESIDENT" : "SASI"}: ${m.content.slice(0, 600)}`)
    .join("\n\n");
}

const CHAT_SYSTEM_PROMPT = (context: string) => `You are SASI's briefing editor — the South African Civic Intelligence Platform. The resident just had an assistance conversation with SASI's chat. Distil THAT CONVERSATION into a short "City briefing" card so the resident can pin a summary of it on their dashboard.

Reply with STRICT JSON only (no markdown fences, no prose):
{
  "headline": "one sharp sentence (≤ 110 chars) capturing what the conversation established for the resident",
  "risk": "CALM|ELEVATED|STRAINED|CRITICAL",
  "sections": [
    { "title": "Topic (e.g. Water)", "body": "2-3 short lines. Use '- ' bullets and **bold** key phrases. Mention specific refs where relevant.", "refs": ["CASE-000123"] }
  ],
  "watchlist": ["1-3 short forward-looking items (≤ 90 chars each) drawn from the conversation's advice"]
}

RULES
- GROUNDING IS ABSOLUTE: every statement must come from the conversation transcript (or the supporting dataset below). Do NOT invent schedules, amounts, dates or announcements.
- Only reference refs (CASE-xxxxxx / INC-xxxx) that actually appear in the transcript or dataset.
- If the chat was about one issue, write 1-2 focused sections — do not pad to four.
- South African civic voice: plain, practical, calm.
- The briefing is independent and unarmed: SASI never claims to have contacted any authority.
- If the conversation was vague, say what is known and what the resident still needs to confirm — honestly.

CONVERSATION TRANSCRIPT:
${context}`;

function extractBriefing(
  raw: string,
  locationLabel: string
): CityBriefing | null {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as {
      headline?: unknown;
      risk?: unknown;
      sections?: unknown;
      watchlist?: unknown;
    };
    if (typeof obj.headline !== "string" || !obj.headline.trim()) return null;

    const risk = RISKS.includes(String(obj.risk).toUpperCase() as BriefingRisk)
      ? (String(obj.risk).toUpperCase() as BriefingRisk)
      : "ELEVATED";

    const rawSections = Array.isArray(obj.sections) ? obj.sections : [];
    const sections: BriefingSection[] = rawSections
      .slice(0, 4)
      .map((s) => {
        const sec = s as { title?: unknown; body?: unknown; refs?: unknown };
        const body = typeof sec.body === "string" ? sec.body.slice(0, 600) : "";
        const refSource = Array.isArray(sec.refs)
          ? (sec.refs as unknown[]).filter((r): r is string => typeof r === "string").join(" ")
          : body;
        return {
          title: String(sec.title ?? "Update").slice(0, 40),
          body,
          refs: Array.from(new Set(refSource.match(REF_RE) ?? [])).slice(0, 4),
        };
      })
      .filter((s) => s.body.trim().length > 0);

    if (sections.length === 0) return null;

    const watchlist = Array.isArray(obj.watchlist)
      ? (obj.watchlist as unknown[])
          .filter((w): w is string => typeof w === "string" && w.trim().length > 0)
          .slice(0, 3)
          .map((w) => w.slice(0, 120))
      : [];

    return {
      headline: obj.headline.trim().slice(0, 140),
      risk,
      sections,
      watchlist,
      generatedAt: new Date().toISOString(),
      locationLabel,
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: BriefingBody;
  try {
    body = (await req.json()) as BriefingBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const loc = body.location ?? {};
  const locationLabel = [
    loc.suburb ?? "Melrose",
    loc.city ?? "Johannesburg",
    loc.province ?? "Gauteng",
  ]
    .filter(Boolean)
    .join(", ");

  try {
    const zai = await ZAI.create();

    /* chat-digest mode: distil the conversation instead of the city dataset */
    const isChat =
      body.origin === "chat" &&
      Array.isArray(body.transcript) &&
      body.transcript.length >= 2;

    const completion = (await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content: isChat
            ? CHAT_SYSTEM_PROMPT(transcriptBlock(body.transcript ?? []))
            : SYSTEM_PROMPT(compactContext(loc, body.extraCases)),
        },
        {
          role: "user",
          content: isChat
            ? `USER LOCATION: ${locationLabel}\n\nDistil the conversation above into the briefing JSON now. Reply with the JSON object only.`
            : `USER LOCATION: ${locationLabel}\n\nWrite today's briefing now. Reply with the JSON object only.`,
        },
      ],
      thinking: { type: "disabled" },
    })) as { choices?: { message?: { content?: string } }[] };

    const raw = completion.choices?.[0]?.message?.content ?? "";
    const briefing = extractBriefing(raw, locationLabel);
    if (!briefing) {
      return NextResponse.json(
        { error: "SASI drafted the briefing but could not structure it. Please try again." },
        { status: 502 }
      );
    }
    if (isChat) briefing.origin = "chat";
    return NextResponse.json({ briefing });
  } catch (err) {
    console.error("[/api/sasi/briefing] failed:", err);
    return NextResponse.json(
      { error: "SASI could not write the briefing just now. Please try again in a moment." },
      { status: 502 }
    );
  }
}
