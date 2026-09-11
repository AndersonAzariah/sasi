"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CircleDot,
  ClipboardCopy,
  Flag,
  FolderLock,
  History,
  Image as ImageIcon,
  Link2,
  MapPin,
  Plus,
  Printer,
  Search,
  Share2,
  ShieldAlert,
  X,
} from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { useT } from "@/lib/sasi/i18n";
import { DEMO_NOW, evidenceForCase, sourcesForCase } from "@/lib/sasi/data";
import {
  SERVICES,
  caseProgress,
  formatDate,
  formatDateTime,
  locationLabel,
  timeAgo,
} from "@/lib/sasi/utils";
import type { CaseStatus, TimelineEvent } from "@/lib/sasi/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ActionApprovalCard,
  EvidenceCard,
  FindingCard,
  SourceCard,
  TimelineRail,
  VerificationCard,
} from "@/components/sasi/domain";
import {
  AIStateChip,
  CaseStatusBadge,
  EmptyState,
  GhostButton,
  PriorityBadge,
  SectionLabel,
  ServiceIcon,
  SERVICE_TINT,
} from "@/components/sasi/primitives";

const NOW_MS = new Date(DEMO_NOW).getTime();

const TABS: { key: string; labelKey: string }[] = [
  { key: "overview", labelKey: "cd.tab.overview" },
  { key: "investigation", labelKey: "cd.tab.investigation" },
  { key: "evidence", labelKey: "cd.tab.evidence" },
  { key: "sources", labelKey: "cd.tab.sources" },
  { key: "actions", labelKey: "cd.tab.actions" },
  { key: "activity", labelKey: "cd.tab.activity" },
];

const PROGRESS_HINT_KEY: Record<CaseStatus, string> = {
  OPEN: "cd.hint.OPEN",
  INVESTIGATING: "cd.hint.INVESTIGATING",
  ACTION_REQUIRED: "cd.hint.ACTION_REQUIRED",
  WAITING: "cd.hint.WAITING",
  RESOLVED: "cd.hint.RESOLVED",
  CLOSED: "cd.hint.CLOSED",
};

const CAN_DO_KEYS = ["cd.can.1", "cd.can.2", "cd.can.3", "cd.can.4"];

const CANNOT_DO_KEYS = ["cd.cannot.1", "cd.cannot.2", "cd.cannot.3", "cd.cannot.4"];

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

function TabFade({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}

function FactRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="flex shrink-0 items-center gap-2 text-[12px] text-zinc-500">
        <span className="flex h-3.5 w-3.5 items-center justify-center text-zinc-600">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="min-w-0 truncate text-right text-[12.5px] font-medium text-zinc-200">
        {children}
      </dd>
    </div>
  );
}

