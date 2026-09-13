import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import { SERVICES } from "@/lib/sasi/utils";
import type { ChatRole } from "@/lib/sasi/types";
import {
  corroborateStructured,
  extractJsonBlock,
  registryGroundingBlock,
  serviceDetailBlock,
  validateStructuredAnswer,
  type StructuredAnswer,
} from "@/lib/sasi/civic-ai";
import {
  buildContextBlock,
  readContextFromCookieHeader,
  sanitizeViewContext,
} from "@/lib/sasi/context-metadata";

/* ============================================================
   POST /api/sasi/ask
   Free-text "Ask SASI" assistant. Backend-only — the z-ai SDK
   is never imported from client code. The system prompt injects
   the user's live session context (their REAL cases sent from the
   client + saved location) so answers stay grounded in what
   SASI actually knows.

   Phase 6 (Task 28-b) — STRUCTURED ANSWERS:
   The model is asked for ONE strict JSON object:
     { answer, whatYouNeed?, nextStep?, service?, journey?,
       officialSource?, related? }
   The payload is validated server-side (unknown fields stripped,
   every value capped and typed) and corroborated against the
   SERVICE REGISTRY — invented slugs/journeys are dropped and an
   officialSource survives only when the registry verifies it or
   the host is a certain gov.za domain. If the model returns
   anything unparseable, the route falls back to the legacy
   plain-text answer — the endpoint NEVER breaks and the legacy
   client shape still works.

   PERSISTENCE TRADEOFF (deliberate, Task 28-b): the assistant row
   stores the PLAIN human-readable answer only, so chat history
   replay stays readable everywhere it is rendered. The validated
   `structured` object is LIVE-ONLY: it is returned on the wire
   (SSE `done` event for forward-compatible clients + the JSON
   fallback body) and additionally exposed through the GET
   side-channel below, because the current store implementation
   (owned elsewhere) drops unknown SSE fields. History replay
   therefore shows plain text — accepted and documented.

   Streaming: when body.stream is true the reply is delivered as
   Server-Sent Events (text/event-stream) — unchanged contract:
     data: {"type":"delta","text":"…"}     — incremental text
     data: {"type":"done","refs":[…],"suggestReport":true,
            "structured":{…}}              — structured added in 28-b
     data: {"type":"error","message":"…"}
   Because the model now emits one JSON object, the route requests
   a non-streaming completion and streams the validated `answer`
   to the client in small synthesised chunks — the wire protocol,
   persistence and error handling are identical to before; only
   the pacing differs (see the honest tradeoff note in the worklog).
   Both user message and final assistant reply are persisted per
   anonymous sessionId so the chat survives reloads.

   GET /api/sasi/ask?sessionId=…&structured=last   (Phase 6/7 helper)
   Returns the most recent VALIDATED structured answer produced in
   this session: { structured, answerPrefix, createdAt } — with
   structured: null when the last answer was plain text or the
   entry expired. The chat view correlates it against the just-
   finished message via answerPrefix before rendering actions, so
   a stale hit degrades to the plain answer honestly.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AskCase {
  ref?: string;
  title?: string;
  status?: string;
  service?: string;
  city?: string;
  aiState?: string;
}

interface AskBody {
  messages?: { role: ChatRole; content: string }[];
  /** convenience for one-shot callers: `{"message":"How do I…"}` */
  message?: string;
  location?: { province?: string; city?: string; suburb?: string };
  /** the resident's REAL live cases, sent from the client store */
  cases?: AskCase[];
  sessionId?: string;
  stream?: boolean;
  /** Phase 10 — where the resident is (validated before use) */
  context?: unknown;
}

const REF_RE = /(CASE-\d{6}|INC-\d{4})/g;

/** Does this reply read like "you should file a report"? (drives the chat→report chip) */
function suggestsReport(reply: string): boolean {
  const reportish = /\b(report|reports|reporting|file|log|submit)\w*\b/i.test(reply);
  const actionable =
    /\b(want to|would you like|shall i|should i|can i|i can|you can|let'?s|start|begin|draft|create|open|prepare|next step|how do i|report this|report it|report a|report an|new report)\b/i.test(
      reply
    );
  return reportish && actionable;
}

const str = (v: unknown, cap: number): string =>
  typeof v === "string" ? v.trim().slice(0, cap) : "";

