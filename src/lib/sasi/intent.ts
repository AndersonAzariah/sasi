/* ============================================================
   SASI — Universal intent router (rule-based, honest).

   Task 26 / master prompt §3: a CLEAN intent-routing architecture
   that understands what a resident is trying to do from plain
   language and routes them to the right SASI surface.

   HONESTY CONTRACT:
   - These are transparent, auditable rules — NOT a fake AI.
     Every match carries the signals that fired, so the UI can
     show WHY a route was chosen ("matched: nearest + home affairs").
   - Low confidence ⇒ GENERAL ⇒ Ask SASI (never a wrong guess).
   - The interface is intentionally provider-agnostic: when a real
     model is wired in later, classify() can be swapped for an LLM
     call with the same IntentMatch contract.
   ============================================================ */

import type { ServiceKey, View } from "./types";

export type SasiIntent =
  | "SERVICE_DISCOVERY"
  | "REQUIREMENTS"
  | "LOCATION"
  | "DOCUMENT_EXPLANATION"
  | "VERIFICATION"
  | "CIVIC_REPORTING"
  | "CIVIC_INFORMATION"
  | "GENERAL";

export interface IntentMatch {
  intent: SasiIntent;
  /** where SASI routes the resident (ask-sasi for GENERAL) */
  view: View;
  /** detail param when the route is a detail view (e.g. service key) */
  param?: string;
  /** the transparent signals that produced this match */
  signals: string[];
  /** friendly label for the UI ("Opening the service map") */
  routeLabel: string;
  /** true when the router is confident enough to route away from Ask SASI */
  confident: boolean;
}

/* ---------- service keyword map (used by several intents) ---------- */

const SERVICE_KEYWORDS: Record<ServiceKey, string[]> = {
  water: ["water", "tap", "pipe", "burst pipe", "leak", "sanitation", "toilet", "sewer"],
  electricity: ["electricity", "power", "lights", "meter", " prepaid", "cable", "streetlight", "transformer", "load shedding", "loadshedding"],
  roads: ["road", "roads", "pothole", "potholes", "streetlight", "traffic light", "tar", "pavement", "bridge"],
  waste: ["waste", "rubbish", "refuse", "dumping", "bin", "litter", "trash", "garbage"],
  healthcare: ["clinic", "hospital", "healthcare", "health", "nurse", "doctor", "medicine", "clinic card", "immunisation", "hiv", "tb"],
  education: ["school", "schools", "education", "teacher", "learner", "university", "nsfas", "registration", "class"],
  housing: ["house", "housing", "rdp", "settlement", "eviction", "tenure", "title deed", "land"],
  documents: [
    "id", "identity document", "smart card", "passport", "home affairs", "birth certificate",
    "marriage certificate", "death certificate", "licence", "driver's licence", "drivers licence",
    "permit", "visa", "grant", "sassa", "social grant",
  ],
  safety: ["police", "crime", "safety", "saps", "neighbourhood watch", "emergency service"],
  "local-government": ["municipality", "municipal", "council", "ward councillor", "ward", "by-law", "rates", "account"],
  other: [],
};

function findService(q: string): { key: ServiceKey; hit: string } | null {
  const lower = ` ${q.toLowerCase()} `;
  let best: { key: ServiceKey; hit: string; len: number } | null = null;
  for (const [key, words] of Object.entries(SERVICE_KEYWORDS) as [ServiceKey, string[]][]) {
    for (const w of words) {
      if (lower.includes(w) && (!best || w.length > best.len)) {
        best = { key, hit: w, len: w.length };
      }
    }
  }
  return best ? { key: best.key, hit: best.hit } : null;
}

/* ---------- intent rules (first confident match wins, most specific first) ---------- */

interface IntentRule {
  intent: SasiIntent;
  pattern: RegExp;
  signals: string;
  /** build the route for this rule given the query */
  route: (q: string, service: { key: ServiceKey; hit: string } | null) => {
    view: View;
    param?: string;
    routeLabel: string;
  };
}

