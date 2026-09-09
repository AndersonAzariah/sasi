"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Link2,
  MapPin,
  MessageSquareQuote,
  ShieldAlert,
  Sparkles,
  StickyNote,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ActivityEvent,
  AppNotification,
  EvidenceItem,
  Finding,
  Incident,
  ProposedAction,
  SasiCase,
  SasiSource,
  TimelineEvent,
} from "@/lib/sasi/types";
import {
  SOURCE_TYPE_LABEL,
  formatDate,
  formatTime,
  locationLabel,
  timeAgo,
} from "@/lib/sasi/utils";
import {
  AIStateChip,
  CaseStatusBadge,
  DemoBadge,
  PriorityBadge,
  SasiPulse,
  ServiceIcon,
  SERVICE_TINT,
  StatusBadge,
  ConfidenceBar,
} from "./primitives";

/* ============================================================
   CASE CARD
   ============================================================ */

export function CaseCard({
  c,
  onOpen,
  compact = false,
}: {
  c: SasiCase;
  onOpen?: () => void;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        "sasi-card sasi-card-interactive group w-full p-4 text-left",
        c.status === "ACTION_REQUIRED" && "border-[#e3c567]/15"
      )}
      aria-label={`Open case ${c.ref}: ${c.title}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]",
              SERVICE_TINT[c.service]
            )}
          >
            <ServiceIcon service={c.service} className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-medium text-white group-hover:text-white">
              {c.title}
            </p>
            <p className="mt-0.5 font-mono text-[10px] tracking-wider text-zinc-600">
              {c.ref} · {locationLabel(c.location, "city")}
            </p>
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-300" />
      </div>

      {!compact && (
        <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-relaxed text-zinc-500">
          {c.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <CaseStatusBadge status={c.status} />
        <PriorityBadge priority={c.priority} />
        {c.status !== "RESOLVED" && c.status !== "CLOSED" && (
          <AIStateChip state={c.aiState} />
        )}
        <DemoBadge label="DEMO" />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5 text-[11px] text-zinc-600">
        <span>Updated {timeAgo(c.updatedAt)}</span>
        {c.status === "ACTION_REQUIRED" ? (
          <span className="text-[#efe0a8]">Approval needed →</span>
        ) : (
          <span>{c.events.length} events</span>
        )}
      </div>
    </button>
  );
}

/* ============================================================
   INCIDENT CARD
   ============================================================ */

export function IncidentCard({
  incident,
  onOpen,
}: {
  incident: Incident;
  onOpen?: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="sasi-card sasi-card-interactive group w-full min-w-0 p-4 text-left"
      aria-label={`Open incident ${incident.ref}: ${incident.title}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]",
              SERVICE_TINT[incident.service]
            )}
          >
            <ServiceIcon service={incident.service} className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13.5px] font-medium text-white">
              {incident.title}
            </p>
            <p className="mt-0.5 font-mono text-[10px] tracking-wider text-zinc-600">
              {incident.ref} · {locationLabel(incident.location, "city")}
            </p>
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-600 group-hover:text-zinc-300" />
      </div>

      <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-relaxed text-zinc-500">
        {incident.description}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={incident.status} />
        <PriorityBadge priority={incident.severity} />
        <DemoBadge label="DEMO" />
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5 text-[11px] text-zinc-600">
        <span>Updated {timeAgo(incident.updatedAt)}</span>
        <span>{incident.sourceIds.length} sources</span>
      </div>
    </button>
  );
}

/* ============================================================
   SOURCE CARD
   ============================================================ */

