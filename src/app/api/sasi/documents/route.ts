import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { AIProviderError, aiHttpStatus, getAIProvider } from "@/lib/ai";
import { DOCUMENT_ANALYST_PROMPT as DOC_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { rateLimitService, tooManyRequests } from "@/lib/sasi/api-auth";

/* ============================================================
   /api/sasi/documents — Phase 15 DOCUMENT INTELLIGENCE.

   POST   multipart/form-data  fields: file (File), sessionId
          → extract text (or read an image via the vision model),
            ONE z-ai completion requesting STRICT JSON analysis
            { summary, importantInfo[], dates[{label,value,iso?}],
              actions[] }, validate it server-side, and persist
            ONLY metadata + analysis (never raw file bytes).
   GET    ?sessionId=…  → this session's/user's documents,
            newest first, capped at 50 (analysis parsed).
   DELETE ?sessionId=&id=  → delete ONLY a row that belongs to
            the requesting session (or signed-in user). The
            deletion is immediate and permanent.

   OWNERSHIP (canonical pattern from /api/sasi/state): every row
   is keyed by the anonymous sessionId; when a NextAuth session
   is present its userId is attached and becomes an additional
   scope. Documents are private to their owner — a row is only
   ever readable/deletable by its own session or account, never
   by other users.

   HONESTY RULES
   - Analysis is never fabricated: if the model reply cannot be
     parsed into the strict shape, the row is stored with
     summary=null / keyInfo=null and an honest analysisError is
     returned. A failed analysis is never replaced by a guess.
   - PDF parsing is NOT supported: PDFs are rejected with a
     clear 415 rather than a pretended analysis.
   - Size cap 5 MB (413 above it), text capped at 20,000 chars.
   ============================================================ */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_TEXT_CHARS = 20_000;

const TEXT_MIMES = new Set([
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "text/csv",
  "application/csv",
]);

const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);

interface DocDate {
  label: string;
  value: string;
  iso?: string;
}

interface DocKeyInfo {
  importantInfo: string[];
  dates: DocDate[];
  actions: string[];
}

interface DocumentRowLike {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  summary: string | null;
  keyInfo: string | null;
}

function cleanSession(raw: FormDataEntryValue | string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  return s.length > 0 && s.length <= 128 ? s : null;
}

/** NextAuth userId when a session is present — never trusted from the
 *  client, only resolved server-side. Anonymous sessions are fine. */
async function resolveUserId(): Promise<string | null> {
  try {
    const session = await getAuthSession();
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

/** The owner scope: the requesting session, PLUS the signed-in account
 *  when one exists. Nothing outside this scope is ever visible. */
function ownerScope(sessionId: string, userId: string | null) {
  return userId ? { OR: [{ sessionId }, { userId }] } : { sessionId };
}

function sanitizeName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? ""; // strip any path components
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "document").slice(0, 200);
}

function mimeFromExtension(name: string): string {
  const ext = name.includes(".") ? (name.split(".").pop() ?? "").toLowerCase() : "";
  if (ext === "txt") return "text/plain";
  if (ext === "md" || ext === "markdown") return "text/markdown";
  if (ext === "csv") return "text/csv";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "pdf") return "application/pdf";
  return "";
}

/** Server-side validation of the model's JSON. Only trimming/typing
 *  happens here — nothing is ever invented to fill a missing section. */
