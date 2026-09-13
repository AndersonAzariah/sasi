/* ============================================================
   SASI — context-metadata (Task 28-b · Phase 10)

   Describes WHERE the resident is in the app when they ask a
   question, so "this" / "here" / "I need" resolve against the
   view they came from instead of being guessed.

   PURE MODULE: no react imports, no store import — everything is
   plain data in / plain data out, so the ask route can use it
   server-side and tests (or agents) can call it directly.

   Transport (why a cookie): the POST body is built inside
   store.askSasi (store.ts is outside 28-b's file ownership) and
   carries no context field today. The Ask SASI view therefore
   publishes the current context in a short-lived, strictly
   SameSite=Lax cookie that the same-origin fetch attaches
   automatically; the route prefers an explicit body.context when
   a future store version sends one. Both paths funnel through
   sanitizeViewContext so neither the client nor the model can
   smuggle arbitrary text into the system prompt.
   ============================================================ */

export const CONTEXT_COOKIE_NAME = "sasi_ctx";
/** the cookie describes one navigation — minutes, not sessions */
export const CONTEXT_COOKIE_MAX_AGE = 900;

export interface ViewContext {
  /** the app view the resident is on (or came from) */
  view: string;
  /** the view's param when meaningful (e.g. a service slug) */
  param: string | null;
}

/** param shapes we are willing to interpret — a registry/ServiceKey slug */
export const SLUG_PARAM_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

const MAX_VIEW_LEN = 40;
const MAX_PARAM_LEN = 80;

/**
 * Validate untrusted context input (client body or cookie JSON) into a
 * strict ViewContext. Unknown shapes, oversized values and hostile
 * characters are dropped — returns null when nothing usable remains.
 */
export function sanitizeViewContext(raw: unknown): ViewContext | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const view = typeof obj.view === "string" ? obj.view.trim().slice(0, MAX_VIEW_LEN) : "";
  if (!view || !/^[a-z0-9-]+$/.test(view)) return null;
  let param: string | null =
    typeof obj.param === "string" ? obj.param.trim().slice(0, MAX_PARAM_LEN) : null;
  if (!param) param = null;
  /* params are slugs at most — anything with spaces/punctuation is junk */
  if (param && !SLUG_PARAM_RE.test(param)) param = null;
  return { view, param };
}

/** Parse the `sasi_ctx` cookie out of a raw Cookie header (server-side). */
export function readContextFromCookieHeader(
  header: string | null | undefined
): ViewContext | null {
  if (!header) return null;
  try {
    const pair = header
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${CONTEXT_COOKIE_NAME}=`));
    if (!pair) return null;
    const raw = decodeURIComponent(pair.slice(CONTEXT_COOKIE_NAME.length + 1));
    return sanitizeViewContext(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Client-side: publish the current view context for the next ask. */
export function writeContextCookie(ctx: ViewContext): void {
  if (typeof document === "undefined") return;
  try {
    document.cookie = `${CONTEXT_COOKIE_NAME}=${encodeURIComponent(
      JSON.stringify(ctx)
    )}; path=/; max-age=${CONTEXT_COOKIE_MAX_AGE}; SameSite=Lax`;
  } catch {
    /* cookies blocked — the route answers without a context block */
  }
}

/* ------------------------------------------------------------
   Prompt rendering
   ------------------------------------------------------------ */

const VIEW_PHRASES: Record<string, string> = {
  "ask-sasi": "the Ask SASI assistant (this conversation)",
  "service-detail": "a service detail page",
  map: "the community map",
  report: "the report-an-issue wizard",
  investigate: "an investigation workspace",
  incidents: "the incidents tracker",
  cases: "their case list",
  journeys: "the guided journeys list",
  journey: "a guided journey checklist",
  documents: "their documents workspace",
  dashboard: "their dashboard",
  settings: "the settings screen",
};

function describeView(ctx: ViewContext): string {
  const phrase = VIEW_PHRASES[ctx.view];
  if (!phrase) return `the "${ctx.view}" screen`;
  if (ctx.param) return `${phrase}: ${ctx.param}`;
  return phrase;
}

/**
 * Build the compact context block for the system prompt.
 * Accepts a ViewContext, null, or a getState()-style resolver so the
 * route (and tests) can pass either. Returns "" when there is nothing
 * meaningful to say — the prompt simply omits the section.
 */
export function buildContextBlock(
  source:
    | ViewContext
    | null
    | undefined
    | (() => ViewContext | null | undefined)
): string {
  let ctx: ViewContext | null | undefined;
  if (typeof source === "function") {
    try {
      ctx = source();
    } catch {
      ctx = null;
    }
  } else {
    ctx = source;
  }
  const clean = sanitizeViewContext(ctx);
  if (!clean) return "";

  if (clean.view === "ask-sasi" && !clean.param) {
    return [
      "CURRENT VIEW CONTEXT",
      "The resident is already inside Ask SASI — no other page context applies.",
      'If they say "this" or "here" without earlier mention, ask what they mean instead of guessing.',
    ].join("\n");
  }

  const lines = [
    "CURRENT VIEW CONTEXT",
    `The resident is currently viewing: ${clean.view}${clean.param ? `: ${clean.param}` : ""} (${describeView(clean)}).`,
    'Interpret "this", "here" and "I need" against this context.',
  ];
  if (clean.view === "service-detail" && clean.param) {
    lines.push(
      "If the FOCUS SERVICE block below covers this page, ground requirements and steps in it — never beyond it."
    );
  }
  return lines.join("\n");
}