/** Activity-tab rail — like TimelineRail but with full per-event timestamps. */
function AuditRail({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="space-y-0" aria-label="Full case activity">
      {events.map((ev, i) => {
        const last = i === events.length - 1;
        return (
          <li key={ev.id} className={cn("sasi-rail pb-4", last && "!before:hidden")}>
            <div className="flex gap-3.5">
              <span
                className={cn(
                  "relative z-10 mt-[5px] h-[11px] w-[11px] shrink-0 rounded-full border-2 border-[#101112]",
                  KIND_DOT[ev.kind]
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-[13px] font-medium text-zinc-100">
                    {ev.label}
                  </p>
                  <span className="font-mono text-[10.5px] text-zinc-600">
                    {formatDateTime(ev.at)}
                  </span>
                </div>
                {ev.detail && (
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-zinc-500">
                    {ev.detail}
                  </p>
                )}
                <p className="mt-1 flex flex-wrap items-center gap-2">
                  {ev.agent && (
                    <span className="font-mono text-[10px] tracking-wide text-zinc-700">
                      {ev.agent}
                    </span>
                  )}
                  <span className="rounded bg-white/[0.04] px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                    {ev.kind}
                  </span>
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function CaseDetailView() {
  const navigate = useSasiStore((s) => s.navigate);
  const param = useSasiStore((s) => s.param);
  const activeCaseId = useSasiStore((s) => s.activeCaseId);
  const cases = useSasiStore((s) => s.cases);
  const findings = useSasiStore((s) => s.findings);
  const startInvestigationFor = useSasiStore((s) => s.startInvestigationFor);
  const approveAction = useSasiStore((s) => s.approveAction);
  const rejectAction = useSasiStore((s) => s.rejectAction);
  const setActionState = useSasiStore((s) => s.setActionState);
  const setVerification = useSasiStore((s) => s.setVerification);
  const setCaseAIState = useSasiStore((s) => s.setCaseAIState);
  const addCaseEvent = useSasiStore((s) => s.addCaseEvent);
  const { toast } = useToast();
  const t = useT();

  const [tab, setTab] = useState("overview");
  const [busy, setBusy] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  /* Escape closes the share popover (keyboard a11y) */
  useEffect(() => {
    if (!shareOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShareOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shareOpen]);

  /* simulated verify-loop timers — cleaned up on unmount / case change */
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);
  useEffect(() => {
    return () => {
      for (const t of timersRef.current) clearTimeout(t);
      timersRef.current = [];
    };
  }, [clearTimers]);

  const activeCase = useMemo(() => {
    if (param) {
      const byParam = cases.find((c) => c.ref === param || c.id === param);
      if (byParam) return byParam;
    }
    return cases.find((c) => c.id === activeCaseId);
  }, [cases, param, activeCaseId]);

  const caseId = activeCase?.id ?? null;

  /* reset local UI state when the active case changes (render-time adjustment) */
  const [prevCaseId, setPrevCaseId] = useState(caseId);
  if (prevCaseId !== caseId) {
    setPrevCaseId(caseId);
    setTab("overview");
    setBusy(false);
    setShareOpen(false);
    setCopied(false);
  }

  const caseFindings = useMemo(
    () => (activeCase ? (findings[activeCase.id] ?? []) : []),
    [findings, activeCase]
  );
  const caseEvidence = useMemo(
    () => (activeCase ? evidenceForCase(activeCase.id) : []),
    [activeCase]
  );
  const caseSources = useMemo(
    () => (activeCase ? sourcesForCase(activeCase.id) : []),
    [activeCase]
  );
  const officialCount = caseSources.filter((s) => s.sourceType === "OFFICIAL").length;

  /* plain-text case brief for the clipboard (kept above any early return) */
  const caseSummaryText = useMemo(() => {
    if (!activeCase) return "";
    const lines = [
      `SASI CASE BRIEF — ${activeCase.ref}`,
      activeCase.title,
      `Status: ${activeCase.status} · Priority: ${activeCase.priority} · AI: ${activeCase.aiState}`,
      `Location: ${locationLabel(activeCase.location, "full")}`,
      `Created: ${formatDateTime(activeCase.createdAt)} · Updated: ${formatDateTime(activeCase.updatedAt)}`,
      "",
      "Summary",
      activeCase.description,
    ];
    if (activeCase.impact) lines.push("", "Impact", activeCase.impact);
    if (caseFindings.length) {
      lines.push("", `Findings (${caseFindings.length})`);
      for (const f of caseFindings)
        lines.push(`- ${f.title} (${f.status}, ${f.confidence}) — ${f.summary}`);
    }
    lines.push(
      "",
      `Sources: ${caseSources.length} (${officialCount} official) · Evidence: ${caseEvidence.length} item(s)`,
      "",
      "Generated by SASI — South African Service Intelligence (not a government submission)."
    );
    return lines.join("\n");
  }, [activeCase, caseFindings, caseSources, caseEvidence, officialCount]);

  const handleApprove = useCallback(() => {
    if (!activeCase?.proposedAction) return;
    if (activeCase.proposedAction.state !== "PROPOSED" || busy) return;
    const id = activeCase.id;
    setBusy(true);
    approveAction(id);
    toast({
      title: "Action approved",
      description: "SASI is executing. Verification of the outcome follows automatically.",
    });
    timersRef.current.push(
      setTimeout(() => {
        setActionState(id, "IN_PROGRESS");
      }, 2500),
      setTimeout(() => {
        setActionState(id, "COMPLETED");
        setVerification(id, { state: "IN_PROGRESS" });
      }, 5000),
      setTimeout(() => {
        setVerification(id, {
          state: "VERIFIED",
          detail: "Verification: utility notice updated (simulated).",
          checkedAt: new Date().toISOString(),
        });
        addCaseEvent(id, {
          id: `ev-verified-${Date.now()}`,
          at: new Date().toISOString(),
          label: "Outcome verified",
          detail:
            "SASI matched a utility notice update against your case (simulated).",
          kind: "verification",
          agent: "Verification Agent",
        });
        setCaseAIState(id, "COMPLETE");
        setBusy(false);
      }, 8000)
    );
  }, [
    activeCase,
    busy,
    approveAction,
    setActionState,
    setVerification,
    addCaseEvent,
    setCaseAIState,
    toast,
  ]);

  const handleReject = useCallback(() => {
    if (!activeCase?.proposedAction) return;
    if (activeCase.proposedAction.state !== "PROPOSED" || busy) return;
    rejectAction(activeCase.id);
    toast({
      title: "Action rejected",
      description: "SASI will not proceed. You can revisit this action later.",
    });
  }, [activeCase, busy, rejectAction, toast]);

  const handleEdit = () =>
    toast({
      title: "Draft editing is coming soon",
      description: "Prepared actions cannot be edited yet.",
    });

  const handleAddEvidence = () =>
    toast({
      title: "Evidence upload is coming soon",
      description: "Uploading new evidence is not supported yet.",
    });

  /* ---------- Not found ---------- */
  if (!activeCase) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <EmptyState
          icon={FolderLock}
          title={t("cd.notfound.title")}
          description={
            "No case with this reference is in your record. It may have been cleared, or the reference is incorrect."
          }
          action={
            <GhostButton onClick={() => navigate("cases")}>
              {t("cd.back")}
            </GhostButton>
          }
        />
      </div>
    );
  }

  const c = activeCase;
  const progress = caseProgress(c.status);
  const aiActive =
    c.aiState !== "IDLE" && c.aiState !== "COMPLETE" && c.aiState !== "PAUSED";

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(caseSummaryText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
      toast({
        title: "Case summary copied",
        description: "A plain-text brief is on your clipboard.",
      });
    } catch {
      toast({
        title: "Could not copy",
        description: "Your browser blocked clipboard access.",
      });
    }
  };

  const printCase = () => {
    setShareOpen(false);
    toast({
      title: "Opening the print dialog",
      description: "Choose “Save as PDF” to export the case sheet.",
    });
    window.setTimeout(() => window.print(), 250);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ---------- Header ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            onClick={() => navigate("cases")}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-500 transition-colors hover:text-white"
            aria-label={t("cd.back-aria")}
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            {t("cd.back")}
          </button>
          <p className="mt-3 font-mono text-[11px] tracking-[0.14em] text-zinc-500">
            {c.ref}
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-white">
            {c.title}
          </h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-zinc-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              {locationLabel(c.location, "full")}
              {c.location.ward ? ` · ${c.location.ward}` : ""}
            </span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <CaseStatusBadge status={c.status} />
            <PriorityBadge priority={c.priority} />
            <AIStateChip state={c.aiState} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <GhostButton
              onClick={() => setShareOpen((o) => !o)}
              aria-expanded={shareOpen}
              aria-haspopup="dialog"
            >
              <Share2 className="h-3.5 w-3.5" aria-hidden />
              {t("cd.share")}
            </GhostButton>
            {shareOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShareOpen(false)}
                  aria-hidden
                />
                <div
                  role="dialog"
                  aria-label={t("cd.share-dialog")}
                  className="sasi-card absolute right-0 top-11 z-50 w-64 bg-[#0d0e10] p-2 shadow-xl shadow-black/50"
                >
                  <button
                    onClick={copySummary}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-zinc-200 transition-colors hover:bg-white/[0.05] hover:text-white"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 shrink-0 text-[#66bb6a]" aria-hidden />
                    ) : (
                      <ClipboardCopy className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                    )}
                    {copied ? t("cd.share.copied") : t("cd.share.copy")}
                  </button>
                  <button
                    onClick={printCase}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-zinc-200 transition-colors hover:bg-white/[0.05] hover:text-white"
                  >
                    <Printer className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                    {t("cd.share.print")}
                  </button>
                  <p className="mt-1 border-t border-white/5 px-2.5 pb-1 pt-2 text-[11px] leading-relaxed text-zinc-600">
                    Direct link sharing is not available yet.
                  </p>
                </div>
              </>
            )}
          </div>

          {c.status === "INVESTIGATING" && (
            <GhostButton onClick={() => startInvestigationFor(c.id)}>
              <Search className="h-3.5 w-3.5" aria-hidden />
              {t("cd.open-investigation")}
            </GhostButton>
          )}
        </div>
      </div>

      {/* ---------- Tabs ---------- */}
      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="sasi-scroll h-auto w-full justify-start overflow-x-auto rounded-lg border border-white/8 bg-white/[0.02] p-1 sm:w-fit">
          {TABS.map((t2) => (
            <TabsTrigger
              key={t2.key}
              value={t2.key}
              className="flex-none rounded-md px-3 py-1 text-[12.5px] text-zinc-500 data-[state=active]:bg-white/8 data-[state=active]:text-white data-[state=active]:shadow-none"
            >
              {t(t2.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ================= OVERVIEW ================= */}
        <TabsContent value="overview" className="mt-5">
          <TabFade>
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="space-y-4 lg:col-span-3">
                <section className="sasi-card p-5" aria-label={t("cd.summary")}>
                  <SectionLabel className="sasi-eyebrow">{t("cd.summary")}</SectionLabel>
                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-zinc-300">
                    {c.description}
                  </p>
                  {c.impact && (
                    <div className="mt-3.5 rounded-lg border border-white/8 bg-white/[0.02] p-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                        {t("cd.impact")}
                      </p>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-400">
                        {c.impact}
                      </p>
                    </div>
                  )}
                </section>

                {c.verification && (
                  <VerificationCard verification={c.verification} />
                )}

                {c.proposedAction && c.proposedAction.state === "PROPOSED" && (
                  <ActionApprovalCard
                    action={c.proposedAction}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onEdit={handleEdit}
                    busy={busy}
                  />
                )}
              </div>

              <div className="space-y-4 lg:col-span-2">
                <section className="sasi-card p-5" aria-label={t("cd.details")}>
                  <SectionLabel className="sasi-eyebrow">{t("cd.details")}</SectionLabel>
                  <dl className="mt-1 divide-y divide-white/[0.04]">
                    <FactRow
                      label={t("cd.facts.service")}
                      icon={
                        <ServiceIcon
                          service={c.service}
                          className={cn("h-3.5 w-3.5", SERVICE_TINT[c.service])}
                        />
                      }
                    >
                      {SERVICES[c.service].label}
                    </FactRow>
                    <FactRow label={t("cd.facts.location")} icon={<MapPin className="h-3.5 w-3.5" />}>
                      {locationLabel(c.location, "suburb")}
                    </FactRow>
                    <FactRow
                      label={t("cd.facts.created")}
                      icon={<CalendarDays className="h-3.5 w-3.5" />}
                    >
                      {formatDate(c.createdAt)}
                    </FactRow>
                    <FactRow
                      label={t("cd.facts.updated")}
                      icon={<History className="h-3.5 w-3.5" />}
                    >
                      {timeAgo(c.updatedAt, NOW_MS)}
                    </FactRow>
                    <FactRow label={t("cd.facts.priority")} icon={<Flag className="h-3.5 w-3.5" />}>
                      <PriorityBadge priority={c.priority} />
                    </FactRow>
                    <FactRow
                      label={t("cd.facts.status")}
                      icon={<CircleDot className="h-3.5 w-3.5" />}
                    >
                      <CaseStatusBadge status={c.status} />
                    </FactRow>
                  </dl>

                  <div className="mt-3 border-t border-white/[0.06] pt-4">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-500">{t("cd.progress")}</span>
                      <span className="font-mono text-zinc-400">
                        {progress}%
                      </span>
                    </div>
                    <div
                      className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8"
                      role="progressbar"
                      aria-valuenow={progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={t("cd.progress-aria")}
                    >
                      <div
                        className="h-full rounded-full bg-white/70 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
                      {t(PROGRESS_HINT_KEY[c.status])}
                    </p>
                  </div>
                </section>

                <section
                  className="sasi-card p-5"
                  aria-label={t("cd.cando.title")}
                >
                  <SectionLabel className="sasi-eyebrow">{t("cd.cando.title")}</SectionLabel>
                  <ul className="mt-3 space-y-2">
                    {CAN_DO_KEYS.map((key) => (
                      <li
                        key={key}
                        className="flex items-start gap-2 text-[12.5px] leading-relaxed text-zinc-300"
                      >
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#66bb6a]" aria-hidden />
                        {t(key)}
                      </li>
                    ))}
                  </ul>
                  <ul className="mt-4 space-y-2 border-t border-white/[0.06] pt-4">
                    {CANNOT_DO_KEYS.map((key) => (
                      <li
                        key={key}
                        className="flex items-start gap-2 text-[12.5px] leading-relaxed text-zinc-500"
                      >
                        <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ef5350]" aria-hidden />
                        {t(key)}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          </TabFade>
        </TabsContent>

        {/* ================= INVESTIGATION ================= */}
        <TabsContent value="investigation" className="mt-5">
          <TabFade>
            <div className="grid gap-4 lg:grid-cols-5">
              <section
                className="sasi-card p-5 lg:col-span-3"
                aria-label={t("cd.timeline.title")}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SectionLabel className="sasi-eyebrow">{t("cd.timeline.title")}</SectionLabel>
                  <AIStateChip state={c.aiState} />
                </div>
                <div className="mt-4">
                  <TimelineRail events={c.events} live={aiActive} />
                </div>
              </section>

              <div className="lg:col-span-2">
                <SectionLabel className="sasi-eyebrow">{t("cd.findings")}</SectionLabel>
                <div className="mt-3 space-y-3">
                  {caseFindings.length === 0 ? (
                    <EmptyState
                      icon={Search}
                      title={t("cd.empty.findings")}
                      description={t("cd.empty.findings.desc")}
                    />
                  ) : (
                    caseFindings.map((f) => (
                      <FindingCard key={f.id} finding={f} />
                    ))
                  )}
                </div>
              </div>
            </div>
          </TabFade>
        </TabsContent>

        {/* ================= EVIDENCE ================= */}
        <TabsContent value="evidence" className="mt-5">
          <TabFade>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[11px] tracking-wide text-zinc-600">
                {t("cd.evidence.count").replace("{n}", String(caseEvidence.length))}
              </p>
              <GhostButton onClick={handleAddEvidence}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {t("cd.add-evidence")}
              </GhostButton>
            </div>
            {caseEvidence.length === 0 ? (
              <EmptyState
                className="mt-4"
                icon={ImageIcon}
                title={t("cd.empty.evidence")}
                description={t("cd.empty.evidence.desc")}
              />
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {caseEvidence.map((item) => (
                  <EvidenceCard key={item.id} item={item} showCase />
                ))}
              </div>
            )}
          </TabFade>
        </TabsContent>

        {/* ================= SOURCES ================= */}
        <TabsContent value="sources" className="mt-5">
          <TabFade>
            <p className="font-mono text-[11px] tracking-wide text-zinc-600">
              {t("cd.sources.count")
                .replace("{n}", String(caseSources.length))
                .replace("{off}", String(officialCount))}
            </p>
            {caseSources.length === 0 ? (
              <EmptyState
                className="mt-4"
                icon={Link2}
                title={t("cd.empty.sources")}
                description={t("cd.empty.sources.desc")}
              />
            ) : (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {caseSources.map((s) => (
                  <SourceCard key={s.id} source={s} />
                ))}
              </div>
            )}
          </TabFade>
        </TabsContent>

        {/* ================= ACTIONS ================= */}
        <TabsContent value="actions" className="mt-5">
          <TabFade>
            <div className="grid gap-4 lg:grid-cols-5">
              <div className="space-y-4 lg:col-span-3">
                {c.proposedAction ? (
                  <ActionApprovalCard
                    action={c.proposedAction}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onEdit={handleEdit}
                    busy={busy}
                  />
                ) : (
                  <EmptyState
                    icon={FolderLock}
                    title={t("cd.empty.action")}
                    description={t("cd.empty.action.desc")}
                  />
                )}
                {c.verification && (
                  <VerificationCard verification={c.verification} />
                )}
              </div>

              <section
                className="sasi-card h-fit p-5 lg:col-span-2"
                aria-label={t("cd.why.title")}
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert
                    className="h-4 w-4 shrink-0 text-[#e3c567]"
                    aria-hidden
                  />
                  <SectionLabel className="sasi-eyebrow">{t("cd.why.title")}</SectionLabel>
                </div>
                <p className="mt-2.5 text-[13px] leading-relaxed text-zinc-300">
                  {t("cd.why.body")}
                </p>
                <ul className="mt-3 space-y-2">
                  {["cd.why.1", "cd.why.2", "cd.why.3"].map((key) => (
                    <li
                      key={key}
                      className="flex items-start gap-2 text-[12.5px] leading-relaxed text-zinc-400"
                    >
                      <span
                        className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-zinc-600"
                        aria-hidden
                      />
                      {t(key)}
                    </li>
                  ))}
                </ul>
                <p className="mt-3.5 border-t border-white/[0.06] pt-3 text-[11px] leading-relaxed text-zinc-600">
                  {t("cd.why.note")}
                </p>
              </section>
            </div>
          </TabFade>
        </TabsContent>

        {/* ================= ACTIVITY ================= */}
        <TabsContent value="activity" className="mt-5">
          <TabFade>
            <section className="sasi-card p-5" aria-label={t("cd.activity.title")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <SectionLabel className="sasi-eyebrow">{t("cd.activity.title")}</SectionLabel>
                <span className="font-mono text-[10.5px] text-zinc-600">
                  {t("cd.activity.count").replace("{n}", String(c.events.length))}
                </span>
              </div>
              <div className="mt-4">
                <AuditRail events={c.events} />
              </div>
            </section>
          </TabFade>
        </TabsContent>
      </Tabs>

      {/* ---------- PRINT SHEET (visible only in print / PDF) ----------
          Portalled to <body> so the print stylesheet can simply hide
          every other top-level element — no visibility leaks, no dark
          backgrounds bleeding onto paper. */}
      {createPortal(
        <div className="sasi-print-sheet hidden">
        {/* sasi-print-header */}
        <div className="sasi-print-header">
          <div className="sasi-print-brand">
            <img src="/sasi-logo.png" alt="" height={22} width={22} />
            <span>SASI</span>
          </div>
          <div className="sasi-print-doc">
            CASE BRIEF · {c.ref} — NOT AN OFFICIAL DOCUMENT
          </div>
        </div>

        <h1 className="sasi-print-title">{c.title}</h1>

        <table className="sasi-print-meta">
          <tbody>
            <tr>
              <th>Reference</th>
              <td>{c.ref}</td>
              <th>Status</th>
              <td>
                {c.status} · {c.priority} · AI {c.aiState}
              </td>
            </tr>
            <tr>
              <th>Location</th>
              <td>{locationLabel(c.location, "full")}</td>
              <th>Dates</th>
              <td>
                Created {formatDateTime(c.createdAt)} · Updated {formatDateTime(c.updatedAt)}
              </td>
            </tr>
          </tbody>
        </table>

        <h2 className="sasi-print-h2">Summary</h2>
        <p className="sasi-print-p">{c.description}</p>
        {c.impact && (
          <>
            <h2 className="sasi-print-h2">Impact</h2>
            <p className="sasi-print-p">{c.impact}</p>
          </>
        )}

        {caseFindings.length > 0 && (
          <>
            <h2 className="sasi-print-h2">Findings ({caseFindings.length})</h2>
            <ul className="sasi-print-list">
              {caseFindings.map((f) => (
                <li key={f.id}>
                  <strong>{f.title}</strong> — {f.status} · confidence {f.confidence}
                  <br />
                  {f.summary}
                </li>
              ))}
            </ul>
          </>
        )}

        <h2 className="sasi-print-h2">
          Record — sources, evidence, activity
        </h2>
        <p className="sasi-print-p">
          {caseSources.length} source{caseSources.length === 1 ? "" : "s"} consulted
          ({officialCount} official) · {caseEvidence.length} evidence item
          {caseEvidence.length === 1 ? "" : "s"} on file.
        </p>
        <ul className="sasi-print-list">
          {c.events.slice(-8).map((e) => (
            <li key={e.id}>
              <strong>{e.label}</strong> — {formatDateTime(e.at)}
              {e.detail ? ` · ${e.detail}` : ""}
            </li>
          ))}
        </ul>

        <div className="sasi-print-footer">
          Generated by SASI — South African Service Intelligence (not a government
          submission). This sheet was produced from the resident&apos;s own records and
          AI-assisted analysis. It is not a government document and nothing has been
          submitted to any authority. SASI never contacts an authority without explicit
          approval.
        </div>
        </div>,
        document.body
      )}
    </div>
  );
}
