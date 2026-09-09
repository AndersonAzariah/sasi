/* ============================================================
   SASI — Core domain types
   Trust-first civic intelligence: every claim carries a status.
   ============================================================ */

export type TrustStatus =
  | "CONFIRMED"
  | "REPORTED"
  | "INFERRED"
  | "UNVERIFIED"
  | "URGENT"
  | "PENDING"
  | "RESOLVED";

export type CaseStatus =
  | "OPEN"
  | "INVESTIGATING"
  | "ACTION_REQUIRED"
  | "WAITING"
  | "RESOLVED"
  | "CLOSED";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type ServiceKey =
  | "water"
  | "electricity"
  | "roads"
  | "waste"
  | "healthcare"
  | "education"
  | "housing"
  | "documents"
  | "safety"
  | "local-government"
  | "other";

export type SourceType =
  | "OFFICIAL"
  | "NEWS"
  | "DOCUMENT"
  | "USER_PROVIDED"
  | "DATABASE"
  | "OTHER";

export type EvidenceType = "PHOTO" | "DOCUMENT" | "LINK" | "NOTE";

export type AIState =
  | "IDLE"
  | "UNDERSTANDING"
  | "RESEARCHING"
  | "CORRELATING"
  | "VERIFYING"
  | "PREPARING_FINDINGS"
  | "WAITING_FOR_APPROVAL"
  | "ACTING"
  | "VERIFYING_RESULT"
  | "COMPLETE"
  | "PAUSED";

export type AgentName =
  | "Investigation Agent"
  | "Research Agent"
  | "Evidence Agent"
  | "Case Agent"
  | "Government Navigator Agent"
  | "Follow-up Agent"
  | "Verification Agent"
  | "Memory Agent"
  | "Permission Manager"
  | "Audit Agent";

export interface SasiLocation {
  province: string;
  municipality: string;
  city: string;
  suburb?: string;
  ward?: string;
  lat?: number;
  lng?: number;
  /** normalized position on the stylized Gauteng map (0-100) */
  mapX?: number;
  mapY?: number;
}

export interface SasiSource {
  id: string;
  title: string;
  publisher: string;
  sourceType: SourceType;
  publishedAt?: string;
  retrievedAt: string;
  verification: TrustStatus;
  confidence: Confidence;
  url?: string;
  snippet?: string;
  isDemo: true;
}

export interface EvidenceItem {
  id: string;
  type: EvidenceType;
  title: string;
  description?: string;
  createdAt: string;
  location?: string;
  caseId?: string;
  verification: TrustStatus;
  /** for PHOTO — key of bundled demo image, rendered as gradient placeholder if absent */
  imageKey?: "burst-pipe" | "dry-tap" | "leak-street" | "reservoir";
  url?: string;
  isDemo: true;
}

export interface Finding {
  id: string;
  title: string;
  status: "INFERRED" | "CONFIRMED" | "UNVERIFIED";
  confidence: Confidence;
  sourcesCount: number;
  evidenceCount: number;
  summary: string;
  nextStep?: string;
  createdAt: string;
  isDemo: true;
}

export type TimelineKind =
  | "user"
  | "ai"
  | "system"
  | "source"
  | "evidence"
  | "finding"
  | "action"
  | "verification";

export interface TimelineEvent {
  id: string;
  at: string; // ISO
  label: string;
  detail?: string;
  kind: TimelineKind;
  agent?: AgentName;
}

export interface ProposedAction {
  id: string;
  title: string;
  rationale: string;
  whatHappens: string;
  infoShared: string;
  recipient: string;
  state: "PROPOSED" | "APPROVED" | "REJECTED" | "IN_PROGRESS" | "COMPLETED";
  createdAt: string;
}

export interface VerificationState {
  state: "PENDING" | "IN_PROGRESS" | "VERIFIED" | "COULD_NOT_VERIFY";
  detail?: string;
  checkedAt?: string;
}

export interface SasiCase {
  id: string;
  ref: string; // CASE-000123
  title: string;
  description: string;
  service: ServiceKey;
  location: SasiLocation;
  status: CaseStatus;
  priority: Priority;
  createdAt: string;
  updatedAt: string;
  aiState: AIState;
  events: TimelineEvent[];
  isDemo: true;
  proposedAction?: ProposedAction;
  verification?: VerificationState;
  impact?: string;
}

