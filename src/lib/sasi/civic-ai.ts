/* ============================================================
   SASI — civic-ai (Task 28-b · Phases 6 / 7 / 10)

   Shared brain for the "Ask SASI" structured-answer pipeline:

   - StructuredAnswer   — the validated JSON contract the model must
                          produce (Phase 6)
   - extractJsonBlock   — tolerant JSON extraction (fences, prose preamble)
   - validateStructuredAnswer — hard validation: unknown fields are
                          STRIPPED, every field is capped and typed;
                          returns null when the payload is not an honest
                          structured answer (→ caller falls back to the
                          legacy plain-text shape, the endpoint never breaks)
   - corroborateStructured — post-validation honesty hardening against the
                          SERVICE REGISTRY: service slugs / journeyIds the
                          model invents are removed, officialSource is only
                          kept when the registry corroborates it or the host
                          is a certain gov.za domain — a missing source is
                          honest, a wrong one is fabrication
   - registry helpers   — defensive access to the (parallel-owned) registry,
                          a mid-write or missing module degrades to "no
                          registry" instead of crashing
   - prompt blocks      — registry grounding + focus-service blocks the
                          ask route folds into its system prompt
   - deriveLocationCategory — keyword → map "Nearby" category hint
                          (Phase 7 Find Nearby action)

   CLIENT-SAFE: no server-only imports (no z-ai SDK, no db). Used by
   both the ask API route and the chat UI components.
   ============================================================ */

import { JOURNEY_ENTRIES, SERVICE_REGISTRY, journeyStepsFor } from "./services-registry";
import { SERVICES } from "./utils";

/* ------------------------------------------------------------
   Types — the wire contract (Phase 6)
   ------------------------------------------------------------ */

export interface StructuredServiceRef {
  slug: string;
  title: string;
}

export interface StructuredJourneyRef {
  journeyId: string;
  title: string;
}

export interface StructuredOfficialSource {
  org: string;
  url: string;
}

export interface StructuredAnswer {
  /** the plain human-readable answer — the ONLY field the resident reads */
  answer: string;
  /** documents / information the resident must have */
  whatYouNeed?: string[];
  /** the single most useful next action */
  nextStep?: string;
  /** registry-backed service pointer (drives the View Service action) */
  service?: StructuredServiceRef;
  /** registry-backed journey pointer (drives the Start Journey action) */
  journey?: StructuredJourneyRef;
  /** verified official source (drives the View Source action) */
  officialSource?: StructuredOfficialSource | null;
  /** short related topics worth asking next */
  related?: string[];
  /** registry-derived map "Nearby" hint (Phase 7 Find Nearby).
     Set by corroboration from the registry's locationCategory — the
     model's own value never survives corroboration when a registry
     service matches, so ground truth always wins. */
  locationCategory?: string;
}

/** hard caps — everything the model returns is truncated to these */
export const CIVIC_AI_LIMITS = {
  answer: 4000,
  whatYouNeedItems: 8,
  listItems: 200,
  nextStep: 300,
  slug: 80,
  title: 120,
  relatedItems: 6,
  relatedItem: 80,
  url: 400,
  org: 120,
} as const;

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

/* ------------------------------------------------------------
   small typed extraction helpers (never throw)
   ------------------------------------------------------------ */

function asString(v: unknown, cap: number): string {
  return typeof v === "string" ? v.trim().slice(0, cap) : "";
}

function asStringArray(v: unknown, maxItems: number, capItem: number): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = asString(item, capItem);
    if (s) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
}

/* ------------------------------------------------------------
   JSON extraction — tolerant of fences and prose wrappers
   (same defensive posture as the briefing route)
   ------------------------------------------------------------ */

