import { NextResponse } from "next/server";
import { SERVICES } from "@/lib/sasi/utils";
import {
  clientIp,
  rateLimitService,
  tooManyRequests,
} from "@/lib/sasi/api-auth";
import { aiHttpStatus, getAIProvider } from "@/lib/ai";
import {
  buildBriefingCityPrompt,
  buildBriefingChatPrompt,
} from "@/lib/ai/prompts";
import type { BriefingRisk, BriefingSection, CityBriefing } from "@/lib/sasi/types";

/* ============================================================
   POST /api/sasi/briefing
   AI "City briefing" — a short digest written by the LLM from
   the RESIDENT'S OWN MATERIAL ONLY: the cases they created via
   the report flow (passed in as extraCases) or, in chat mode,
   the transcript of their own Ask SASI conversation. There is
   no pre-existing dataset to ground against — if the request
   carries no user material, the route returns an honest
   "nothing to brief yet" response instead of inventing one.

   Backend-only — the z-ai SDK is never imported from client code.

   Returns STRICT JSON on success:
     { briefing: { headline, risk, sections: [{title, body, refs[]}],
       watchlist: [], generatedAt, locationLabel } }
   Honest no-material response (HTTP 200, contract-stable for the
   client store which treats a missing briefing as non-fatal):
     { ok: false, empty: true, briefing: null, error: "…" }
   Two modes:
   - default (city): digest grounded in the resident's own cases
   - origin:"chat": distils the Ask SASI transcript passed by the
     client into the same briefing shape (chat → dashboard loop)
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BriefingBody {
  location?: { province?: string; city?: string; suburb?: string };
  /** the user's own cases from the live client store — the ONLY grounding */
  extraCases?: {
    ref: string;
    title: string;
    status: string;
    service: string;
    city?: string;
    actionState?: string;
  }[];
  /** when "chat", `transcript` is the source material instead of the cases */
  origin?: "city" | "chat";
  /** Ask SASI conversation (done messages, ≤ 12) to distil into a briefing */
  transcript?: { role: "user" | "assistant"; content: string }[];
}

const REF_RE = /(CASE-\d{6}|INC-\d{4})/g;

const RISKS: BriefingRisk[] = ["CALM", "ELEVATED", "STRAINED", "CRITICAL"];

/** the honest no-material response — success-shaped HTTP 200 with an
    explicit empty flag so the client can render its empty state */
function noMaterialResponse(origin: "city" | "chat") {
  const why =
    origin === "chat"
      ? "There isn't enough conversation to distil yet. Ask SASI something first, then try again."
      : "There's nothing to brief yet — your briefing is written from your own reports and cases. Report an issue or start an investigation, and SASI will brief you on it.";
  return NextResponse.json(
    { ok: false, empty: true, briefing: null, error: why },
    { status: 200 }
  );
}

/** compact, honest context: ONLY the resident's own cases, exactly as
    the client reports them — no dataset is merged in */
function compactContext(
  location: BriefingBody["location"],
  extraCases: BriefingBody["extraCases"]
): { context: string; allowedRefs: Set<string> } {
  const seen = new Set<string>();
  const allowedRefs = new Set<string>();
  const cases = (extraCases ?? [])
    .filter((c) => {
      if (seen.has(c.ref) || !c.ref) return false;
      seen.add(c.ref);
      allowedRefs.add(c.ref.toUpperCase());
      return true;
    })
    .slice(0, 12)
    .map(
      (c) =>
        `- ${c.ref} [${c.status}] (${c.service}) "${c.title}" — ${
          c.city || location?.city || "location not set"
        }${c.actionState ? ` · action: ${c.actionState}` : ""}`
    )
    .join("\n");

  const services = Object.entries(SERVICES)
    .map(([key, s]) => `${key}: ${s.label}`)
    .join("; ");

  const context = [
    `Resident location: ${
      [location?.suburb, location?.city, location?.province]
        .filter(Boolean)
        .join(", ") || "not set"
    }, South Africa.`,
    "",
    `The resident's own SASI cases (the ONLY material you may use — EXACTLY ${allowedRefs.size} case(s), listed verbatim; nothing else about them exists):`,
    cases,
    "",
    `Service directory keys (for naming services only, not facts): ${services}.`,
  ].join("\n");

  return { context, allowedRefs };
}

const SYSTEM_PROMPT = buildBriefingCityPrompt;

/* ---------- chat-digest mode: the conversation is the source material ---------- */

function transcriptBlock(
  transcript: NonNullable<BriefingBody["transcript"]>
): string {
  return transcript
    .slice(-12)
    .map((m) => `${m.role === "user" ? "RESIDENT" : "SASI"}: ${m.content.slice(0, 600)}`)
    .join("\n\n");
}

const CHAT_SYSTEM_PROMPT = buildBriefingChatPrompt;

/** refs mentioned anywhere in a text blob */
function refsIn(text: string): string[] {
  return Array.from(new Set(text.match(REF_RE) ?? []).values());
}

/** year/date-like pattern — city-mode material contains NO dates, so any
    match is model fabrication (relative time like "yesterday" is fine) */