export interface Incident {
  id: string;
  ref: string; // INC-0041
  title: string;
  service: ServiceKey;
  location: SasiLocation;
  status: TrustStatus;
  severity: Priority;
  description: string;
  reportedAt: string;
  updatedAt: string;
  sourceIds: string[];
  affectedArea?: string;
  isDemo: true;
}

export type NotificationKind =
  | "CASE"
  | "INVESTIGATION"
  | "ACTION"
  | "UPDATE"
  | "SYSTEM";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  at: string;
  read: boolean;
  caseRef?: string;
}

export type ActivityKind =
  | "CASE_UPDATED"
  | "EVIDENCE_ADDED"
  | "SOURCE_FOUND"
  | "FINDING_GENERATED"
  | "PERMISSION_REQUESTED"
  | "ACTION_APPROVED"
  | "ACTION_COMPLETED"
  | "VERIFICATION_COMPLETED"
  | "INVESTIGATION_STARTED"
  | "CONFIDENCE_UPDATED"
  | "INCIDENT_REPORTED";

export interface ActivityEvent {
  id: string;
  at: string;
  kind: ActivityKind;
  label: string;
  detail?: string;
  caseRef?: string;
}

export type AgentEventKind =
  | "thinking"
  | "tool_started"
  | "tool_completed"
  | "source_found"
  | "source_verified"
  | "evidence_processed"
  | "finding_created"
  | "confidence_updated"
  | "case_created"
  | "action_required"
  | "permission_requested"
  | "action_started"
  | "action_completed"
  | "verification_started"
  | "verification_completed"
  | "completed"
  | "error";

export interface AgentEvent {
  id: string;
  kind: AgentEventKind;
  agent: AgentName;
  at: string;
  message: string;
}

/* ---------- Navigation ---------- */

/* ---------- Ask SASI (LLM chat) ---------- */

export type ChatRole = "user" | "assistant";

/* ---------- VLM photo analysis (report wizard / evidence) ---------- */

export interface EvidenceAnalysis {
  /** factual 1-2 sentence description of the scene */
  what_i_see: string;
  /** one of the ServiceKey-ish guesses ("water", "roads", …) */
  service_guess: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  /** what this photo helps document/prove */
  useful_for: string[];
  /** short observations: hazards, landmarks, infrastructure */
  notable: string[];
  /** caption suitable as an evidence note */
  suggested_caption: string;
  /** one tip to improve the photo as evidence */
  quality_tip: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  at: string; // ISO
  /** UI delivery state — assistant messages arrive as an SSE stream */
  state: "sending" | "streaming" | "done" | "error";
  /** civic refs detected in the message body (CASE-xxxxxx / INC-xxxx) */
  refs?: string[];
  /** suggested follow-up actions rendered as chips under the message */
  actions?: {
    /** reply proposes filing a report → chip deep-links into the report wizard */
    report?: boolean;
  };
}

export type View =
  | "landing"
  | "about"
  | "how-it-works"
  | "services"
  | "service-detail"
  | "security"
  | "privacy"
  | "terms"
  | "login"
  | "signup"
  | "dashboard"
  | "ask-sasi"
  | "investigate"
  | "start-investigation"
  | "report"
  | "cases"
  | "case-detail"
  | "incidents"
  | "incident-detail"
  | "map"
  | "evidence"
  | "activity"
  | "notifications"
  | "settings"
  | "profile"
  | "admin";

/* ---------- AI City briefing (dashboard digest) ---------- */

export type BriefingRisk = "CALM" | "ELEVATED" | "STRAINED" | "CRITICAL";

export interface BriefingSection {
  /** short section heading, e.g. "Water" */
  title: string;
  /** markdown-lite body (bold + "- " bullets, ≤ 45 words) */
  body: string;
  /** civic refs mentioned in this section (CASE-xxxxxx / INC-xxxx) */
  refs: string[];
}

export interface CityBriefing {
  /** one-line headline for the day */
  headline: string;
  risk: BriefingRisk;
  /** 2-4 sections (water, electricity, …) grounded in the user's data */
  sections: BriefingSection[];
  /** 1-3 short "worth watching" items */
  watchlist: string[];
  /** ISO timestamp of generation */
  generatedAt: string;
  /** location the briefing was generated for */
  locationLabel: string;
}

export type PublicView = Extract<
  View,
  | "landing"
  | "about"
  | "how-it-works"
  | "services"
  | "service-detail"
  | "security"
  | "privacy"
  | "terms"
  | "login"
  | "signup"
>;
