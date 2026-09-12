import type {
  AIState,
  CaseStatus,
  Confidence,
  Priority,
  ServiceKey,
  SourceType,
  TrustStatus,
} from "./types";

/* ---------- Service metadata ---------- */

export const SERVICES: Record<
  ServiceKey,
  { label: string; blurb: string }
> = {
  water: {
    label: "Water",
    blurb: "Interruptions, pressure problems, leaks and infrastructure.",
  },
  electricity: {
    label: "Electricity",
    blurb: "Outages, streetlights, prepaid metering and connections.",
  },
  roads: {
    label: "Roads",
    blurb: "Potholes, road damage, signage and traffic infrastructure.",
  },
  waste: {
    label: "Waste",
    blurb: "Collection schedules, illegal dumping and street cleaning.",
  },
  healthcare: {
    label: "Healthcare",
    blurb: "Clinics, hospitals, medicine supply and appointments.",
  },
  education: {
    label: "Education",
    blurb: "Schools, placements, transport and school infrastructure.",
  },
  housing: {
    label: "Housing",
    blurb: "Applications, settlements, RDP housing and tenure.",
  },
  documents: {
    label: "Documents",
    blurb: "IDs, licences, certificates and home affairs services.",
  },
  safety: {
    label: "Safety",
    blurb: "Community safety, emergencies and crime reporting pathways.",
  },
  "local-government": {
    label: "Local Government",
    blurb: "Ward councillors, billing, rates and municipal processes.",
  },
  other: {
    label: "Other",
    blurb: "Anything that does not fit a listed civic service category.",
  },
};

export const CORE_SERVICES: ServiceKey[] = [
  "water",
  "electricity",
  "roads",
  "waste",
  "healthcare",
  "education",
  "housing",
  "documents",
];

/* ---------- Status → visual language ----------
   Color AND text — never color alone. */

export const TRUST_STATUS_META: Record<
  TrustStatus,
  { label: string; color: string; dot: string; ring: string; text: string }
> = {
  CONFIRMED: {
    label: "Confirmed",
    color: "#66bb6a",
    dot: "bg-[#66bb6a]",
    ring: "ring-[#66bb6a]/25",
    text: "text-[#8ee09a]",
  },
  REPORTED: {
    label: "Reported",
    color: "#64b5f6",
    dot: "bg-[#64b5f6]",
    ring: "ring-[#64b5f6]/25",
    text: "text-[#a7d3f9]",
  },
  INFERRED: {
    label: "AI-inferred",
    color: "#e3c567",
    dot: "bg-[#e3c567]",
    ring: "ring-[#e3c567]/25",
    text: "text-[#efe0a8]",
  },
  UNVERIFIED: {
    label: "Unverified",
    color: "#a1a1aa",
    dot: "bg-[#a1a1aa]",
    ring: "ring-[#a1a1aa]/25",
    text: "text-[#d4d4d8]",
  },
  URGENT: {
    label: "Urgent",
    color: "#ef5350",
    dot: "bg-[#ef5350]",
    ring: "ring-[#ef5350]/25",
    text: "text-[#fda4a0]",
  },
  PENDING: {
    label: "Pending",
    color: "#a1a1aa",
    dot: "bg-[#a1a1aa]",
    ring: "ring-[#a1a1aa]/25",
    text: "text-[#d4d4d8]",
  },
  RESOLVED: {
    label: "Resolved",
    color: "#66bb6a",
    dot: "bg-[#66bb6a]",
    ring: "ring-[#66bb6a]/25",
    text: "text-[#8ee09a]",
  },
};

export const CASE_STATUS_META: Record<
  CaseStatus,
  { label: string; color: string; dot: string; text: string }