function extractAnalysis(raw: string): { summary: string; keyInfo: DocKeyInfo } | null {
  let text = raw.trim();
  // strip markdown fences if the model added them
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as {
      summary?: unknown;
      importantInfo?: unknown;
      dates?: unknown;
      actions?: unknown;
    };
    if (typeof obj.summary !== "string" || !obj.summary.trim()) return null;

    const importantInfo = Array.isArray(obj.importantInfo)
      ? (obj.importantInfo as unknown[])
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .slice(0, 8)
          .map((s) => s.trim().slice(0, 240))
      : [];

    const dates = Array.isArray(obj.dates)
      ? (obj.dates as unknown[])
          .slice(0, 8)
          .map((d): DocDate | null => {
            const o = d as { label?: unknown; value?: unknown; iso?: unknown };
            if (
              typeof o?.label !== "string" ||
              typeof o?.value !== "string" ||
              !o.label.trim() ||
              !o.value.trim()
            )
              return null;
            const out: DocDate = {
              label: o.label.trim().slice(0, 80),
              value: o.value.trim().slice(0, 100),
            };
            if (typeof o.iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.iso)) {
              out.iso = o.iso;
            }
            return out;
          })
          .filter((d): d is DocDate => d !== null)
      : [];

    const actions = Array.isArray(obj.actions)
      ? (obj.actions as unknown[])
          .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          .slice(0, 8)
          .map((s) => s.trim().slice(0, 240))
      : [];

    return {
      summary: obj.summary.trim().slice(0, 700),
      keyInfo: { importantInfo, dates, actions },
    };
  } catch {
    return null;
  }
}

async function analyseText(name: string, mime: string, text: string) {
  const provider = getAIProvider();
  const completion = await provider.complete({
    messages: [
      { role: "system", content: DOC_SYSTEM_PROMPT },
      {
        role: "user",
        content: `DOCUMENT FILE: "${name}" (${mime})\n\nDOCUMENT TEXT:\n<<<\n${text}\n>>>\n\nExtract the document analysis JSON now. Reply with the JSON object only.`,
      },
    ],
  });
  return extractAnalysis(completion.text);
}

/** Images follow the vision route pattern: one multimodal completion
 *  with the strict JSON contract. The model may only report what is
 *  legible — the provider picks the vision model for image parts. */