const RULES: IntentRule[] = [
  {
    intent: "LOCATION",
    pattern:
      /\b(where|nearest|near me|closest|around me|nearby|directions|how do i get to|which (office|clinic|branch|centre|center))\b/i,
    signals: "location words",
    route: (_q, service) => ({
      view: "map",
      routeLabel: service
        ? `Showing the service map — look for ${service.key === "documents" ? "Home Affairs" : service.key} locations`
        : "Showing the service map",
    }),
  },
  {
    intent: "VERIFICATION",
    pattern:
      /\b(is (this|it|that) (real|fake|legit(imate)?|a scam)|scam|hoax|phishing|too good to be true|verify (this|it|the)? ?(message|sms|letter|call)?|sassa (sms|message|call|letter))\b/i,
    signals: "scam-check words",
    route: () => ({
      view: "verify",
      routeLabel: "Opening Verify — SASI's scam-check",
    }),
  },
  {
    intent: "CIVIC_REPORTING",
    pattern:
      /\b(report|log (a|an|the) |there (is|'s) a |not working|has been (broken|out)|dumping|burst|pothole(s)? (near|on)|stop working)\b/i,
    signals: "report-an-issue words",
    route: (_q, service) => ({
      view: "report",
      param: service?.key !== "other" ? service?.key : undefined,
      routeLabel: "Opening the report flow",
    }),
  },
  {
    intent: "DOCUMENT_EXPLANATION",
    pattern:
      /\b(explain (this|that|a|the)[a-z ',]{0,30}?(letter|document|notice|sms|email|form)|what does (this|that|the)[a-z ',]{0,30}?(letter|document|notice|sms|email|form) mean|received a letter)\b/i,
    signals: "document-explanation words",
    route: () => ({
      view: "ask-sasi",
      routeLabel: "Ask SASI will explain it — documents workspace is in build",
    }),
  },
  {
    intent: "REQUIREMENTS",
    pattern:
      /\b(what (documents|papers|do i need)|which documents|requirements|need to (bring|have|apply)|qualify for|eligib)\b/i,
    signals: "requirements words",
    route: (q, service) =>
      service
        ? {
            view: "service-detail",
            param: service.key,
            routeLabel: `Opening ${service.key === "documents" ? "the documents" : service.key} requirements`,
          }
        : {
            view: "services",
            routeLabel: "Opening the services directory — every service lists its requirements",
          },
  },
  {
    intent: "CIVIC_INFORMATION",
    pattern:
      /\b(my rights|your rights|am i (allowed|entitled)|is it legal|is it illegal|know your rights|what can (they|the municipality|council) do)\b/i,
    signals: "rights words",
    route: () => ({
      view: "gov",
      routeLabel: "Opening the government & rights guide",
    }),
  },
  {
    intent: "SERVICE_DISCOVERY",
    pattern:
      /\b(i need|how do i (get|apply|renew|replace|register)|apply(ing)? for|renew|replace|register|get a|where do i (apply|get)|help me (get|apply))\b/i,
    signals: "service-discovery words",
    route: (_q, service) =>
      service
        ? {
            view: "service-detail",
            param: service.key,
            routeLabel: `Opening the ${service.key === "documents" ? "documents & identity" : service.key} service`,
          }
        : {
            view: "services",
            routeLabel: "Opening the services directory",
          },
  },
];

/** classify a free-text query into an IntentMatch (never throws) */
export function classifyIntent(query: string): IntentMatch {
  const q = (query ?? "").trim();
  if (!q) {
    return {
      intent: "GENERAL",
      view: "ask-sasi",
      signals: [],
      routeLabel: "Ask SASI",
      confident: false,
    };
  }

  const service = findService(q);

  for (const rule of RULES) {
    if (rule.pattern.test(q)) {
      const route = rule.route(q, service);
      const signals = [
        rule.signals,
        service ? `service: ${service.hit}` : null,
      ].filter((s): s is string => Boolean(s));
      return {
        intent: rule.intent,
        view: route.view,
        param: route.param,
        signals,
        routeLabel: route.routeLabel,
        confident: route.view !== "ask-sasi",
      };
    }
  }

  return {
    intent: "GENERAL",
    view: "ask-sasi",
    signals: [],
    routeLabel: "Ask SASI",
    confident: false,
  };
}

/* Dev/QA hook — the same pattern as __sasiStore / __sasiPwa. */
declare global {
  interface Window {
    __sasiIntent?: { classifyIntent: typeof classifyIntent };
  }
}
if (typeof window !== "undefined") {
  window.__sasiIntent = { classifyIntent };
}
