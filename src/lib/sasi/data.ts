import type {
  ActivityEvent,
  AppNotification,
  EvidenceItem,
  Finding,
  Incident,
  SasiCase,
  SasiSource,
  ServiceKey,
} from "./types";

/* ============================================================
   SASI data module — USER-GENERATED ONLY.

   Every list below is intentionally EMPTY: SASI no longer ships
   a fabricated demo dataset. Cases, evidence, findings, sources,
   incidents, notifications and activity on the site are created
   exclusively by the resident (reports, chat, evidence uploads,
   investigations and briefings grounded in that material).

   What remains here are neutral reference catalogues only —
   real South African municipality names, the service directory
   keys and report problem options. None of them are "results".
   ============================================================ */

/** Session clock anchor (module-load time). Some views import
 *  DEMO_NOW for relative-time formatting — it is a clock, not content. */
const NOW = Date.now();

export const DEMO_NOW = new Date(NOW).toISOString();

/** Neutral session identity placeholder — no fabricated persona.
 *  Real account identity is user-generated; until the resident
 *  provides one, the app refers to them plainly as "You".
 *  memberSince anchors to the session start (honest for an
 *  anonymous, browser-local session). */
export const DEMO_USER = {
  name: "You",
  firstName: "You",
  email: "",
  memberSince: new Date(NOW).toISOString().slice(0, 10),
  location: {
    province: "Gauteng",
    municipality: "City of Johannesburg",
    city: "Johannesburg",
    suburb: "",
    ward: "",
  },
  isDemo: true as const,
};

/* ---------- SOURCES (user-generated only) ---------- */

/** Public-source records attached to cases. No feed, publisher,
 *  notice or snippet is fabricated by the app. */
export const SOURCES: SasiSource[] = [];

/* ---------- CASES (user-generated only) ---------- */

/** Cases are created exclusively via submitReport() from the
 *  resident's own reports, then restored from their session data
 *  (SQLite per session id + the on-device snapshot). */
export const CASES: SasiCase[] = [];

/* ---------- FINDINGS (per case, user-generated only) ---------- */

/** Findings are written by the investigation flow for cases the
 *  resident created. No pre-seeded findings exist. */
export const FINDINGS: Record<string, Finding[]> = {};

/* ---------- EVIDENCE (user-generated only) ---------- */

/** Evidence items are uploaded/captured by the resident (photos,
 *  notes, links) or produced by SASI's AI reading of their photos.
 *  No demo evidence exists. */
export const EVIDENCE: EvidenceItem[] = [];

/* ---------- INCIDENTS (user-generated only) ---------- */

/** City incidents are no longer simulated. The map and incidents
 *  surfaces fill up only as residents report real issues. */
export const INCIDENTS: Incident[] = [];

/* ---------- NOTIFICATIONS (user-generated only) ---------- */

/** Notifications are raised only by real events on the resident's
 *  own data (report received, investigation complete, action
 *  approved, briefing written). Nothing is pre-seeded. */
export const NOTIFICATIONS: AppNotification[] = [];

/* ---------- ACTIVITY (user-generated only) ---------- */

/** The activity ledger records events the resident actually
 *  triggered. It starts empty and grows with their work. */
export const ACTIVITY: ActivityEvent[] = [];

/* ---------- Reference data (neutral catalogues — not results) ---------- */

/** Real Gauteng municipalities — a neutral pick-list, not data. */
export const GAUTENG_MUNICIPALITIES = [
  "City of Johannesburg",
  "City of Tshwane",
  "Ekurhuleni",
  "Sedibeng",
  "West Rand",
];

/** Neutral report-wizard option catalogue per service. */
export const SERVICE_REPORT_OPTIONS: Record<string, string[]> = {
  water: [
    "No water",
    "Low pressure",
    "Burst pipe",
    "Leak",
    "Dirty / discoloured water",
    "Infrastructure damage",
    "Other",
  ],
};

/* ---------- lookups (safe on empty data) ---------- */

export function sourcesByIds(ids: string[]): SasiSource[] {
  return SOURCES.filter((s) => ids.includes(s.id));
}

export function evidenceForCase(caseId: string): EvidenceItem[] {
  return EVIDENCE.filter((e) => e.caseId === caseId);
}

export function sourcesForCase(caseId: string): SasiSource[] {
  /* Sources were previously fabricated per demo case id. SASI no
     longer invents sources — this stays exported for consumers and
     returns an honest empty list. (Real source records attach to
     cases as residents provide them.) */
  return caseId ? [] : [];
}

export function caseByRef(ref: string): SasiCase | undefined {
  return CASES.find((c) => c.ref === ref);
}

export const POPULAR_SERVICES: ServiceKey[] = [
  "water",
  "electricity",
  "roads",
  "waste",
  "healthcare",
  "education",
  "housing",
  "documents",
];