export function SourceCard({ source }: { source: SasiSource }) {
  return (
    <div className="sasi-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[0.12em]",
              source.sourceType === "OFFICIAL"
                ? "bg-[#66bb6a]/10 text-[#8ee09a]"
                : source.sourceType === "NEWS"
                  ? "bg-[#64b5f6]/10 text-[#a7d3f9]"
                  : source.sourceType === "USER_PROVIDED"
                    ? "bg-[#e3c567]/10 text-[#efe0a8]"
                    : "bg-white/6 text-zinc-400"
            )}
          >
            {SOURCE_TYPE_LABEL[source.sourceType].toUpperCase()}
          </span>
          <span className="text-[11px] text-zinc-500">{source.publisher}</span>
        </div>
        <StatusBadge status={source.verification} size="sm" />
      </div>
      <p className="mt-2 text-[13px] font-medium leading-snug text-zinc-100">
        {source.title}
      </p>
      {source.snippet && (
        <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-zinc-500">
          {source.snippet}
        </p>
      )}
      <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-600">
        <span>
          {source.publishedAt ? `${formatDate(source.publishedAt)} · ` : ""}
          retrieved {timeAgo(source.retrievedAt)}
        </span>
        {source.url && (
          <span className="inline-flex items-center gap-1 text-zinc-500">
            <ExternalLink className="h-3 w-3" /> Open
          </span>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   FINDING CARD — never represents inference as fact
   ============================================================ */

export function FindingCard({ finding }: { finding: Finding }) {
  const statusMeta =
    finding.status === "CONFIRMED"
      ? { label: "CONFIRMED", cls: "text-[#8ee09a] border-[#66bb6a]/25 bg-[#66bb6a]/8" }
      : finding.status === "INFERRED"
        ? { label: "AI-INFERRED", cls: "text-[#efe0a8] border-[#e3c567]/25 bg-[#e3c567]/8" }
        : { label: "UNVERIFIED", cls: "text-zinc-400 border-white/8 bg-white/[0.03]" };
  return (
    <SasiPulse
      color={finding.status === "INFERRED" ? "gold" : "green"}
      className="sasi-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-[0.1em]",
            statusMeta.cls
          )}
        >
          <Sparkles className="h-3 w-3" aria-hidden />
          {statusMeta.label}
        </span>
        <span className="text-[11px] text-zinc-600">
          {timeAgo(finding.createdAt)}
        </span>
      </div>
      <p className="mt-2.5 text-[14px] font-medium leading-snug text-white">
        {finding.title}
      </p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-400">
        {finding.summary}
      </p>
      <div className="mt-3">
        <ConfidenceBar confidence={finding.confidence} />
      </div>
      <div className="mt-3 flex items-center gap-4 border-t border-white/5 pt-2.5 text-[11px] text-zinc-500">
        <span>{finding.sourcesCount} sources</span>
        <span>{finding.evidenceCount} evidence items</span>
      </div>
      {finding.nextStep && (
        <div className="mt-3 rounded-lg border border-white/8 bg-white/[0.02] p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            <ArrowUpRight className="h-3 w-3" /> Recommended next step
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-300">
            {finding.nextStep}
          </p>
        </div>
      )}
    </SasiPulse>
  );
}

/* ============================================================
   EVIDENCE CARD
   ============================================================ */

const EVIDENCE_PLACEHOLDER: Record<string, { from: string; to: string }> = {
  "dry-tap": { from: "#1a2530", to: "#0d1117" },
  "leak-street": { from: "#1c1f26", to: "#0d0f13" },
  "burst-pipe": { from: "#241d1a", to: "#100d0c" },
  reservoir: { from: "#16211d", to: "#0c100e" },
};

export function EvidenceThumb({
  item,
  className,
}: {
  item: EvidenceItem;
  className?: string;
}) {
  const [imgOk, setImgOk] = useState(true);
  if (item.type === "PHOTO") {
    /* user-attached, AI-analysed photos: the image itself never persists —
       render an honest placeholder instead of a stand-in demo photo */
    if (item.id.startsWith("EVD-user-")) {
      return (
        <div
          className={cn(
            "relative flex items-center justify-center overflow-hidden rounded-lg border border-[#e3c567]/15",
            className
          )}
          style={{
            background:
              "linear-gradient(135deg, rgba(227,197,103,0.10), rgba(5,5,5,0.9) 55%, rgba(100,181,246,0.08))",
          }}
          role="img"
          aria-label={`User photo analysed by SASI: ${item.title}`}
        >
          <div className="flex flex-col items-center gap-1.5">
            <Camera className="h-5 w-5 text-[#e3c567]/70" aria-hidden />
            <span className="font-mono text-[8.5px] font-semibold tracking-[0.18em] text-zinc-500">
              YOUR PHOTO · AI-READ
            </span>
          </div>
        </div>
      );
    }
    const ph = EVIDENCE_PLACEHOLDER[item.imageKey ?? "leak-street"];
    return (
      <div
        className={cn("relative overflow-hidden rounded-lg border border-white/8", className)}
        style={{ background: `linear-gradient(135deg, ${ph.from}, ${ph.to})` }}
      >
        {imgOk ? (
          <img
            src={`/demo/${item.imageKey ?? "leak-street"}.jpg`}
            alt={item.title}
            className="h-full w-full object-cover opacity-90"
            onError={() => setImgOk(false)}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="h-5 w-5 text-zinc-600" aria-hidden />
          </div>
        )}
        <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-px font-mono text-[8px] font-semibold tracking-widest text-[#e3c567]">
          DEMO
        </span>
      </div>
    );
  }
  const Icon =
    item.type === "DOCUMENT" ? FileText : item.type === "LINK" ? Link2 : StickyNote;
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg border border-white/8 bg-white/[0.02]",
        className
      )}
    >
      <Icon className="h-5 w-5 text-zinc-500" aria-hidden />
    </div>
  );
}

