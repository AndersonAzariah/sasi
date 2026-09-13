/* ============================================================
   SASI — Universal search engine (Task 29)

   Deterministic, client-safe search over the data the app ACTUALLY
   has: the service registry, the journey catalogue, verified
   organisations, civic topics, public information views and (when
   provided) the signed-in resident's saved items.

   DESIGN RULES
   - Zero fabrication: a hit exists only if a real entry matched.
   - Deterministic first (instant, free, offline-capable); "Ask SASI"
     is offered as the AI interpretation path, never on every keystroke.
   - Intent routing: location-shaped queries surface Nearby, and
     verification-shaped queries surface Verify — routed honestly
     instead of pretending they are service lookups.
   ============================================================ */

import {
  JOURNEY_ENTRIES,
  SERVICE_REGISTRY,
  type ServiceRegistryEntry,
} from "./services-registry";
import { CIVIC_TOPICS, INFO_INDEX, ORGANISATIONS } from "./explore-data";
import type { View } from "./types";

/* ------------------------------------------------------------
   Types
   ------------------------------------------------------------ */

export type SearchGroup =
  | "service"
  | "journey"
  | "organisation"
  | "topic"
  | "information"
  | "saved";

export interface SearchHit {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle?: string;
  /** client-side state-route navigation target */
  view: View;
  param?: string;
  /** true only when the entry's official source is verified */
  verified?: boolean;
}

export interface SearchIntent {
  /** "nearest clinic" → route to the map/Nearby */
  nearby: boolean;
  /** "is this message fake?" → route to Verify */
  verify: boolean;
  /** "water leaking in my street" → offer the report flow */
  report: boolean;
}

export interface SearchResult {
  query: string;
  intent: SearchIntent;
  services: SearchHit[];
  journeys: SearchHit[];
  organisations: SearchHit[];
  topics: SearchHit[];
  information: SearchHit[];
  saved: SearchHit[];
  total: number;
}

/* ------------------------------------------------------------
   Intent detection — honest routing, not pretend lookups
   ------------------------------------------------------------ */

const NEARBY_RE =
  /\b(near\s?me|nearest|closest|around me|where (can|do|is)|find (a|an|the)?)\b|\b(clinic|hospital|saps|police station|home affairs office|post office|dltc|licensing office|sassa office|pay point) (near|around|close)\b/i;
const VERIFY_RE =
  /\b(fake|scam|phishing|legit(imate)?|verify|verification|suspicious|hoax|real or fake|is this (real|true|genuine)|check (this )?(message|sms|number|link|sender))\b/i;
const REPORT_RE =
  /\b(report|leak(ing|age)?|burst|outage|no water|no electricity|pothole|broken|blocked|overflowing|not working|power cut|water cut)\b/i;

export function detectIntent(query: string): SearchIntent {
  const q = query.trim();
  return {
    nearby: NEARBY_RE.test(q),
    verify: VERIFY_RE.test(q),
    report: REPORT_RE.test(q) && !VERIFY_RE.test(q),
  };
}

/* ------------------------------------------------------------
   Matching — small, deterministic scorer over known fields
   ------------------------------------------------------------ */

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenise(s: string): string[] {
  return normalise(s).split(" ").filter(Boolean);
}

/** score = how strongly a field matches the query tokens */
function scoreFields(
  query: string,
  fields: { text: string; weight: number }[]
): number {
  const qTokens = tokenise(query);
  if (qTokens.length === 0) return 0;
  let score = 0;
  for (const { text, weight } of fields) {
    const hay = normalise(text);
    if (!hay) continue;
    /* whole-query phrase match is the strongest signal */
    if (hay.includes(normalise(query)) && normalise(query).length >= 3) {
      score += weight * 6;
      continue;
    }
    for (const tok of qTokens) {
      if (tok.length < 2) continue;
      if (hay === tok) score += weight * 4;
      else if (hay.startsWith(tok) || hay.includes(tok)) score += weight * 2;
      else if (tokenise(hay).some((h) => h.startsWith(tok) && tok.length >= 3)) {
        score += weight;
      }
    }
  }
  return score;
}

function scoreService(query: string, e: ServiceRegistryEntry): number {
  return scoreFields(query, [
    { text: e.title, weight: 10 },
    { text: e.slug.replace(/-/g, " "), weight: 6 },
    { text: e.department, weight: 3 },
    { text: e.summary, weight: 2 },
    { text: e.category.replace(/-/g, " "), weight: 2 },
    { text: e.requirements.join(" "), weight: 1 },
    { text: e.requiredDocuments.join(" "), weight: 1 },
  ]);
}

/* ------------------------------------------------------------
   The engine
   ------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, string> = {
  documents: "Identity & documents",
  safety: "Safety",
  "local-government": "Local government",
  water: "Water",
  electricity: "Electricity",
  roads: "Roads",
  waste: "Waste",
  healthcare: "Healthcare",
  education: "Education",
  housing: "Housing",
  other: "Services",
};

export interface SavedSearchInput {
  kind: string;
  itemId: string;
  title?: string;
}

/** Search everything SASI really has. Cheap enough to run per
    keystroke (all sources are small in-memory lists). */
