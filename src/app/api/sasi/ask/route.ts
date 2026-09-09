import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { CASES, INCIDENTS } from "@/lib/sasi/data";
import { SERVICES } from "@/lib/sasi/utils";
import type { ChatRole } from "@/lib/sasi/types";

/* ============================================================
   POST /api/sasi/ask
   Free-text "Ask SASI" assistant. Backend-only — the z-ai SDK
   is never imported from client code. The system prompt injects
   the user's live demo context (cases, incidents, location) so
   answers stay grounded in what SASI actually knows.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AskBody {
  messages?: { role: ChatRole; content: string }[];
  location?: { province?: string; city?: string; suburb?: string };
}

const REF_RE = /(CASE-\d{6}|INC-\d{4})/g;

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

  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: SYSTEM_PROMPT(compactContext(body.location)) },
        ...msgs,
      ],
      thinking: { type: "disabled" },
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) {
      return NextResponse.json(
        { error: "SASI could not answer right now. Please try again." },
        { status: 502 }
      );
    }

    const refs = Array.from(new Set(reply.match(REF_RE) ?? []));
    return NextResponse.json({ reply, refs });
  } catch (err) {
    console.error("[/api/sasi/ask] assistant failed:", err);
    return NextResponse.json(
      { error: "SASI could not reach the assistant service. Please try again in a moment." },
      { status: 502 }
    );
  }
}