export function extractJsonBlock(raw: string): unknown | null {
  let text = raw.trim();
  if (!text) return null;
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    /* fall through to brace-slice */
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------
   Validation — strip unknown fields, cap and type everything.
   Returns null when the payload cannot honestly be a structured
   answer (caller then serves the legacy plain-text shape).
   ------------------------------------------------------------ */

export function validateStructuredAnswer(raw: unknown): StructuredAnswer | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;

  const answer = asString(obj.answer, CIVIC_AI_LIMITS.answer);
  if (!answer) return null;

  const out: StructuredAnswer = { answer };

  const whatYouNeed = asStringArray(
    obj.whatYouNeed,
    CIVIC_AI_LIMITS.whatYouNeedItems,
    CIVIC_AI_LIMITS.listItems
  );
  if (whatYouNeed.length) out.whatYouNeed = whatYouNeed;

  const nextStep = asString(obj.nextStep, CIVIC_AI_LIMITS.nextStep);
  if (nextStep) out.nextStep = nextStep;

  /* service — unknown fields inside are dropped by rebuilding the object */
  if (obj.service && typeof obj.service === "object") {
    const s = obj.service as Record<string, unknown>;
    const slug = asString(s.slug, CIVIC_AI_LIMITS.slug).toLowerCase();
    const title = asString(s.title, CIVIC_AI_LIMITS.title);
    if (slug && SLUG_RE.test(slug) && title) {
      out.service = { slug, title };
    }
  }

  /* journey — same strict rebuild */
  if (obj.journey && typeof obj.journey === "object") {
    const j = obj.journey as Record<string, unknown>;
    const journeyId = asString(j.journeyId, CIVIC_AI_LIMITS.slug).toLowerCase();
    const jTitle = asString(j.title, CIVIC_AI_LIMITS.title);
    if (journeyId && SLUG_RE.test(journeyId) && jTitle) {
      out.journey = { journeyId, title: jTitle };
    }
  }

  /* officialSource — URL must at least parse as http(s); deeper honesty
     hardening (registry corroboration / gov.za allowlist) happens in
     corroborateStructured so the model's word alone is never enough */
  if (obj.officialSource && typeof obj.officialSource === "object") {
    const o = obj.officialSource as Record<string, unknown>;
    const org = asString(o.org, CIVIC_AI_LIMITS.org);
    const url = asString(o.url, CIVIC_AI_LIMITS.url);
    if (org && url && isHttpUrl(url)) {
      out.officialSource = { org, url };
    }
  }

  const related = asStringArray(
    obj.related,
    CIVIC_AI_LIMITS.relatedItems,
    CIVIC_AI_LIMITS.relatedItem
  );
  if (related.length) out.related = related;

  /* map hint — strict charset only; corroboration replaces it with the
     registry's value whenever the service matches, so a model-invented
     category can at worst behave like the client-side keyword fallback */
  if (typeof obj.locationCategory === "string" && /^[a-z0-9-]{1,40}$/.test(obj.locationCategory)) {
    out.locationCategory = obj.locationCategory;
  }

  return out;
}

function isHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------
   Registry access — defensive by design. The registry is owned by
   a parallel task (28-c); a missing export, a malformed entry or a
   mid-write module must degrade to "no registry", never crash.
   ------------------------------------------------------------ */

/** minimal structural view of a registry entry — tolerant of the real
    file evolving (extra fields are fine, missing ones are optional) */
export interface RegistryEntry {
  slug?: string;
  title?: string;
  category?: string;
  department?: string;
  summary?: string;
  requirements?: string[];
  requiredDocuments?: string[];
  journeyId?: string | null;
  officialSource?: { org?: string; url?: string; verified?: boolean } | null;
  locationCategory?: string | null;
  relatedServices?: string[];
}

let registryCache: RegistryEntry[] | null = null;

export function getRegistryEntries(): RegistryEntry[] {
  if (registryCache) return registryCache;
  try {
    const raw = SERVICE_REGISTRY as unknown;
    registryCache = Array.isArray(raw)
      ? (raw as RegistryEntry[]).filter(
          (e): e is RegistryEntry =>
            Boolean(e) && typeof e === "object" && typeof (e as RegistryEntry).slug === "string"
        )
      : [];
  } catch {
    /* module mid-write / export missing — degrade honestly */
    registryCache = [];
  }
  return registryCache;
}

