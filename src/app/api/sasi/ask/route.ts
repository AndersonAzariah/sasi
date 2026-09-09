import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";
import { CASES, INCIDENTS } from "@/lib/sasi/data";
import { SERVICES } from "@/lib/sasi/utils";
import type { ChatRole } from "@/lib/sasi/types";

/* ============================================================
   POST /api/sasi/ask
   Free-text "Ask SASI" assistant. Backend-only — the z-ai SDK
   is never imported from client code. The system prompt injects
   the user's live demo context (cases, incidents, location) so
   answers stay grounded in what SASI actually knows.

   Streaming: when body.stream is true the reply is delivered as
   Server-Sent Events (text/event-stream):
     data: {"type":"delta","text":"…"}     — incremental tokens
     data: {"type":"done","refs":[…],"suggestReport":true}
     data: {"type":"error","message":"…"}
   Both user message and final assistant reply are persisted to
   SQLite (per anonymous sessionId) so the chat survives reloads.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AskBody {
  messages?: { role: ChatRole; content: string }[];
  location?: { province?: string; city?: string; suburb?: string };
  sessionId?: string;
  stream?: boolean;
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

function compactContext(location: AskBody["location"]): string {
  const cases = CASES.slice(0, 6)
    .map(
      (c) =>
        `- ${c.ref} [${c.status}] "${c.title}" — ${c.service}, ${c.location.city}${
          c.proposedAction ? ` (proposed action: ${c.proposedAction.state})` : ""
        }`
    )
    .join("\n");
  const incidents = INCIDENTS.slice(0, 6)
    .map((i) => `- ${i.ref} [${i.status}] "${i.title}" — ${i.service}, ${i.location.city}`)
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
    "Current incidents SASI is tracking (demo data):",
    incidents,
    "",
    `Service directory keys: ${services}.`,
  ].join("\n");
}

const SYSTEM_PROMPT = (context: string) => `You are SASI — the South African Civic Intelligence Platform assistant. You help South African residents understand and resolve everyday civic service problems (water, electricity, roads, waste, healthcare, education, housing, documents, safety, local government).

VOICE
- Warm, practical, direct. Plain English with South African context (municipalities, wards, Eskom, Joburg Water, COJ, load-shedding, water-shedding).
- Short paragraphs or tight bullet lists. Bold the key phrase of each bullet. Never exceed ~160 words unless the user asks for detail.
- Never lecture. Never repeat the question back.

INDEPENDENCE AND TRUST RULES (non-negotiable)
- You are an independent platform, NOT a government body and NOT an emergency service. For life-threatening emergencies, tell the user to call 10111 (police) or 10177 (ambulance) immediately.
- You never claim to have contacted, notified, or filed anything with any authority. SASI only drafts actions and the user explicitly approves each one before it is submitted.
- Never fabricate official confirmations, reference numbers, or outcomes. If you reference the user's cases below, use only the refs and statuses listed. Any claim you cannot verify from the context or general public knowledge should be labelled as something SASI would verify (e.g. "worth confirming with the utility").
- When a user's message reads like a new service problem, offer to start a structured report ("Report an issue") or an investigation — those flows exist in this app.

USER CONTEXT (demo data — you may reference these refs naturally)
${context}

If the user asks what you can do: investigate civic problems across official + public sources, correlate with the user's own evidence and photos, draft findings with confidence levels, and prepare an approved-only service report to the relevant authority.`;

function cleanSession(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  return s.length > 0 && s.length <= 128 ? s : null;
}

/* ---------- SSE helpers ---------- */

function sseChunk(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

/** Parse the upstream OpenAI-compatible SSE byte stream into text deltas. */
async function* upstreamDeltas(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, sep).trim();
        buffer = buffer.slice(sep + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") return;
        try {
          const json = JSON.parse(data) as {
            choices?: { delta?: { content?: string } }[];
          };
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          /* partial/keepalive JSON — ignore and continue */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

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

  if (msgs.length === 0 || msgs[msgs.length - 1].role !== "user") {
    return NextResponse.json({ error: "A question is required." }, { status: 400 });
  }

  const sessionId = cleanSession(body.sessionId);
  const lastUser = msgs[msgs.length - 1];

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
    const payload = {
      messages: [
        { role: "assistant" as const, content: SYSTEM_PROMPT(compactContext(body.location)) },
        ...msgs,
      ],
      thinking: { type: "disabled" as const },
    };

    /* ---------------- Non-streaming (fallback / legacy) ---------------- */
    if (!wantStream) {
      const completion = (await zai.chat.completions.create(payload)) as {
        choices?: { message?: { content?: string } }[];
      };
      const reply = completion.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        return NextResponse.json(
          { error: "SASI could not answer right now. Please try again." },
          { status: 502 }
        );
      }
      const refs = Array.from(new Set(reply.match(REF_RE) ?? []));
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
      return NextResponse.json({ reply, refs, suggestReport: suggestsReport(reply) });
    }

    /* ---------------- Streaming (SSE) ---------------- */
    const upstream = (await zai.chat.completions.create({
      ...payload,
      stream: true,
    })) as unknown as ReadableStream<Uint8Array>;

    let full = "";
    let closed = false;

    const sse = new ReadableStream<Uint8Array>({
      async start(controller) {
        const push = (obj: Record<string, unknown>) => {
          if (!closed) controller.enqueue(sseChunk(obj));
        };
        try {
          for await (const delta of upstreamDeltas(upstream)) {
            full += delta;
            push({ type: "delta", text: delta });
          }

          const reply = full.trim();
          if (!reply) {
            push({
              type: "error",
              message: "SASI could not answer right now. Please try again.",
            });
            closed = true;
            controller.close();
            return;
          }

          const refs = Array.from(new Set(reply.match(REF_RE) ?? []));
          push({ type: "done", refs, suggestReport: suggestsReport(reply) });
          closed = true;
          controller.close();

          /* Persist the assistant reply after the stream completes (best-effort). */
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
