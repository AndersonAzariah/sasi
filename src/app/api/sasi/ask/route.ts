import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { SERVICES } from "@/lib/sasi/utils";
import type { ChatRole } from "@/lib/sasi/types";
import { aiHttpStatus, getAIProvider } from "@/lib/ai";
import { buildAskSystemPrompt } from "@/lib/ai/prompts";
import {
  clientIp,
  rateLimitService,
  tooManyRequests,
} from "@/lib/sasi/api-auth";
import {
  corroborateStructured,
  extractJsonBlock,
  journeyFocusBlock,
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

/* the prompt text lives in src/lib/ai/prompts.ts — centralized for
   every AI feature (Task 29 §9); the builders here only fold in the
   per-request registry/context blocks */
function makeSystemPrompt(
  context: string,
  registryBlock: string,
  contextBlock: string,
  focusBlock: string | null
): string {
  return buildAskSystemPrompt({ context, registryBlock, contextBlock, focusBlock });
}

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
  systemPrompt: string,
  msgs: { role: ChatRole; content: string }[]
): Promise<AskResult> {
  const provider = getAIProvider();
  /* the provider abstraction speaks proper roles — the system prompt
     goes in as "system" (the z-ai quirk that mapped it to "assistant"
     retired with the SDK swap) */
  const completion = await provider.complete({
    messages: [
      { role: "system", content: systemPrompt },
      ...msgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ],
  });
  const modelRaw = completion.text.trim();

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

  /* ownership: the account identity comes from the authenticated
     session server-side — never from anything the client sends */
  let userId: string | null = null;
  try {
    userId = (await getAuthSession())?.user?.id ?? null;
  } catch { userId = null; }

  /* COST CONTROL (Task 30) — tiered rate limit on the primary AI spend
     vector. Signed-in residents get a wider budget than anonymous
     callers (identified only by their best-effort IP); both are
     bounded so one user cannot run up the provider bill. */
  const askLimit = await rateLimitService.limit(
    `ask:${userId ?? `anon:${clientIp(req)}`}`,
    userId ? 20 : 8,
    60_000
  );
  if (!askLimit.allowed) {
    return tooManyRequests(
      askLimit.retryAfterMs,
      "SASI is receiving too many requests right now. Please try again."
    );
  }

  /* Phase 10 — the resident's current view context. An explicit
     body.context wins (future store versions); today the Ask SASI view
     publishes the same data in a short-lived sasi_ctx cookie that the
     same-origin fetch attaches automatically. */
  const context =
    sanitizeViewContext(body.context) ?? readContextFromCookieHeader(req.headers.get("cookie"));
  const contextBlock = buildContextBlock(context);
  /* Contextual grounding (Task 30): the resident's CURRENT page decides
     which registry data is injected in full — the passport service page
     grounds "what documents do I need?", the passport journey grounds
     "what do I do now?". Unknown params return null honestly. */
  const focusBlock =
    context?.view === "service-detail" && context.param
      ? serviceDetailBlock(context.param)
      : context?.view === "journey" && context.param
        ? journeyFocusBlock(context.param)
        : null;

  /* Persist the user's message before answering (best-effort). */
  if (sessionId) {
    try {
      await db.chatMessage.create({
        data: { sessionId, userId, role: "user", content: lastUser.content.slice(0, 4000) },
      });
    } catch (err) {
      console.error("[/api/sasi/ask] user message persist failed:", err);
    }
  }

  const wantStream = body.stream !== false;

  try {
    const systemPrompt = makeSystemPrompt(
      compactContext(body.cases ?? [], body.location),
      registryGroundingBlock(),
      contextBlock,
      focusBlock
    );

    const { reply, structured } = await runAsk(systemPrompt, msgs);
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
              userId,
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
                  userId,
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
    console.error("[/api/sasi/ask] assistant failed:", err instanceof Error ? err.message : err);
    const http = aiHttpStatus(err, "SASI could not reach the assistant service. Please try again in a moment.");
    return NextResponse.json(
      { error: http.message, code: http.code },
      { status: http.status }
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