> = {
  OPEN: { label: "Open", color: "#a1a1aa", dot: "bg-[#a1a1aa]", text: "text-[#d4d4d8]" },
  INVESTIGATING: { label: "Investigating", color: "#64b5f6", dot: "bg-[#64b5f6]", text: "text-[#a7d3f9]" },
  ACTION_REQUIRED: { label: "Action required", color: "#e3c567", dot: "bg-[#e3c567]", text: "text-[#efe0a8]" },
  WAITING: { label: "Waiting", color: "#71717a", dot: "bg-[#71717a]", text: "text-[#a1a1aa]" },
  RESOLVED: { label: "Resolved", color: "#66bb6a", dot: "bg-[#66bb6a]", text: "text-[#8ee09a]" },
  CLOSED: { label: "Closed", color: "#52525b", dot: "bg-[#52525b]", text: "text-[#71717a]" },
};

export const PRIORITY_META: Record<
  Priority,
  { label: string; text: string; dot: string }
> = {
  LOW: { label: "Low", text: "text-[#a1a1aa]", dot: "bg-[#a1a1aa]" },
  MEDIUM: { label: "Medium", text: "text-[#a7d3f9]", dot: "bg-[#64b5f6]" },
  HIGH: { label: "High", text: "text-[#efe0a8]", dot: "bg-[#e3c567]" },
  CRITICAL: { label: "Critical", text: "text-[#fda4a0]", dot: "bg-[#ef5350]" },
};

export const CONFIDENCE_META: Record<
  Confidence,
  { label: string; text: string; dot: string }
> = {
  HIGH: { label: "High", text: "text-[#8ee09a]", dot: "bg-[#8ee09a]" },
  MEDIUM: { label: "Medium", text: "text-[#efe0a8]", dot: "bg-[#e3c567]" },
  LOW: { label: "Low", text: "text-[#d4d4d8]", dot: "bg-zinc-400" },
};

export const AI_STATE_META: Record<
  AIState,
  { label: string; tone: "blue" | "gold" | "green" | "red" | "grey" | "multi" }
> = {
  IDLE: { label: "Idle", tone: "grey" },
  UNDERSTANDING: { label: "Understanding", tone: "blue" },
  RESEARCHING: { label: "Researching", tone: "multi" },
  CORRELATING: { label: "Correlating", tone: "blue" },
  VERIFYING: { label: "Verifying", tone: "gold" },
  PREPARING_FINDINGS: { label: "Preparing findings", tone: "gold" },
  WAITING_FOR_APPROVAL: { label: "Waiting for approval", tone: "gold" },
  ACTING: { label: "Acting", tone: "blue" },
  VERIFYING_RESULT: { label: "Verifying result", tone: "gold" },
  COMPLETE: { label: "Complete", tone: "green" },
  PAUSED: { label: "Paused", tone: "grey" },
};

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  OFFICIAL: "Official",
  NEWS: "News",
  DOCUMENT: "Document",
  USER_PROVIDED: "User provided",
  DATABASE: "Database",
  OTHER: "Other",
};

/* ---------- Dates ---------- */

export function timeAgo(iso: string, now: number = Date.now()): string {
  const diff = now - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

export function locationLabel(
  loc: { city?: string; suburb?: string; province?: string; municipality?: string },
  level: "suburb" | "city" | "full" = "city"
): string {
  if (level === "suburb" && loc.suburb) return `${loc.suburb}, ${loc.city}`;
  if (level === "full") {
    const parts = [loc.suburb, loc.city, loc.province].filter(Boolean);
    return parts.join(", ");
  }
  return loc.city ?? "";
}

/* ---------- misc ---------- */

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function caseProgress(status: CaseStatus): number {
  switch (status) {
    case "OPEN":
      return 8;
    case "INVESTIGATING":
      return 38;
    case "ACTION_REQUIRED":
      return 62;
    case "WAITING":
      return 55;
    case "RESOLVED":
      return 100;
    case "CLOSED":
      return 100;
  }
}

/* ---------- Anonymous browser session ---------- */

const SESSION_KEY = "sasi.sessionId";

/**
 * Stable per-browser session id used to key server-side persistence
 * (chat history, user-created cases, saved location). Created lazily
 * on first use — always after mount, so it never affects hydration.
 */
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    /* private mode / storage blocked — degrade to in-memory session */
    return "sasi-anon";
  }
}