export function EvidenceCard({
  item,
  onOpen,
  showCase = false,
}: {
  item: EvidenceItem;
  onOpen?: () => void;
  showCase?: boolean;
}) {
  return (
    <button
      onClick={onOpen}
      className="sasi-card sasi-card-interactive w-full min-w-0 p-3 text-left"
      aria-label={`Evidence: ${item.title}`}
    >
      <EvidenceThumb item={item} className="aspect-[16/10] w-full" />
      <p className="mt-2.5 truncate text-[13px] font-medium text-white">
        {item.title}
      </p>
      {item.description && (
        <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-zinc-500">
          {item.description}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[0.12em] text-zinc-400">
          {item.type}
        </span>
        {item.id.startsWith("EVD-user-") && (
          <span className="rounded border border-[#e3c567]/30 bg-[#e3c567]/[0.08] px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[0.12em] text-[#e3c567]">
            AI-READ
          </span>
        )}
        <StatusBadge status={item.verification} size="sm" />
        {showCase && item.caseId && (
          <span className="font-mono text-[10px] text-zinc-600">{item.caseId}</span>
        )}
      </div>
      <p className="mt-2 text-[11px] text-zinc-600">
        {formatDate(item.createdAt)} · {item.location ?? "No location"}
      </p>
    </button>
  );
}

/* ============================================================
   TIMELINE RAIL — investigation / audit trail
   ============================================================ */

const KIND_DOT: Record<TimelineEvent["kind"], string> = {
  user: "bg-white",
  ai: "bg-[#e3c567]",
  system: "bg-zinc-500",
  source: "bg-[#64b5f6]",
  evidence: "bg-[#66bb6a]",
  finding: "bg-[#e3c567]",
  action: "bg-[#64b5f6]",
  verification: "bg-[#66bb6a]",
};

export function TimelineRail({
  events,
  live = false,
  className,
}: {
  events: TimelineEvent[];
  live?: boolean;
  className?: string;
}) {
  return (
    <ol className={cn("space-y-0", className)} aria-label="Investigation timeline">
      {events.map((ev, i) => {
        const last = i === events.length - 1;
        return (
          <li key={ev.id} className={cn("sasi-rail pb-4", last && "!before:hidden")}>
            <div className="flex gap-3.5">
              <span
                className={cn(
                  "relative z-10 mt-[5px] h-[11px] w-[11px] shrink-0 rounded-full border-2 border-[#101112]",
                  KIND_DOT[ev.kind],
                  live && last && "sasi-breathe"
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-[13px] font-medium text-zinc-100">{ev.label}</p>
                  <span className="font-mono text-[10.5px] text-zinc-600">
                    {formatTime(ev.at)}
                  </span>
                </div>
                {ev.detail && (
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-zinc-500">
                    {ev.detail}
                  </p>
                )}
                {ev.agent && (
                  <p className="mt-1 font-mono text-[10px] tracking-wide text-zinc-700">
                    {ev.agent}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ============================================================
   ACTION / PERMISSION CARD — human approval gate
   ============================================================ */

export function ActionApprovalCard({
  action,
  onApprove,
  onReject,
  onEdit,
  busy = false,
}: {
  action: ProposedAction;
  onApprove?: () => void;
  onReject?: () => void;
  onEdit?: () => void;
  busy?: boolean;
}) {
  if (action.state === "COMPLETED") {
    return (
      <div className="sasi-card p-4">
        <p className="flex items-center gap-2 text-[13px] font-medium text-[#8ee09a]">
          <CheckCircle2 className="h-4 w-4" /> Action completed
        </p>
        <p className="mt-1 text-[12.5px] text-zinc-500">{action.title}</p>
        <p className="mt-2 font-mono text-[10px] tracking-wide text-zinc-600">
          RECIPIENT: {action.recipient}
        </p>
      </div>
    );
  }
  const decided = action.state === "APPROVED" || action.state === "REJECTED" || action.state === "IN_PROGRESS";
  return (
    <div
      className={cn(
        "sasi-card p-4",
        action.state === "PROPOSED" && "border-[#e3c567]/20"
      )}
      role="region"
      aria-label="Approval required"
    >
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-[#e3c567]" aria-hidden />
        <p className="text-[13px] font-semibold text-white">Approval required</p>
        <DemoBadge label="DEMO" className="ml-auto" />
      </div>
      <p className="mt-2.5 text-[14px] font-medium leading-snug text-zinc-100">
        {action.title}
      </p>

      <dl className="mt-3 space-y-2.5 text-[12.5px] leading-relaxed">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Why SASI recommends this
          </dt>
          <dd className="mt-0.5 text-zinc-400">{action.rationale}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            What will happen
          </dt>
          <dd className="mt-0.5 text-zinc-400">{action.whatHappens}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Information shared
          </dt>
          <dd className="mt-0.5 text-zinc-400">{action.infoShared}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Recipient
          </dt>
          <dd className="mt-0.5 text-zinc-400">{action.recipient}</dd>
        </div>
      </dl>

      {!decided ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={onApprove}
            disabled={busy}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-[12.5px] font-medium text-black transition hover:bg-zinc-200 active:scale-[0.98] disabled:opacity-60"
          >
            <BadgeCheck className="h-3.5 w-3.5" /> Approve
          </button>
          <button
            onClick={onEdit}
            className="inline-flex h-8.5 items-center rounded-lg border border-white/10 px-3.5 py-2 text-[12.5px] font-medium text-zinc-300 transition hover:border-white/20 hover:text-white"
          >
            Edit
          </button>
          <button
            onClick={onReject}
            disabled={busy}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-lg border border-white/10 px-3.5 py-2 text-[12.5px] font-medium text-zinc-400 transition hover:border-[#ef5350]/40 hover:text-[#fda4a0]"
          >
            <XCircle className="h-3.5 w-3.5" /> Reject
          </button>
          <span className="text-[11px] text-zinc-600">
            Nothing is submitted without your approval.
          </span>
        </div>
      ) : action.state === "REJECTED" ? (
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-zinc-500">
          <XCircle className="h-3.5 w-3.5" /> Rejected — SASI will not proceed.
        </p>
      ) : (
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-[#a7d3f9]">
          <CircleDashed className="h-3.5 w-3.5 animate-spin" /> Approved — executing…
        </p>
      )}
    </div>
  );
}

/* ============================================================
   VERIFICATION CARD
   ============================================================ */

export function VerificationCard({
  verification,
}: {
  verification: NonNullable<SasiCase["verification"]>;
}) {
  const map = {
    PENDING: { icon: CircleDashed, text: "PENDING VERIFICATION", cls: "text-zinc-400", detail: verification.detail ?? "Verification has not started yet." },
    IN_PROGRESS: { icon: CircleDashed, text: "VERIFYING RESULT", cls: "text-[#efe0a8]", detail: verification.detail ?? "SASI is checking whether the action actually happened." },
    VERIFIED: { icon: CheckCircle2, text: "VERIFIED", cls: "text-[#8ee09a]", detail: verification.detail ?? "The outcome was verified." },
    COULD_NOT_VERIFY: { icon: XCircle, text: "COULD NOT VERIFY", cls: "text-[#fda4a0]", detail: verification.detail ?? "SASI could not independently confirm the outcome." },
  } as const;
  const m = map[verification.state];
  const Icon = m.icon;
  return (
    <div className="sasi-card p-4">
      <p className={cn("flex items-center gap-2 text-[12px] font-semibold tracking-[0.12em]", m.cls)}>
        <Icon className={cn("h-4 w-4", verification.state === "IN_PROGRESS" && "animate-spin")} />
        {m.text}
      </p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500">{m.detail}</p>
      {verification.checkedAt && (
        <p className="mt-2 font-mono text-[10px] text-zinc-600">
          CHECKED {formatDate(verification.checkedAt).toUpperCase()}
        </p>
      )}
    </div>
  );
}

/* ============================================================
   ACTIVITY ROW
   ============================================================ */

const ACTIVITY_ICON: Record<ActivityEvent["kind"], typeof CheckCircle2> = {
  CASE_UPDATED: MessageSquareQuote,
  EVIDENCE_ADDED: ImageIcon,
  SOURCE_FOUND: Link2,
  FINDING_GENERATED: Sparkles,
  PERMISSION_REQUESTED: ShieldAlert,
  ACTION_APPROVED: BadgeCheck,
  ACTION_COMPLETED: CheckCircle2,
  VERIFICATION_COMPLETED: CheckCircle2,
  INVESTIGATION_STARTED: Sparkles,
  CONFIDENCE_UPDATED: Sparkles,
  INCIDENT_REPORTED: FileText,
};

export function ActivityRow({ event }: { event: ActivityEvent }) {
  const Icon = ACTIVITY_ICON[event.kind] ?? FileText;
  return (
    <div className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.02]">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/8 bg-white/[0.03]">
        <Icon className="h-3 w-3 text-zinc-400" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-zinc-200">
          {event.label}
          {event.caseRef && (
            <span className="ml-2 font-mono text-[10px] tracking-wider text-zinc-600">
              {event.caseRef}
            </span>
          )}
        </p>
        {event.detail && (
          <p className="mt-0.5 truncate text-[12px] text-zinc-500">{event.detail}</p>
        )}
      </div>
      <span className="shrink-0 font-mono text-[10.5px] text-zinc-600">
        {timeAgo(event.at)}
      </span>
    </div>
  );
}

/* ============================================================
   NOTIFICATION ROW
   ============================================================ */

export function NotificationRow({
  n,
  onOpen,
  onViewOnMap,
}: {
  n: AppNotification;
  onOpen?: () => void;
  /** set when the notification carries a mappable ref — adds a quiet gold
      "View on map" affordance (visible on hover/focus-within, always on
      touch) that focuses the civic map without leaving the list */
  onViewOnMap?: () => void;
}) {
  const tone =
    n.kind === "ACTION"
      ? "bg-[#e3c567]"
      : n.kind === "INVESTIGATION"
        ? "bg-[#e3c567]"
        : n.kind === "CASE"
          ? "bg-[#64b5f6]"
          : n.kind === "UPDATE"
            ? "bg-zinc-400"
            : "bg-[#66bb6a]";
  return (
    <button
      onClick={onOpen}
      className={cn(
        "sasi-ntf-row group/ntf flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-white/[0.03]",
        !n.read && "bg-white/[0.015]"
      )}
    >
      <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", tone, !n.read && "sasi-breathe")} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className={cn("truncate text-[13px]", n.read ? "font-normal text-zinc-400" : "font-medium text-white")}>
              {n.title}
            </span>
            {n.live && (
              <span className="sasi-live-tag shrink-0" aria-label="Live event">
                LIVE
              </span>
            )}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-zinc-600">
            {timeAgo(n.at)}
          </span>
        </span>
        <span className="mt-0.5 line-clamp-2 block text-[12px] leading-relaxed text-zinc-500">
          {n.body}
        </span>
        {onViewOnMap && (
          <span className="sasi-ntf-actions mt-1 block">
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation(); // don't trigger the row's open-case click
                onViewOnMap();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onViewOnMap();
                }
              }}
              className="sasi-chip-map-gold inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium"
              aria-label={`Show ${n.caseRef} on the civic map`}
            >
              <MapPin className="h-3 w-3" aria-hidden />
              View on map
            </span>
          </span>
        )}
      </span>
    </button>
  );
}