/** guarded executor — the fn receives registry entries or an empty array */
export function withRegistry<T>(fn: (entries: RegistryEntry[]) => T, fallback: T): T {
  try {
    return fn(getRegistryEntries());
  } catch {
    return fallback;
  }
}

export function findRegistryEntry(slug: string): RegistryEntry | undefined {
  return withRegistry(
    (entries) => entries.find((e) => e.slug === slug),
    undefined
  );
}

export function registryAvailable(): boolean {
  return getRegistryEntries().length > 0;
}

/* ------------------------------------------------------------
   Honesty hardening — corroborate the model's pointers against the
   registry. Ground truth (the registry) always beats model recall.
   ------------------------------------------------------------ */

/** certain-official host check: gov.za and subdomains only */
export function isTrustedOfficialHost(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    return host === "gov.za" || host.endsWith(".gov.za");
  } catch {
    return false;
  }
}

export function corroborateStructured(s: StructuredAnswer): StructuredAnswer {
  const entries = getRegistryEntries();
  const out: StructuredAnswer = { answer: s.answer };
  if (s.whatYouNeed) out.whatYouNeed = s.whatYouNeed;
  if (s.nextStep) out.nextStep = s.nextStep;
  if (s.related) out.related = s.related;

  if (entries.length > 0) {
    /* service — must exist in the registry; registry title wins */
    if (s.service) {
      const entry = findRegistryEntry(s.service.slug);
      if (!entry) {
        /* invented slug — drop it rather than deep-link into nothing */
      } else {
        out.service = {
          slug: entry.slug ?? s.service.slug,
          title: entry.title || s.service.title,
        };
      }
    }

    /* journey — the journeyId must exist in the registry too */
    if (s.journey) {
      const entry = entries.find((e) => e.journeyId === s.journey?.journeyId);
      if (!entry) {
        /* invented journey — drop */
      } else {
        out.journey = {
          journeyId: entry.journeyId ?? s.journey.journeyId,
          title: entry.title || s.journey.title,
        };
      }
    }

    /* officialSource — the registry's verified source is ground truth:
       it REPLACES the model's, it is RESTORED when the model omitted it,
       and when there is no verified registry source the model's URL
       survives only if it is a certain gov.za host. */
    const serviceEntry = out.service ? findRegistryEntry(out.service.slug) : undefined;
    const regSource = serviceEntry?.officialSource;
    if (regSource?.verified && regSource.url) {
      out.officialSource = {
        org: regSource.org || out.officialSource?.org || "South African Government",
        url: regSource.url,
      };
    } else if (out.officialSource) {
      if (!isTrustedOfficialHost(out.officialSource.url)) {
        out.officialSource = null;
      }
    }

    /* locationCategory comes ONLY from the registry — never guessed here */
    if (serviceEntry?.locationCategory) {
      out.locationCategory = serviceEntry.locationCategory;
    }
  } else {
    /* registry unavailable (mid-write / empty): keep only certainly-official
       URLs; service/journey pointers stay (the receiving views render their
       own honest not-found states) */
    if (out.officialSource && !isTrustedOfficialHost(out.officialSource.url)) {
      out.officialSource = null;
    }
  }

  return out;
}

/* ------------------------------------------------------------
   Prompt blocks
   ------------------------------------------------------------ */

function line(v: unknown, cap: number): string {
  return asString(v, cap);
}