function compactContext(rawCases: AskCase[], location: AskBody["location"]): string {
  /* server-sanitized projection of the resident's live cases — no static
     dataset exists, so the context holds only what the resident created */
  const cases = (Array.isArray(rawCases) ? rawCases : [])
    .slice(0, 12)
    .map((c) => {
      const ref = str(c?.ref, 16);
      const title = str(c?.title, 90);
      if (!ref || !title) return null;
      const status = str(c?.status, 32) || "UNKNOWN";
      const service = str(c?.service, 24);
      const city = str(c?.city, 48);
      const ai = str(c?.aiState, 32);
      return `- ${ref} [${status}] "${title}"${service ? ` — ${service}` : ""}${
        city ? `, ${city}` : ""
      }${ai ? ` (AI: ${ai})` : ""}`;
    })
    .filter((line): line is string => line !== null)
    .join("\n");
  const services = Object.entries(SERVICES)
    .map(([key, s]) => `${key}: ${s.label}`)
    .join("; ");

  return [
    `User location: ${location?.suburb ?? "Melrose"}, ${location?.city ?? "Johannesburg"}, ${location?.province ?? "Gauteng"}, South Africa.`,
    "",
    cases
      ? "The resident's real SASI cases (live data, created by them — reference only these refs):"
      : "The resident has not created any cases yet — never invent case references.",
    cases || "(none yet)",
    "",
    `Service directory keys: ${services}.`,
  ].join("\n");
}

const TRUST_RULES = `VOICE
- Warm, practical, direct. Plain English with South African context (municipalities, wards, Eskom, Joburg Water, COJ, load-shedding, water-shedding).
- Short paragraphs or tight bullet lists. Bold the key phrase of each bullet. Never exceed ~160 words unless the user asks for detail.
- Never lecture. Never repeat the question back.

INDEPENDENCE AND TRUST RULES (non-negotiable)
- You are an independent platform, NOT a government body and NOT an emergency service. For life-threatening emergencies, tell the user to call 10111 (police) or 10177 (ambulance) immediately.
- You never claim to have contacted, notified, or filed anything with any authority. SASI only drafts actions and the user explicitly approves each one before it is submitted.
- Never fabricate official confirmations, reference numbers, or outcomes. If you reference the user's cases below, use only the refs and statuses listed. Any claim you cannot verify from the context or general public knowledge should be labelled as something SASI would verify (e.g. "worth confirming with the utility").
- SASI's own reminders, saved items and cases are NOT official government communications — never describe them as official notices, and never imply a government body sent them.
- When a user's message reads like a new service problem, offer to start a structured report ("Report an issue") or an investigation — those flows exist in this app.

HONESTY RULES FOR STRUCTURED FIELDS (non-negotiable)
- Only reference services or journeys that exist in the SERVICE REGISTRY / FOCUS SERVICE blocks below. Never invent slugs, journeyIds or titles.
- Never invent dates, deadlines, fees, reference numbers, or requirements. Requirements you give must be general public knowledge or come from the registry/context — if you are not sure, say so in answer.
- officialSource: include it ONLY when you are certain of the real official URL (a gov.za domain you know). When unsure, OMIT the whole field — a missing source is honest, a wrong one is fabrication.
- If you are unsure about anything material, say so plainly inside answer. Honesty beats completeness.`;

const OUTPUT_CONTRACT = `OUTPUT FORMAT (strict — this is a machine contract)
Reply with ONE JSON object and nothing else: no markdown fences, no prose before or after it. Shape:
{
  "answer": "your full reply in the SASI voice (markdown-lite: **bold**, '- ' bullets, '## ' headings). The resident only ever reads this field.",
  "whatYouNeed": ["optional — documents/info the resident must have, one short item each; omit when not applicable"],
  "nextStep": "optional — the single most useful next action, one sentence; omit when not applicable",
  "service": { "slug": "<slug from the SERVICE REGISTRY below>", "title": "<its exact registry title>" },
  "journey": { "journeyId": "<journeyId from the registry>", "title": "<the registry title>" },
  "officialSource": { "org": "publishing organisation", "url": "https://…" },
  "related": ["optional — up to 3 short related topics worth asking next"]
}
- Omit optional fields entirely when they do not apply (small talk, case-status chats, vague questions → answer only).
- The JSON must be valid: escape quotes and newlines inside strings.`;

const SYSTEM_PROMPT = (context: string, registryBlock: string, contextBlock: string, focusBlock: string | null) =>
  `You are SASI — the South African Service Intelligence assistant. You help South African residents understand and resolve everyday civic service problems (water, electricity, roads, waste, healthcare, education, housing, documents, safety, local government).

${TRUST_RULES}

${OUTPUT_CONTRACT}

${registryBlock}

${focusBlock ? `${focusBlock}\n\n` : ""}USER CONTEXT (the resident's real, live data — reference only the refs listed)
${context}

If the user asks what you can do: investigate civic problems across official + public sources, correlate with the user's own evidence and photos, draft findings with confidence levels, and prepare an approved-only service report to the relevant authority.${
    contextBlock ? `\n\n${contextBlock}` : ""
  }`;