export function searchSASI(
  rawQuery: string,
  saved: SavedSearchInput[] = []
): SearchResult {
  const query = rawQuery.trim().slice(0, 120);
  const empty: SearchResult = {
    query,
    intent: { nearby: false, verify: false, report: false },
    services: [],
    journeys: [],
    organisations: [],
    topics: [],
    information: [],
    saved: [],
    total: 0,
  };
  if (!query) return empty;

  const intent = detectIntent(query);

  /* services — registry entries scored and thresholded */
  const services: SearchHit[] = SERVICE_REGISTRY.map((e) => ({
    e,
    score: scoreService(query, e),
  }))
    .filter((r) => r.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(({ e }) => ({
      id: `service:${e.slug}`,
      group: "service" as const,
      title: e.title,
      subtitle: e.department,
      view: "service-detail" as const,
      param: e.slug,
      verified: e.officialSource?.verified ?? false,
    }));

  /* journeys — registry-backed checklists */
  const journeys: SearchHit[] = JOURNEY_ENTRIES.map((e) => ({
    e,
    score:
      scoreService(query, e) +
      (e.journeyId && normalise(query).includes(normalise(e.journeyId.replace(/-apply$/, "")))
        ? 6
        : 0),
  }))
    .filter((r) => r.score >= 3 && r.e.journeyId)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ e }) => ({
      id: `journey:${e.journeyId}`,
      group: "journey" as const,
      title: `${e.title} — step-by-step checklist`,
      subtitle: e.department,
      view: "journey" as const,
      param: e.journeyId ?? undefined,
      verified: e.officialSource?.verified ?? false,
    }));

  /* organisations — verified institutions only */
  const organisations: SearchHit[] = ORGANISATIONS.map((o) => ({
    o,
    score: scoreFields(query, [
      { text: o.name, weight: 8 },
      { text: o.shortName, weight: 6 },
      { text: o.responsibilities.join(" "), weight: 3 },
    ]),
  }))
    .filter((r) => r.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ o }) => ({
      id: `org:${o.id}`,
      group: "organisation" as const,
      title: o.name,
      subtitle: o.website ? "Official website verified" : "No verified website — confirm directly",
      view: "explore" as const,
      param: `org:${o.id}`,
      verified: Boolean(o.website),
    }));

  /* civic topics */
  const topics: SearchHit[] = CIVIC_TOPICS.map((t) => ({
    t,
    score: scoreFields(query, [
      { text: t.name, weight: 7 },
      { text: t.description, weight: 3 },
    ]),
  }))
    .filter((r) => r.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ t }) => ({
      id: `topic:${t.id}`,
      group: "topic" as const,
      title: t.name,
      subtitle: t.description,
      view: "explore" as const,
      param: `topic:${t.id}`,
    }));

  /* public information (in-app views) */
  const information: SearchHit[] = INFO_INDEX.map((i) => ({
    i,
    score: scoreFields(query, [
      { text: i.title, weight: 7 },
      { text: i.description, weight: 3 },
    ]),
  }))
    .filter((r) => r.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ i }) => ({
      id: `info:${i.view}`,
      group: "information" as const,
      title: i.title,
      subtitle: i.description,
      view: i.view as View,
    }));

  /* the signed-in resident's saved items (passed in from the caller) */
  const savedHits: SearchHit[] = saved
    .map((s) => {
      const title = s.title?.trim() || s.itemId;
      const score = scoreFields(query, [
        { text: title, weight: 8 },
        { text: s.kind, weight: 2 },
      ]);
      if (score < 3) return null;
      const hit: SearchHit =
        s.kind === "service"
          ? { id: `saved:${s.kind}:${s.itemId}`, group: "saved", title, subtitle: "Saved service", view: "service-detail", param: s.itemId }
          : s.kind === "journey"
            ? { id: `saved:${s.kind}:${s.itemId}`, group: "saved", title, subtitle: "Saved journey", view: "journey", param: s.itemId }
            : { id: `saved:${s.kind}:${s.itemId}`, group: "saved", title, subtitle: "Saved item", view: "ask-sasi" };
      return hit;
    })
    .filter((h): h is SearchHit => h !== null)
    .slice(0, 4);

  const total =
    services.length +
    journeys.length +
    organisations.length +
    topics.length +
    information.length +
    savedHits.length;

  return {
    query,
    intent,
    services,
    journeys,
    organisations,
    topics,
    information,
    saved: savedHits,
    total,
  };
}

/** Category groupings used by Explore and the services index. */
export function servicesByCategory(): { category: string; label: string; services: ServiceRegistryEntry[] }[] {
  const map = new globalThis.Map<string, ServiceRegistryEntry[]>();
  for (const entry of SERVICE_REGISTRY) {
    const list = map.get(entry.category) ?? [];
    list.push(entry);
    map.set(entry.category, list);
  }
  return [...map.entries()]
    .map(([category, services]) => ({
      category,
      label: CATEGORY_LABELS[category] ?? category,
      services,
    }))
    .sort((a, b) => b.services.length - a.services.length);
}

export { CATEGORY_LABELS };
