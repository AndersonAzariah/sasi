import { NextResponse } from "next/server";
import { aiHttpStatus, getAIProvider } from "@/lib/ai";
import {
  clientIp,
  rateLimitService,
  tooManyRequests,
} from "@/lib/sasi/api-auth";
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
/* JSON adds escaping overhead around the base64 blob — reject oversized
   requests from the Content-Length header BEFORE the body is buffered. */
const MAX_BODY_BYTES = 7_500_000;
const ALLOWED_MIME = /^data:(image\/(png|jpe?g|webp));base64,/;

import { EVIDENCE_VISION_PROMPT as SYSTEM_PROMPT } from "@/lib/ai/prompts";

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
  /* AI vision calls are the most expensive endpoint per byte — 12/min
     per caller still allows a full multi-photo report, and blunts
     unauthenticated abuse of the model budget. */
  const limit = await rateLimitService.limit(
    `vision:${clientIp(req)}`,
    12,
    60_000
  );
  if (!limit.allowed) {
    return tooManyRequests(
      limit.retryAfterMs,
      "Too many photo analyses in a minute. Please wait a moment."
    );
  }
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "That photo is too large. Try one under about 3 MB." },
      { status: 413 }
    );
  }

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
    const provider = getAIProvider();
    /* multimodal content parts — the provider picks the vision model
       automatically when an image part is present (OPENROUTER_VISION_MODEL
       overrides it; otherwise the main model is used) */
    const completion = await provider.complete({
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${SYSTEM_PROMPT}\n\n${contextLine || "No extra context."}\n\nAnalyse this photo now. Reply with the JSON object only.`,
            },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    });

    const raw = completion.text;
    const analysis = extractJson(raw);
    if (!analysis) {
      return NextResponse.json(
        { error: "SASI saw the photo but could not structure the analysis. Please try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("[/api/sasi/vision] analysis failed:", err instanceof Error ? err.message : err);
    const http = aiHttpStatus(err, "SASI could not analyse that photo just now. Please try again in a moment.");
    return NextResponse.json(
      { error: http.message, code: http.code },
      { status: http.status }
    );
  }
}