function cleanSession(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  return s.length > 0 && s.length <= 128 ? s : null;
}

/* ---------- SSE helpers (unchanged wire contract) ---------- */

function sseChunk(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Split a finished answer into small natural chunks for the SSE
 * synthesis. Whitespace-preserving so the client-side concatenation
 * equals the persisted plain answer byte for byte. Bounded to ~220
 * chunks so the tail never lags behind the model latency.
 */
function chunkAnswer(text: string): string[] {
  const words = text.split(/(\s+)/);
  const raw: string[] = [];
  let cur = "";
  for (const w of words) {
    cur += w;
    if (cur.length >= 26 && w.trim()) {
      raw.push(cur);
      cur = "";
    }
  }
  if (cur.trim()) raw.push(cur);
  if (raw.length <= 220) return raw;
  const per = Math.ceil(raw.length / 220);
  const merged: string[] = [];
  for (let i = 0; i < raw.length; i += per) {
    merged.push(raw.slice(i, i + per).join(""));
  }
  return merged;
}

/* ------------------------------------------------------------
   Live-only structured cache (GET side-channel).
   Keyed by anonymous sessionId; small, TTL-bounded, best-effort.
   ------------------------------------------------------------ */

interface StructuredCacheEntry {
  structured: StructuredAnswer | null;
  /** first N chars of the persisted plain answer — lets the client
      verify it is attaching structure to the RIGHT message */
  answerPrefix: string;
  createdAt: number;
}

const STRUCTURED_TTL_MS = 10 * 60 * 1000;
const STRUCTURED_CACHE_MAX = 50;
const structuredCache = new Map<string, StructuredCacheEntry>();
const ANSWER_PREFIX_LEN = 120;

function rememberStructured(
  sessionId: string | null,
  structured: StructuredAnswer | null,
  plainAnswer: string
): void {
  if (!sessionId) return;
  structuredCache.set(sessionId, {
    structured,
    answerPrefix: plainAnswer.slice(0, ANSWER_PREFIX_LEN),
    createdAt: Date.now(),
  });
  if (structuredCache.size > STRUCTURED_CACHE_MAX) {
    /* evict the oldest entry — this cache is a courtesy, not a store */
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [k, v] of structuredCache) {
      if (v.createdAt < oldestAt) {
        oldestAt = v.createdAt;
        oldestKey = k;
      }
    }
    if (oldestKey) structuredCache.delete(oldestKey);
  }
}

/* ------------------------------------------------------------
   Model call + validation. Returns the plain answer (what gets
   persisted and streamed) plus the validated structured payload
   (null when the model did not produce an honest JSON answer).
   ------------------------------------------------------------ */

interface AskResult {
  reply: string;
  structured: StructuredAnswer | null;
  modelRaw: string;
}

async function runAsk(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  systemPrompt: string,
  msgs: { role: ChatRole; content: string }[]
): Promise<AskResult> {
  const completion = (await zai.chat.completions.create({
    messages: [{ role: "assistant" as const, content: systemPrompt }, ...msgs],
    thinking: { type: "disabled" as const },
  })) as {
    choices?: { message?: { content?: string } }[];
  };
  const modelRaw = completion.choices?.[0]?.message?.content?.trim() ?? "";

  const parsed = extractJsonBlock(modelRaw);
  const validated = parsed ? validateStructuredAnswer(parsed) : null;
  if (validated) {
    /* honesty hardening against the registry before anything reaches
       the client — the model's pointers are never trusted blindly */
    return { reply: validated.answer, structured: corroborateStructured(validated), modelRaw };
  }
  /* legacy fallback: the model answered in plain prose (or produced
     unusable JSON) — serve it as the plain-text answer so the endpoint
     never breaks and history stays readable */
  return { reply: modelRaw, structured: null, modelRaw };
}

/* ------------------------------------------------------------ */