/** compact registry grounding for the system prompt (Phase 6) */
export function registryGroundingBlock(limit = 40): string {
  const entries = getRegistryEntries();
  if (entries.length === 0) {
    return [
      "SERVICE REGISTRY: (not available in this context)",
      "Do NOT invent or reference any service slug, guided journey or official URL.",
      "Omit the service, journey and officialSource fields entirely.",
    ].join("\n");
  }
  const lines = entries.slice(0, limit).map((e) => {
    const slug = line(e.slug, CIVIC_AI_LIMITS.slug);
    const title = line(e.title, CIVIC_AI_LIMITS.title);
    const dept = line(e.department, 90);
    const journey = typeof e.journeyId === "string" && e.journeyId ? e.journeyId : "none";
    const docs = Array.isArray(e.requiredDocuments)
      ? e.requiredDocuments.length
      : Array.isArray(e.requirements)
        ? e.requirements.length
        : 0;
    const src =
      e.officialSource?.verified && e.officialSource.url ? e.officialSource.url : "none";
    return `- ${slug} — ${title}${dept ? ` (${dept})` : ""} | journey: ${journey} | listed requirement items: ${docs} | verified official source: ${src}`;
  });
  const more = entries.length > limit ? `\n(+${entries.length - limit} more not listed — if the service you need is not shown, say so honestly instead of guessing)` : "";
  return [
    "SERVICE REGISTRY (the ONLY services and journeys that exist in SASI — reference nothing outside it):",
    ...lines,
    more,
  ]
    .filter(Boolean)
    .join("\n");
}

/** focus block when the resident is on a service-detail page (Phase 10):
    the registry entry for the viewed slug, in full, so questions like
    "what do I need for this?" are grounded in real data */
export function serviceDetailBlock(slug: string): string | null {
  const entry = findRegistryEntry(slug);
  if (!entry) return null;
  const parts: string[] = [`FOCUS SERVICE (the resident is viewing this page right now):`];
  parts.push(`- slug: ${entry.slug ?? slug}`);
  if (entry.title) parts.push(`- title: ${entry.title}`);
  if (entry.department) parts.push(`- responsible department: ${entry.department}`);
  if (entry.summary) parts.push(`- what it covers: ${asString(entry.summary, 300)}`);
  if (Array.isArray(entry.requirements) && entry.requirements.length) {
    parts.push(
      `- requirements: ${entry.requirements
        .slice(0, 10)
        .map((r) => asString(r, 160))
        .filter(Boolean)
        .join(" | ")}`
    );
  }
  if (Array.isArray(entry.requiredDocuments) && entry.requiredDocuments.length) {
    parts.push(
      `- documents usually needed: ${entry.requiredDocuments
        .slice(0, 10)
        .map((d) => asString(d, 160))
        .filter(Boolean)
        .join(" | ")}`
    );
  }
  if (typeof entry.journeyId === "string" && entry.journeyId) {
    parts.push(`- SASI preparation journey: ${entry.journeyId} (a checklist — NOT an official application)`);
  }
  if (entry.officialSource?.verified && entry.officialSource.url) {
    parts.push(
      `- verified official source: ${entry.officialSource.org ?? ""} ${entry.officialSource.url} (use THIS for officialSource when relevant — never any other URL)`
    );
  } else {
    parts.push(
      `- verified official source: none — direct the resident to the responsible department (${entry.department ?? "the relevant department"}) instead of quoting a URL`
    );
  }
  parts.push(
    "Anything this block does not list must not be invented — if unsure, say so in answer."
  );
  return parts.join("\n");
}

/** focus block when the resident is inside a guided journey (Task 30 —
    contextual AI): grounds "what do I do now?" in the journey's own
    registered service and steps — never generic advice */