const FABRICATED_DATE_RE = /\b(19|20)\d{2}[-/]\d{1,2}[-/]\d{1,2}\b|\b(19|20)\d{2}\b/;

/** HARD GROUNDING VALIDATION — drop anything citing a ref the resident
    does not actually have. The model must never be trusted blindly:
    a fabricated CASE-xxxxxx in a briefing is a fabricated result.
    strict (city mode): every section must cite ≥1 real ref and no
    date-like strings may appear anywhere (the material has none). */
function enforceGrounding(
  briefing: CityBriefing,
  allowedRefs: Set<string>,
  strict = false
): CityBriefing | null {
  const known = (ref: string) => allowedRefs.has(ref.toUpperCase());

  if (refsIn(briefing.headline).some((r) => !known(r))) return null;

  const sections = briefing.sections.filter((sec) => {
    const cited = [...sec.refs, ...refsIn(sec.body)];
    /* every cited ref must be real; in strict mode the section must
       actually be anchored to ≥1 of the resident's real cases */
    if (!cited.every(known)) return false;
    return strict ? cited.length > 0 : true;
  });
  if (sections.length === 0) return null;

  const watchlist = briefing.watchlist.filter(
    (w) => refsIn(w).every(known)
  );

  const next = { ...briefing, sections, watchlist };

  if (strict) {
    if (FABRICATED_DATE_RE.test(next.headline)) return null;
    if (next.sections.some((s) => FABRICATED_DATE_RE.test(`${s.title} ${s.body}`)))
      return null;
    if (next.watchlist.some((w) => FABRICATED_DATE_RE.test(w))) return null;
  }

  return next;
}

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
  /* AI cost bound: each call spends LLM tokens. 20/min per caller is
     far above any legitimate dashboard/chat cadence. */
  const limit = await rateLimitService.limit(
    `briefing:${clientIp(req)}`,
    20,
    60_000
  );
  if (!limit.allowed) {
    return tooManyRequests(
      limit.retryAfterMs,
      "Too many briefing requests in a minute. Please wait a moment."
    );
  }
  /* The transcript/cases arrive as JSON — refuse absurd bodies before
     they are parsed and processed. */
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 500_000) {
    return NextResponse.json(
      { error: "That briefing request is too large." },
      { status: 413 }
    );
  }

  let body: BriefingBody;
  try {
    body = (await req.json()) as BriefingBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const loc = body.location ?? {};
  const locationLabel = [loc.suburb, loc.city, loc.province]
    .filter(Boolean)
    .join(", ");

  try {
    const provider = getAIProvider();

    /* HONESTY GATE — no user material, no briefing. The route never
       invents a digest from a dataset, because no dataset exists. */
    const residentCases = (body.extraCases ?? []).filter((c) => c.ref);
    const isChat =
      body.origin === "chat" &&
      Array.isArray(body.transcript) &&
      body.transcript.length >= 2;

    const allowedRefs = new Set<string>(
      isChat
        ? (body.transcript ?? []).flatMap((m) => refsIn(m.content))
        : residentCases.map((c) => c.ref)
    );

    if (isChat) {
      const chars = (body.transcript ?? []).reduce(
        (n, m) => n + (m.content?.trim().length ?? 0),
        0
      );
      if (chars < 40) return noMaterialResponse("chat");
    } else if (residentCases.length === 0) {
      return noMaterialResponse("city");
    }

    const completion = await provider.complete({
      messages: [
        {
          role: "system",
          content: isChat
            ? CHAT_SYSTEM_PROMPT(transcriptBlock(body.transcript ?? []))
            : SYSTEM_PROMPT(compactContext(loc, residentCases).context),
        },
        {
          role: "user",
          content: isChat
            ? `RESIDENT LOCATION: ${locationLabel || "not set"}\n\nDistil the conversation above into the briefing JSON now. Reply with the JSON object only.`
            : `RESIDENT LOCATION: ${locationLabel || "not set"}\n\nWrite the resident's briefing from their own cases now. Reply with the JSON object only.`,
        },
      ],
    });

    const raw = completion.text;
    const extracted = extractBriefing(raw, locationLabel);
    if (!extracted) {
      return NextResponse.json(
        { error: "SASI drafted the briefing but could not structure it. Please try again." },
        { status: 502 }
      );
    }
    /* drop anything citing refs the resident does not have — fabrication
       is rejected, never shown. City mode is strict: sections must be
       anchored to real cases and dates cannot appear (material has none). */
    const briefing = enforceGrounding(extracted, allowedRefs, !isChat);
    if (!briefing) {
      return NextResponse.json(
        { error: "SASI's draft cited material you don't have, so it was discarded. Please try again." },
        { status: 502 }
      );
    }
    if (isChat) briefing.origin = "chat";
    return NextResponse.json({ briefing });
  } catch (err) {
    console.error("[/api/sasi/briefing] failed:", err instanceof Error ? err.message : err);
    const http = aiHttpStatus(err, "SASI could not write the briefing just now. Please try again in a moment.");
    return NextResponse.json(
      { error: http.message, code: http.code },
      { status: http.status }
    );
  }
}