async function analyseImage(name: string, dataUrl: string) {
  const provider = getAIProvider();
  const completion = await provider.complete({
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${DOC_SYSTEM_PROMPT}\n\nThe "document" is a photo or scan the resident uploaded of "${name}". Read ONLY what is legible in the image. If parts are cut off or unreadable, say so honestly and do not fill the gaps. Analyse this document image now. Reply with the JSON object only.`,
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });
  return extractAnalysis(completion.text);
}

/** Serialize a DB row for the client: keyInfo parsed for convenience,
 *  plus an optional honest analysisError (analysis unavailable). */
function serialize(row: DocumentRowLike, analysisError: string | null = null) {
  let keyInfo: DocKeyInfo | null = null;
  if (row.keyInfo) {
    try {
      const parsed = JSON.parse(row.keyInfo) as DocKeyInfo;
      if (
        parsed &&
        Array.isArray(parsed.importantInfo) &&
        Array.isArray(parsed.dates) &&
        Array.isArray(parsed.actions)
      ) {
        keyInfo = parsed;
      }
    } catch {
      keyInfo = null; // corrupt JSON — report as unavailable, never fake it
    }
  }
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
    summary: row.summary,
    keyInfo,
    analysisError,
  };
}

/* ---------------- POST — upload + analyse ---------------- */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form data with a 'file' field." },
      { status: 400 }
    );
  }

  const sessionId = cleanSession(form.get("sessionId"));
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required." }, { status: 400 });
  }
  const userId = await resolveUserId();

  /* Light rate limit: 12 uploads per 5 minutes per owner (RateLimitService). */
  const limit = await rateLimitService.limit(
    `documents:post:${userId ?? sessionId}`,
    12,
    300_000
  );
  if (!limit.allowed) {
    return tooManyRequests(
      limit.retryAfterMs,
      "That is a lot of documents at once. SASI needs a short pause — try again in a few minutes."
    );
  }

  const raw = form.get("file");
  if (!(raw instanceof File)) {
    return NextResponse.json(
      { error: "A file is required. Choose a document or photo to analyse." },
      { status: 400 }
    );
  }
  const file = raw;
  if (file.size === 0) {
    return NextResponse.json(
      { error: "That file is empty — SASI has nothing to read." },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      {
        error: `That document is ${(
          file.size /
          (1024 * 1024)
        ).toFixed(1)} MB. SASI's limit is 5 MB — try a photo or export at a smaller size.`,
      },
      { status: 413 }
    );
  }

  const name = sanitizeName(file.name || "document");
  const declaredMime = (file.type || "").toLowerCase();
  const effectiveMime = declaredMime || mimeFromExtension(name);

  /* PDF: honestly unsupported — never a pretended analysis. */
  if (effectiveMime === "application/pdf") {
    return NextResponse.json(
      {
        error:
          "PDF parsing is not supported yet. SASI can read text files (.txt, .md, .csv) and clear photos of documents (PNG, JPG, WebP) today — a photo of the page works instead.",
      },
      { status: 415 }
    );
  }

  const isText = TEXT_MIMES.has(effectiveMime);
  const isImage = declaredMime !== "" && IMAGE_MIMES.has(declaredMime);

  if (!isText && !isImage) {
    return NextResponse.json(
      {
        error:
          "SASI can read plain text (.txt), Markdown (.md), CSV and photos of documents (PNG, JPG, WebP) — PDF is not supported yet. That file type is none of those.",
      },
      { status: 415 }
    );
  }

  let summary: string | null = null;
  let keyInfo: DocKeyInfo | null = null;
  let analysisError: string | null = null;

  try {
    const analysis = isText
      ? await analyseText(
          name,
          effectiveMime,
          (await file.text()).trim().slice(0, MAX_TEXT_CHARS)
        )
      : await analyseImage(
          name,
          `data:${declaredMime};base64,${Buffer.from(
            await file.arrayBuffer()
          ).toString("base64")}`
        );

    if (analysis) {
      summary = analysis.summary;
      keyInfo = analysis.keyInfo;
    } else {
      analysisError =
        "SASI read the file but could not structure a reliable analysis, so it saved none rather than guess. You can delete this document and try again.";
    }
  } catch (err) {
    console.error(
      "[/api/sasi/documents POST] analysis failed:",
      err instanceof Error ? err.message : err
    );
    analysisError =
      err instanceof AIProviderError && err.code === "not_configured"
        ? "SASI AI is temporarily unavailable. The platform's AI provider is not configured."
        : "SASI could not analyse this document just now. The file is saved below without an analysis — you can delete it or try again.";
  }

  /* Persist metadata + validated analysis ONLY. Raw file bytes are
     never written to the database. */
  try {
    const row = await db.documentRecord.create({
      data: {
        sessionId,
        userId,
        name,
        mimeType: effectiveMime,
        sizeBytes: file.size,
        summary,
        keyInfo: keyInfo ? JSON.stringify(keyInfo) : null,
      },
    });
    return NextResponse.json(serialize(row, analysisError));
  } catch (err) {
    console.error("[/api/sasi/documents POST] persist failed:", err);
    return NextResponse.json(
      { error: "SASI analysed the document but could not save it just now. Please try again." },
      { status: 500 }
    );
  }
}

/* ---------------- GET — list this owner's documents ---------------- */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = cleanSession(url.searchParams.get("sessionId"));
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required." }, { status: 400 });
  }
  const userId = await resolveUserId();

  try {
    const rows = await db.documentRecord.findMany({
      where: ownerScope(sessionId, userId),
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ documents: rows.map((r) => serialize(r)) });
  } catch (err) {
    console.error("[/api/sasi/documents GET] list failed:", err);
    return NextResponse.json(
      { error: "SASI could not load your documents just now." },
      { status: 500 }
    );
  }
}

/* ---------------- DELETE — immediate + permanent, owner-only ---------------- */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const sessionId = cleanSession(url.searchParams.get("sessionId"));
  const id = (url.searchParams.get("id") ?? "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required." }, { status: 400 });
  }
  if (!id) {
    return NextResponse.json({ error: "id required." }, { status: 400 });
  }
  const userId = await resolveUserId();

  try {
    const res = await db.documentRecord.deleteMany({
      where: { id, ...ownerScope(sessionId, userId) },
    });
    if (res.count === 0) {
      return NextResponse.json(
        {
          error:
            "That document was not found for this session — it may already be deleted, or it was never yours to remove.",
        },
        { status: 404 }
      );
    }
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error("[/api/sasi/documents DELETE] failed:", err);
    return NextResponse.json(
      { error: "SASI could not delete that document just now. Nothing was removed." },
      { status: 500 }
    );
  }
}