export async function POST(req: Request) {
  let body: AskBody;
  try {
    body = (await req.json()) as AskBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const msgs = (body.messages ?? [])
    .filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-10);

  /* one-shot convenience: {"message": "How do I replace my ID?"} */
  if (msgs.length === 0 && typeof body.message === "string" && body.message.trim()) {
    msgs.push({ role: "user", content: body.message.trim().slice(0, 4000) });
  }

  if (msgs.length === 0 || msgs[msgs.length - 1].role !== "user") {
    return NextResponse.json({ error: "A question is required." }, { status: 400 });
  }

  const sessionId = cleanSession(body.sessionId);
  const lastUser = msgs[msgs.length - 1];

  /* Phase 10 — the resident's current view context. An explicit
     body.context wins (future store versions); today the Ask SASI view
     publishes the same data in a short-lived sasi_ctx cookie that the
     same-origin fetch attaches automatically. */
  const context =
    sanitizeViewContext(body.context) ?? readContextFromCookieHeader(req.headers.get("cookie"));
  const contextBlock = buildContextBlock(context);
  const focusBlock =
    context?.view === "service-detail" && context.param
      ? serviceDetailBlock(context.param)
      : null;

  /* Persist the user's message before answering (best-effort). */
  if (sessionId) {
    try {
      await db.chatMessage.create({
        data: { sessionId, role: "user", content: lastUser.content.slice(0, 4000) },
      });
    } catch (err) {
      console.error("[/api/sasi/ask] user message persist failed:", err);
    }
  }

  const wantStream = body.stream !== false;

  try {
    const zai = await ZAI.create();
    const systemPrompt = SYSTEM_PROMPT(
      compactContext(body.cases ?? [], body.location),
      registryGroundingBlock(),
      contextBlock,
      focusBlock
    );

    const { reply, structured } = await runAsk(zai, systemPrompt, msgs);
    if (!reply) {
      return NextResponse.json(
        { error: "SASI could not answer right now. Please try again." },
        { status: 502 }
      );
    }

    const refs = Array.from(new Set(reply.match(REF_RE) ?? []));
    const suggestReport = suggestsReport(reply);

    /* ---------------- Non-streaming (fallback / legacy) ---------------- */
    if (!wantStream) {
      if (sessionId) {
        try {
          await db.chatMessage.create({
            data: {
              sessionId,
              role: "assistant",
              content: reply.slice(0, 8000),
              refs: refs.length ? JSON.stringify(refs) : null,
            },
          });
        } catch (err) {
          console.error("[/api/sasi/ask] assistant persist failed:", err);
        }
      }
      /* live-only structured payload — see the persistence tradeoff note */
      rememberStructured(sessionId, structured, reply);
      return NextResponse.json({
        message: reply,
        reply, /* legacy alias — older clients read this */
        refs,
        suggestReport,
        structured,
      });
    }

    /* ---------------- Streaming (SSE, synthesised) ----------------
       The model emitted one JSON object, so the validated `answer`
       is streamed to the client in small chunks — the wire events
       are byte-compatible with the previous token stream. */
    let closed = false;

    const sse = new ReadableStream<Uint8Array>({
      async start(controller) {
        const push = (obj: Record<string, unknown>) => {
          if (closed) return;
          try {
            controller.enqueue(sseChunk(obj));
          } catch {
            /* client aborted / controller already closed — stop pushing */
            closed = true;
          }
        };
        try {
          for (const chunk of chunkAnswer(reply)) {
            if (closed) break;
            push({ type: "delta", text: chunk });
            await sleep(12);
          }

          if (!closed) {
            push({ type: "done", refs, suggestReport, structured });
            closed = true;
            controller.close();
          }

          /* Persist the assistant reply after the stream completes (best-effort).
             PERSISTED CONTENT STAYS PLAIN — history replay shows plain text;
             `structured` travels live-only (see the tradeoff note above). */
          if (sessionId) {
            try {
              await db.chatMessage.create({
                data: {
                  sessionId,
                  role: "assistant",
                  content: reply.slice(0, 8000),
                  refs: refs.length ? JSON.stringify(refs) : null,
                },
              });
            } catch (err) {
              console.error("[/api/sasi/ask] assistant persist failed:", err);
            }
          }
          rememberStructured(sessionId, structured, reply);
        } catch (err) {
          console.error("[/api/sasi/ask] stream failed:", err);
          push({
            type: "error",
            message: "SASI could not reach the assistant service. Please try again in a moment.",
          });
          closed = true;
          controller.close();
        }
      },
      cancel() {
        closed = true;
      },
    });

    return new Response(sse, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[/api/sasi/ask] assistant failed:", err);
    return NextResponse.json(
      { error: "SASI could not reach the assistant service. Please try again in a moment." },
      { status: 502 }
    );
  }
}

/* ------------------------------------------------------------
   GET — live-only structured side-channel (Phase 6/7).
   The chat view fetches this right after an answer completes and
   correlates it via answerPrefix; a stale or missing entry simply
   degrades to the plain answer (honest, no fabricated structure).
   ------------------------------------------------------------ */

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("structured") !== "last") {
    return NextResponse.json({ error: "Unsupported query." }, { status: 400 });
  }
  const sessionId = cleanSession(url.searchParams.get("sessionId"));
  const entry = sessionId ? structuredCache.get(sessionId) : undefined;
  if (!entry || Date.now() - entry.createdAt > STRUCTURED_TTL_MS) {
    return NextResponse.json({ structured: null });
  }
  return NextResponse.json({
    structured: entry.structured,
    answerPrefix: entry.answerPrefix,
    createdAt: entry.createdAt,
  });
}
