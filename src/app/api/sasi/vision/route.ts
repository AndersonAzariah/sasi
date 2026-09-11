import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import type { EvidenceAnalysis } from "@/lib/sasi/types";

/* ============================================================
   POST /api/sasi/vision
   AI evidence analysis for photos the user attaches in the
   report wizard (and later, the evidence vault). Backend-only —
   the z-ai SDK vision endpoint is never called from client code.

   Body: { image: "data:image/jpeg;base64,…", context?: { service?,
   problem?, location? } }
   Returns a STRICT JSON analysis with honest trust framing:
     { what_i_see, service_guess, severity, useful_for[],
       notable[], suggested_caption, quality_tip }
   The analysis is labelled AI-INFERRED in the UI — it is never
   presented as proof or as an official finding.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface VisionBody {
  image?: string;
  context?: {
    service?: string;
    problem?: string;
    location?: string;
  };
}

const MAX_BASE64_CHARS = 5_000_000; // ~3.7MB binary
const ALLOWED_MIME = /^data:(image\/(png|jpe?g|webp));base64,/;

const SYSTEM_PROMPT = `You are SASI's evidence analyst — part of South African Service Intelligence. A resident is reporting an everyday civic service problem (water, electricity, roads, waste, healthcare, education, housing, documents, safety, local government) and attached a photo.

Analyse the photo and reply with STRICT JSON only (no markdown fences, no prose):
{
  "what_i_see": "1-2 plain sentences describing the scene factually",
  "service_guess": "water|electricity|roads|waste|healthcare|education|housing|documents|safety|local-government|other",
  "severity": "LOW|MEDIUM|HIGH|CRITICAL",
  "useful_for": ["2-4 short phrases: what this photo helps prove or document"],
  "notable": ["0-3 short observations: hazards, landmarks, timestamps, visible infrastructure, anything identifying (do NOT repeat people's faces or number plates)"],
  "suggested_caption": "one factual caption ≤ 90 chars, suitable as an evidence note",
  "quality_tip": "one short tip to make the photo more useful as evidence (angle, scale reference, timestamp)"
}

RULES
- South African civic context (municipal infrastructure, Joburg Water, Eskom, COJ, taxis, robots=traffic lights,thag terms like "burst pipe", "padmount transformer").
- If the photo does not show a civic problem, say so honestly in what_i_see and set severity LOW.
- NEVER identify or name people. Never guess exact addresses. No fabrication: only describe what is visible.
- Severity: LOW = cosmetic/old issue; MEDIUM = inconvenience; HIGH = property/damage/health risk; CRITICAL = immediate danger to life.`;

function extractJson(raw: string): EvidenceAnalysis | null {
  let text = raw.trim();
  // strip markdown fences if the model added them
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as Partial<EvidenceAnalysis>;
    if (!obj.what_i_see || typeof obj.what_i_see !== "string") return null;
    const sev = String(obj.severity ?? "MEDIUM").toUpperCase();
    return {
      what_i_see: String(obj.what_i_see).slice(0, 400),
      service_guess: String(obj.service_guess ?? "other").toLowerCase().slice(0, 40),
      severity: (["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(sev)
        ? sev
        : "MEDIUM") as EvidenceAnalysis["severity"],
      useful_for: Array.isArray(obj.useful_for)
        ? obj.useful_for.slice(0, 4).map((s) => String(s).slice(0, 140))
        : [],
      notable: Array.isArray(obj.notable)
        ? obj.notable.slice(0, 3).map((s) => String(s).slice(0, 140))
        : [],
      suggested_caption: String(obj.suggested_caption ?? "Photo evidence").slice(0, 120),
      quality_tip: String(obj.quality_tip ?? "").slice(0, 160),
    };
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let body: VisionBody;
  try {
    body = (await req.json()) as VisionBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const image = body.image ?? "";
  if (!ALLOWED_MIME.test(image)) {
    return NextResponse.json(
      { error: "SASI can only read PNG, JPEG or WebP photos." },
      { status: 400 }
    );
  }
  if (image.length > MAX_BASE64_CHARS) {
    return NextResponse.json(
      { error: "That photo is too large. Try one under about 3 MB." },
      { status: 413 }
    );
  }

  const ctx = body.context ?? {};
  const contextLine = [
    ctx.service ? `Reported service category: ${ctx.service}.` : "",
    ctx.problem ? `The resident says the problem is: "${ctx.problem.slice(0, 200)}".` : "",
    ctx.location ? `Location: ${ctx.location.slice(0, 120)}, South Africa.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  try {
    const zai = await ZAI.create();
    /* model is intentionally omitted — the backend assigns its default
       vision model (currently glm-5v-turbo). The SDK type marks `model`
       as required, so the body is passed through a loose cast. */
    const visionBody = {
      messages: [
        {
          role: "user" as const,
          content: [
            {
              type: "text" as const,
              text: `${SYSTEM_PROMPT}\n\n${contextLine || "No extra context."}\n\nAnalyse this photo now. Reply with the JSON object only.`,
            },
            { type: "image_url" as const, image_url: { url: image } },
          ],
        },
      ],
      thinking: { type: "disabled" as const },
    };
    const completion = (await zai.chat.completions.createVision(
      visionBody as unknown as Parameters<typeof zai.chat.completions.createVision>[0]
    )) as { choices?: { message?: { content?: string } }[] };

    const raw = completion.choices?.[0]?.message?.content ?? "";
    const analysis = extractJson(raw);
    if (!analysis) {
      return NextResponse.json(
        { error: "SASI saw the photo but could not structure the analysis. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("[/api/sasi/vision] analysis failed:", err);
    return NextResponse.json(
      { error: "SASI could not analyse that photo just now. Please try again in a moment." },
      { status: 502 }
    );
  }
}