export function journeyFocusBlock(journeyId: string): string | null {
  const clean = journeyId.toLowerCase().trim();
  if (!clean || !SLUG_RE.test(clean)) return null;
  const entry = JOURNEY_ENTRIES.find((e) => e.journeyId === clean);
  if (!entry) return null;
  const parts: string[] = [
    `FOCUS JOURNEY (the resident is inside this checklist right now):`,
    `- journeyId: ${entry.journeyId}`,
    `- title: ${entry.title}`,
    "- This is SASI's preparation checklist — NOT an official government application and never a submission.",
  ];
  const steps = journeyStepsFor(clean);
  if (steps && steps.length) {
    parts.push(
      `- its registered steps (do not invent extra steps): ${steps
        .slice(0, 12)
        .map((s) => asString(s.title, 120))
        .filter(Boolean)
        .join(" | ")} `
    );
  }
  const detail = serviceDetailBlock(entry.slug);
  if (detail) {
    /* reuse the full service grounding — requirements, documents, source */
    parts.push(
      detail.replace(
        "FOCUS SERVICE (the resident is viewing this page right now):",
        "THE SERVICE THIS JOURNEY PREPARES FOR:"
      )
    );
  }
  parts.push(
    '"What do I do now?" answers with the CURRENT or NEXT step from the registered steps above and what it needs — nothing beyond them.'
  );
  return parts.join("\n");
}

/* ------------------------------------------------------------
   Phase 7 — Find Nearby category hint.
   Registry entries carry a locationCategory; for free-text answers
   the category is derived conservatively from the answer + service.
   ------------------------------------------------------------ */

const CATEGORY_PATTERNS: [RegExp, string][] = [
  [/\b(home affairs|passport|smart id|birth certificate|id document|identity document)\b/i, "home-affairs"],
  [/\b(sassa|social grant|grant payout|child support grant|old age grant)\b/i, "sassa-office"],
  [/\b(police station|saps|police clearance|affidavit|case number|10111)\b/i, "police-station"],
  [/\b(licen[cs]e renewal|vehicle licen[cs]e|disc renewal|car licen[cs]e)\b/i, "licensing-office"],
  [/\b(driver'?s? licen[cs]e|driving licen[cs]e|k53|dltc|learner'?s? licen[cs]e)\b/i, "dltc"],
  [/\b(clinic|hospital|healthcare|vaccin|medicin|ambulance|sister|nurse)\b/i, "healthcare"],
  [/\b(water|tap|pipe|leak|reservoir|burst|sewage|sanitation)\b/i, "water"],
  [/\b(electricity|power|load.?shed|eskom|prepaid meter|cable|streetlight)\b/i, "electricity"],
  [/\b(pothole|road damage|traffic light|sidewalk|storm drain)\b/i, "roads"],
  [/\b(rubbish|waste|illegal dumping|litter|recycl|bin collection)\b/i, "waste"],
  [/\b(housing|rdp|human settlements|tenure|eviction)\b/i, "housing"],
  [/\b(school|education|learner|grade r|school fees)\b/i, "education"],
  [/\b(municipal account|rates|billing|councillor|ward|municipality)\b/i, "local-government"],
];

/**
 * Derive the map "Nearby" category hint for an answer.
 * Priority: registry locationCategory > registry category (when it is a
 * known ServiceKey) > conservative keyword scan of the answer text.
 * Returns null when nothing matches confidently — the button simply
 * does not render (no decorative actions).
 */
export function deriveLocationCategory(
  structured: Pick<StructuredAnswer, "service">,
  answerText: string
): string | null {
  if (structured.service?.slug) {
    const entry = findRegistryEntry(structured.service.slug);
    if (entry?.locationCategory) return entry.locationCategory;
    if (entry?.category && entry.category in SERVICES) return entry.category;
  }
  const hay = answerText.slice(0, 1200);
  for (const [re, category] of CATEGORY_PATTERNS) {
    if (re.test(hay)) return category;
  }
  return null;
}

/** can the View Service action honestly deep-link? (registry slug or a
    known platform ServiceKey such as "water") */
export function serviceSlugResolvable(slug: string): boolean {
  if (!slug || !SLUG_RE.test(slug)) return false;
  if (slug in SERVICES) return true;
  return Boolean(findRegistryEntry(slug));
}
