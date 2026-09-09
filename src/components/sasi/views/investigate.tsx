"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Check,
  Gauge,
  Pause,
  Play,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSasiStore } from "@/lib/sasi/store";
import { sourcesForCase } from "@/lib/sasi/data";
import type {
  AIState,
  Confidence,
  Finding,
  ProposedAction,
  TimelineEvent,
} from "@/lib/sasi/types";
import { CONFIDENCE_META, locationLabel, timeAgo } from "@/lib/sasi/utils";
import {
  AIStateChip,
  CaseStatusBadge,
  DemoBadge,
  EmptyState,
  GhostButton,
  PrimaryButton,
  PriorityBadge,
  SectionLabel,
  ServiceIcon,
  SERVICE_TINT,
} from "@/components/sasi/primitives";
import {
  ActionApprovalCard,
  EvidenceCard,
  FindingCard,
  SourceCard,
  TimelineRail,
  VerificationCard,
} from "@/components/sasi/domain";

/* ============================================================
   SIMULATION SCRIPT — staged agentic investigation
   Steps run on timers; every step is idempotent (label-deduped)
   so re-runs, pauses and navigation cannot duplicate history.
   ============================================================ */

type ScriptStep = {
  /** AI state this step establishes */
  state: AIState;
  /** tracker index; -1 = terminal (approval gate) */
  stage: number;
  /** seconds from run start */
  offset: number;
  run: (caseId: string) => void;
};

function pushEvent(
  caseId: string,
  ev: Omit<TimelineEvent, "id" | "at">,
  dedupeLabel?: string
) {
  const st = useSasiStore.getState();
  const c = st.cases.find((x) => x.id === caseId);
  if (!c) return;
  if (dedupeLabel && c.events.some((e) => e.label === dedupeLabel)) return;
  st.addCaseEvent(caseId, {
    id: `ev-live-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    ...ev,
  });
}

const SCRIPT: ScriptStep[] = [
  {
    state: "UNDERSTANDING",
    stage: 0,
    offset: 0,
    run: (caseId) => {
      useSasiStore.getState().setCaseAIState(caseId, "UNDERSTANDING");
      pushEvent(
        caseId,
        {
          label: "Understanding the report",
          detail: "Identifying service, area and affected zone.",
          kind: "ai",
          agent: "Investigation Agent",
        },
        "Understanding the report"
      );
    },
  },
  {
    state: "RESEARCHING",
    stage: 1,
    offset: 3.5,
    run: (caseId) => {
      useSasiStore.getState().setCaseAIState(caseId, "RESEARCHING");
      pushEvent(
        caseId,
        {
          label: "Searching official and public sources",
          kind: "ai",
          agent: "Research Agent",
        },
        "Searching official and public sources"
      );
    },
  },
  {
    state: "RESEARCHING",
    stage: 1,
    offset: 7,
    run: (caseId) => {
      pushEvent(
        caseId,
        {
          label: "3 sources found",
          detail: "Maintenance notice, news corroboration, reservoir telemetry",
          kind: "source",
          agent: "Research Agent",
        },
        "3 sources found"
      );
    },
  },
  {
    state: "CORRELATING",
    stage: 2,
    offset: 10.5,
    run: (caseId) => {
      useSasiStore.getState().setCaseAIState(caseId, "CORRELATING");
      pushEvent(
        caseId,
        {
          label: "Comparing sources against your evidence",
          kind: "ai",
          agent: "Evidence Agent",
        },
        "Comparing sources against your evidence"
      );
    },
  },
  {
    state: "VERIFYING",
    stage: 3,
    offset: 14,
    run: (caseId) => {
      useSasiStore.getState().setCaseAIState(caseId, "VERIFYING");
      pushEvent(
        caseId,
        {
          label: "Checking source consistency",
          detail: "2 sources agree; 1 pending",
          kind: "ai",
          agent: "Verification Agent",
        },
        "Checking source consistency"
      );
    },
  },
  {
    state: "PREPARING_FINDINGS",
    stage: 4,
    offset: 17.5,
    run: (caseId) => {
      const st = useSasiStore.getState();
      st.setCaseAIState(caseId, "PREPARING_FINDINGS");
      if ((st.findings[caseId] ?? []).length === 0) {
        const c = st.cases.find((x) => x.id === caseId);
        st.addFinding(caseId, {
          id: `F-${c?.ref ?? "new"}-new-${Date.now()}`,
          title: "Outage pattern matches planned maintenance window",
          status: "INFERRED",
          confidence: "MEDIUM",
          sourcesCount: 3,
          evidenceCount: 2,
          summary:
            "Your report, neighbour reports and the maintenance notice line up in time and area. This is an AI inference, not an official confirmation.",
          nextStep:
            "Review the prepared service report and approve submission to the utility.",
          createdAt: new Date().toISOString(),
          isDemo: true,
        });
      }
    },
  },
  {
    state: "WAITING_FOR_APPROVAL",
    stage: -1,
    offset: 21,
    run: (caseId) => {
      useSasiStore.getState().setCaseAIState(caseId, "WAITING_FOR_APPROVAL");
      pushEvent(
        caseId,
        {
          label: "Prepared a service report for your approval",
          detail: "SASI will ask before contacting anyone. Nothing is sent without your approval.",
          kind: "ai",
          agent: "Government Navigator Agent",
        },
        "Prepared a service report for your approval"
      );
    },
  },
];

/** Post-approval: submit (simulated) → verify → complete. */
function schedulePostApproval(
  caseId: string,
  fromLevel: number,
  timersRef: { current: number[] }
) {
  const schedule = (delayMs: number, fn: () => void) => {
    const t = window.setTimeout(() => {
      const exists = useSasiStore.getState().cases.some((c) => c.id === caseId);
      if (exists) fn();
    }, delayMs);
    timersRef.current.push(t);
  };

  if (fromLevel <= 0) {
    schedule(0, () => {
      const st = useSasiStore.getState();
      st.setActionState(caseId, "IN_PROGRESS");
      st.setCaseAIState(caseId, "ACTING");
    });
  }

  schedule(fromLevel <= 0 ? 2500 : 0, () => {
    const st = useSasiStore.getState();
    pushEvent(
      caseId,
      {
        label: "Action submitted through official public channel",
        detail: "Submitted via the official public pathway (simulated for the demo).",
        kind: "action",
        agent: "Government Navigator Agent",
      },
      "Action submitted through official public channel"
    );
    st.setActionState(caseId, "COMPLETED");
    st.setVerification(caseId, { state: "IN_PROGRESS" });
    st.setCaseAIState(caseId, "VERIFYING_RESULT");
  });

  schedule(fromLevel <= 0 ? 5500 : 3000, () => {
    const st = useSasiStore.getState();
    st.setVerification(caseId, {
      state: "VERIFIED",
      detail: "Demo verification: status page updated (simulated).",
      checkedAt: new Date().toISOString(),
    });
    pushEvent(
      caseId,
      {
        label: "Verification completed",
        detail: "Demo verification: status page updated (simulated).",
        kind: "verification",
        agent: "Verification Agent",
      },
      "Verification completed"
    );
    st.setCaseAIState(caseId, "COMPLETE");
    st.persistCaseById(caseId);
    /* live digest: the completion is a real signal worth a notification */
    st.notifyInvestigationComplete(caseId);
  });
}

/* ============================================================
   STAGE HELPERS
   ============================================================ */

const STAGES: { key: AIState; label: string }[] = [
  { key: "UNDERSTANDING", label: "Understanding" },
  { key: "RESEARCHING", label: "Researching" },
  { key: "CORRELATING", label: "Correlating" },
  { key: "VERIFYING", label: "Verifying" },
  { key: "PREPARING_FINDINGS", label: "Preparing findings" },
];

function stageOf(ai: AIState | undefined): number {
  switch (ai) {
    case "UNDERSTANDING":
      return 0;
    case "RESEARCHING":
      return 1;
    case "CORRELATING":
      return 2;
    case "VERIFYING":
      return 3;
    case "PREPARING_FINDINGS":
      return 4;
    case "WAITING_FOR_APPROVAL":
    case "ACTING":
    case "VERIFYING_RESULT":
    case "COMPLETE":
      return 5;
    default:
      return -1;
  }
}

function runFromFor(ai: AIState): number {
  switch (ai) {
    case "RESEARCHING":
    case "CORRELATING":
      return 2;
    case "VERIFYING":
      return 3;
    case "PREPARING_FINDINGS":
      return 4;
    default:
      return 0;
  }
}

const CAN_RUN_STATES: AIState[] = [
  "IDLE",
  "PAUSED",
  "RESEARCHING",
  "CORRELATING",
  "VERIFYING",
  "PREPARING_FINDINGS",
];

type RunPhase = "idle" | "running" | "paused";

const EMPTY_FINDINGS: Finding[] = [];

function makeGenericAction(): ProposedAction {
  return {
    id: `act-generic-${Date.now()}`,
    title: "Submit a service report through the official public channel",
    rationale:
      "An official report creates a traceable reference and puts your case on record with the responsible service authority.",
    whatHappens:
      "SASI will prepare a structured service report from your description, location and evidence, and submit it through the official public reporting channel.",
    infoShared:
      "Your description, suburb and case reference. Your email is not shared without approval.",
    recipient: "Official public reporting channel (demo pathway)",
    state: "PROPOSED",
    createdAt: new Date().toISOString(),
  };
}

/* ============================================================
   SUBCOMPONENTS
   ============================================================ */

function StageTracker({ current }: { current: number }) {
  return (
    <div
      className="sasi-scroll flex items-center overflow-x-auto pb-1"
      role="list"
      aria-label="Investigation stages"
    >
      {STAGES.map((s, i) => {
        const done = current === 5 || i < current;
        const active = current === i;
        return (
          <Fragment key={s.key}>
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  "mx-1 h-px w-4 shrink-0 sm:w-6",
                  i <= current ? "bg-white/25" : "bg-white/10"
                )}
              />
            )}
            <span
              role="listitem"
              aria-current={active ? "step" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-medium",
                active
                  ? "border-white bg-white text-black"
                  : done
                    ? "border-white/10 bg-white/[0.03] text-zinc-500"
                    : "border-white/8 text-zinc-600"
              )}
            >
              {done ? (
                <Check className="h-3 w-3" aria-hidden />
              ) : active ? (
                <span className="sasi-breathe h-1.5 w-1.5 rounded-full bg-black" />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
              )}
              {s.label}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}

/** TimelineRail with the newest event animated in via framer-motion. */
function LiveTimeline({ events, live }: { events: TimelineEvent[]; live: boolean }) {
  if (events.length === 0) {
    return (
      <p className="py-6 text-center text-[12.5px] text-zinc-600">
        No timeline events yet. Run the investigation to see SASI work.
      </p>
    );
  }
  const prev = events.slice(0, -1);
  const last = events[events.length - 1];
  return (
    <div>
      {prev.length > 0 && <TimelineRail events={prev} />}
      {last && (
        <motion.div
          key={last.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <TimelineRail events={[last]} live={live} />
        </motion.div>
      )}
    </div>
  );
}

function ConfidenceSummary({
  findings,
  className,
}: {
  findings: Finding[];
  className?: string;
}) {
  const overall: Confidence | null =
    findings.length === 0
      ? null
      : findings.some((f) => f.confidence === "HIGH")
        ? "HIGH"
        : findings.some((f) => f.confidence === "MEDIUM")
          ? "MEDIUM"
          : "LOW";
  const meta = overall ? CONFIDENCE_META[overall] : null;
  return (
    <div className={cn("sasi-card p-4", className)} aria-label="Overall confidence">
      <div className="flex items-center justify-between">
        <SectionLabel>Overall confidence</SectionLabel>
        <Gauge className="h-3.5 w-3.5 text-zinc-600" aria-hidden />
      </div>
      {meta && overall ? (
        <>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className={cn("text-[13px] font-medium", meta.text)}>
              {meta.label}
            </span>
            <span className="text-[11px] text-zinc-600">
              {findings.length} finding{findings.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: meta.width }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="h-full rounded-full bg-white/40"
            />
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">
            Highest confidence across AI findings. An inference is not a confirmation.
          </p>
        </>
      ) : (
        <p className="mt-2 text-[12px] leading-relaxed text-zinc-500">
          No findings yet. They appear here as the investigation progresses.
        </p>
      )}
    </div>
  );
}

function MobileTabs({
  tab,
  onChange,
  counts,
}: {
  tab: string;
  onChange: (t: "timeline" | "findings" | "sources" | "evidence") => void;
  counts: { findings: number; sources: number; evidence: number };
}) {
  const tabs: { key: "timeline" | "findings" | "sources" | "evidence"; label: string }[] = [
    { key: "timeline", label: "Timeline" },
    { key: "findings", label: `Findings ${counts.findings}` },
    { key: "sources", label: `Sources ${counts.sources}` },
    { key: "evidence", label: `Evidence ${counts.evidence}` },
  ];
  return (
    <div
      className="grid grid-cols-4 gap-1 rounded-lg border border-white/8 bg-white/[0.02] p-1"
      role="tablist"
      aria-label="Investigation sections"
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={tab === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "min-h-9 rounded-md px-1 text-[11px] font-medium transition-colors",
            tab === t.key
              ? "bg-white/10 text-white"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ============================================================
   VIEW
   ============================================================ */

export default function InvestigateView() {
  const navigate = useSasiStore((s) => s.navigate);
  const openCase = useSasiStore((s) => s.openCase);
  const activeCaseId = useSasiStore((s) => s.activeCaseId);
  const param = useSasiStore((s) => s.param);
  const cases = useSasiStore((s) => s.cases);
  const allEvidence = useSasiStore((s) => s.evidence);

  const caseKey = activeCaseId ?? param;
  const activeCase = useMemo(
    () =>
      caseKey
        ? cases.find((c) => c.id === caseKey || c.ref === caseKey) ?? null
        : null,
    [caseKey, cases]
  );
  const caseId = activeCase?.id ?? null;

  const caseFindings =
    useSasiStore((s) => (caseId ? s.findings[caseId] : undefined)) ??
    EMPTY_FINDINGS;
  const caseEvidence = useMemo(
    () => (caseId ? allEvidence.filter((e) => e.caseId === caseId) : []),
    [caseId, allEvidence]
  );
  const caseSources = useMemo(
    () => (caseId ? sourcesForCase(caseId) : []),
    [caseId]
  );

  /* ---- simulation engine state ---- */
  const [phase, setPhase] = useState<RunPhase>("idle");
  const [trackerStage, setTrackerStage] = useState(-1);
  const [localDecision, setLocalDecision] = useState<{
    caseId: string;
    state: "APPROVED" | "REJECTED";
  } | null>(null);
  const [mobileTab, setMobileTab] = useState<
    "timeline" | "findings" | "sources" | "evidence"
  >("timeline");

  const timersRef = useRef<number[]>([]);
  const queueRef = useRef<{ stepIndex: number; fireAt: number }[]>([]);
  const remainingRef = useRef<{ stepIndex: number; remainingMs: number }[]>([]);
  const pausedRef = useRef(false);
  const activeCaseRef = useRef<string | null>(null);
  const postKickRef = useRef(-1);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  }, []);

  const fireStep = useCallback((stepIndex: number) => {
    const cid = activeCaseRef.current;
    if (!cid || pausedRef.current) return;
    const exists = useSasiStore.getState().cases.some((c) => c.id === cid);
    if (!exists) return;
    queueRef.current = queueRef.current.filter((q) => q.stepIndex !== stepIndex);
    const step = SCRIPT[stepIndex];
    step.run(cid);
    if (step.stage >= 0) setTrackerStage(step.stage);
    if (queueRef.current.length === 0) setPhase("idle");
  }, []);

  const scheduleQueue = useCallback(() => {
    clearTimers();
    const now = Date.now();
    for (const q of queueRef.current) {
      const t = window.setTimeout(
        () => fireStep(q.stepIndex),
        Math.max(0, q.fireAt - now)
      );
      timersRef.current.push(t);
    }
  }, [clearTimers, fireStep]);

  const startRun = useCallback(
    (fromStage: number) => {
      const cid = activeCaseRef.current;
      if (!cid) return;
      const firstIdx = SCRIPT.findIndex((s) => s.stage === fromStage);
      if (firstIdx < 0) return;
      pausedRef.current = false;
      remainingRef.current = [];
      const base = SCRIPT[firstIdx].offset;
      const now = Date.now();
      queueRef.current = SCRIPT.slice(firstIdx).map((s, i) => ({
        stepIndex: firstIdx + i,
        fireAt: now + (s.offset - base) * 1000,
      }));
      setTrackerStage(SCRIPT[firstIdx].stage);
      setPhase("running");
      scheduleQueue();
    },
    [scheduleQueue]
  );

  const pauseRun = useCallback(() => {
    const cid = activeCaseRef.current;
    if (!cid) return;
    pausedRef.current = true;
    clearTimers();
    const now = Date.now();
    remainingRef.current = queueRef.current.map((q) => ({
      stepIndex: q.stepIndex,
      remainingMs: Math.max(0, q.fireAt - now),
    }));
    queueRef.current = [];
    useSasiStore.getState().setCaseAIState(cid, "PAUSED");
    setPhase("paused");
  }, [clearTimers]);

  const resumeRun = useCallback(() => {
    const cid = activeCaseRef.current;
    if (!cid || remainingRef.current.length === 0) return;
    pausedRef.current = false;
    const now = Date.now();
    queueRef.current = remainingRef.current.map((r) => ({
      stepIndex: r.stepIndex,
      fireAt: now + r.remainingMs,
    }));
    remainingRef.current = [];
    const next = SCRIPT[queueRef.current[0]?.stepIndex ?? -1];
    if (next) {
      useSasiStore.getState().setCaseAIState(cid, next.state);
      if (next.stage >= 0) setTrackerStage(next.stage);
    }
    setPhase("running");
    scheduleQueue();
  }, [scheduleQueue]);

  /* ---- lifecycle: bind case, auto-run fresh investigations, cleanup ---- */
  useEffect(() => {
    if (!caseId) return;
    activeCaseRef.current = caseId;
    const c = useSasiStore.getState().cases.find((x) => x.id === caseId);
    let kickoff: number | null = null;
    if (c?.aiState === "UNDERSTANDING") {
      kickoff = window.setTimeout(() => startRun(0), 0);
    }
    return () => {
      if (kickoff !== null) window.clearTimeout(kickoff);
      clearTimers();
      queueRef.current = [];
      remainingRef.current = [];
      pausedRef.current = false;
      activeCaseRef.current = null;
      postKickRef.current = -1;
      setPhase("idle");
    };
  }, [caseId, startRun, clearTimers]);

  /* ---- watch store: approved actions proceed automatically ---- */
  useEffect(() => {
    if (!caseId || !activeCase?.proposedAction) return;
    if (postKickRef.current >= 0) return;
    const ast = activeCase.proposedAction.state;
    const ai = activeCase.aiState;
    if (ast === "APPROVED" && (ai === "WAITING_FOR_APPROVAL" || ai === "ACTING")) {
      postKickRef.current = 1;
      schedulePostApproval(caseId, 0, timersRef);
    } else if (ast === "IN_PROGRESS" && ai === "ACTING") {
      postKickRef.current = 1;
      schedulePostApproval(caseId, 1, timersRef);
    }
  }, [caseId, activeCase]);

  /* ---- generic approval card when the case has no stored action ----
     Derived at render time (no effect): the generic action only exists
     while the case sits at the approval gate; the decision is keyed by
     case id so switching cases naturally resets it. */
  const genericAction: ProposedAction | null = useMemo(() => {
    if (!activeCase || activeCase.proposedAction) return null;
    if (!["WAITING_FOR_APPROVAL", "ACTING", "VERIFYING_RESULT"].includes(activeCase.aiState))
      return null;
    const decided =
      localDecision && localDecision.caseId === activeCase.id
        ? localDecision.state
        : "PROPOSED";
    return { ...makeGenericAction(), state: decided };
  }, [activeCase, localDecision]);

  if (!activeCase) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <EmptyState
          icon={Search}
          title="No investigation selected"
          description="Pick a case to investigate, or report something new and SASI will start working on it immediately."
          action={
            <PrimaryButton onClick={() => navigate("start-investigation")}>
              <Play className="h-3.5 w-3.5" aria-hidden /> Start an investigation
            </PrimaryButton>
          }
          className="mx-auto max-w-xl"
        />
      </div>
    );
  }

  const c = activeCase;
  const aiState = c.aiState;
  const stageIdx = stageOf(aiState);
  const displayStage = stageIdx >= 0 ? stageIdx : trackerStage;
  const isRunningLive = phase === "running";
  const canRun = phase === "idle" && CAN_RUN_STATES.includes(aiState);

  const showApprovalCard =
    Boolean(c.proposedAction) &&
    ["WAITING_FOR_APPROVAL", "ACTING", "VERIFYING_RESULT"].includes(aiState);
  const showGenericCard =
    !c.proposedAction &&
    Boolean(genericAction) &&
    ["WAITING_FOR_APPROVAL", "ACTING", "VERIFYING_RESULT"].includes(aiState);
  const showVerification =
    Boolean(c.verification) &&
    c.verification?.state !== "PENDING" &&
    ["VERIFYING_RESULT", "COMPLETE"].includes(aiState);

  const handleApprove = () => {
    if (c.proposedAction) {
      useSasiStore.getState().approveAction(c.id);
    } else if (genericAction) {
      setLocalDecision({ caseId: c.id, state: "APPROVED" });
      postKickRef.current = 1;
      pushEvent(
        c.id,
        {
          label: "You approved the action",
          detail: genericAction.title,
          kind: "action",
        },
        "You approved the action"
      );
      schedulePostApproval(c.id, 0, timersRef);
    }
  };

  const handleReject = () => {
    if (c.proposedAction) {
      useSasiStore.getState().rejectAction(c.id);
    } else if (genericAction) {
      setLocalDecision({ caseId: c.id, state: "REJECTED" });
      pushEvent(
        c.id,
        {
          label: "You rejected the action",
          detail: "SASI will not proceed. You can revisit this later.",
          kind: "action",
        },
        "You rejected the action"
      );
      useSasiStore.getState().setCaseAIState(c.id, "PAUSED");
    }
  };

  const approvalAction: ProposedAction | null = c.proposedAction ?? genericAction;

  const runControls = (
    <>
      {phase === "running" && (
        <GhostButton
          onClick={pauseRun}
          aria-label="Pause investigation"
          className="h-8 px-3 text-[12px]"
        >
          <Pause className="h-3.5 w-3.5" aria-hidden /> Pause
        </GhostButton>
      )}
      {phase === "paused" && (
        <GhostButton
          onClick={resumeRun}
          aria-label="Resume investigation"
          className="h-8 px-3 text-[12px]"
        >
          <Play className="h-3.5 w-3.5" aria-hidden /> Resume
        </GhostButton>
      )}
      {canRun && (
        <GhostButton
          onClick={() => startRun(runFromFor(aiState))}
          aria-label="Run investigation"
          className="h-8 px-3 text-[12px]"
        >
          <Play className="h-3.5 w-3.5" aria-hidden /> Run investigation
        </GhostButton>
      )}
    </>
  );

  const timelineBlock = (
    <>
      <StageTracker current={displayStage} />
      <div className="sasi-scroll mt-4 max-h-[520px] overflow-y-auto pr-1">
        <LiveTimeline events={c.events} live={isRunningLive} />
      </div>
      {showApprovalCard && approvalAction && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="mt-4"
        >
          <ActionApprovalCard
            action={approvalAction}
            onApprove={handleApprove}
            onReject={handleReject}
            onEdit={() => openCase(c.ref)}
          />
        </motion.div>
      )}
      {showGenericCard && approvalAction && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="mt-4"
        >
          <ActionApprovalCard
            action={approvalAction}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        </motion.div>
      )}
      {showVerification && c.verification && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="mt-4"
        >
          <VerificationCard verification={c.verification} />
        </motion.div>
      )}
    </>
  );

  const findingsBlock = (withConfidence: boolean) => (
    <div className="space-y-3">
      {caseFindings.length === 0 ? (
        <p className="rounded-lg border border-white/8 bg-white/[0.02] p-4 text-[12.5px] leading-relaxed text-zinc-500">
          No findings yet. SASI records findings here once sources have been
          correlated and checked.
        </p>
      ) : (
        caseFindings.map((f) => (
          <motion.div
            key={f.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <FindingCard finding={f} />
          </motion.div>
        ))
      )}
      {withConfidence && <ConfidenceSummary findings={caseFindings} />}
    </div>
  );

  const sourcesBlock = (
    <div className="space-y-3">
      {caseSources.length === 0 ? (
        <p className="rounded-lg border border-white/8 bg-white/[0.02] p-4 text-[12.5px] leading-relaxed text-zinc-500">
          No sources matched yet. Official notices, news and open data appear
          here as the Research Agent works.
        </p>
      ) : (
        caseSources.map((s) => <SourceCard key={s.id} source={s} />)
      )}
    </div>
  );

  const evidenceBlock = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {caseEvidence.length === 0 ? (
        <p className="rounded-lg border border-white/8 bg-white/[0.02] p-4 text-[12.5px] leading-relaxed text-zinc-500 sm:col-span-2">
          No evidence attached to this case yet.
        </p>
      ) : (
        caseEvidence.map((e) => (
          <EvidenceCard key={e.id} item={e} onOpen={() => navigate("evidence")} />
        ))
      )}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ---------- MOBILE ---------- */}
      <div className="space-y-4 lg:hidden">
        <div className="sasi-card space-y-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[11px] tracking-[0.14em] text-zinc-500">
              {c.ref}
            </p>
            <AIStateChip state={aiState} />
          </div>
          <div className="flex items-start gap-2.5">
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]",
                SERVICE_TINT[c.service]
              )}
            >
              <ServiceIcon service={c.service} className="h-4 w-4" />
            </span>
            <h1 className="text-[15px] font-semibold leading-snug text-white">
              {c.title}
            </h1>
          </div>
          <p className="text-[12px] text-zinc-500">
            {locationLabel(c.location, "suburb")}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            <CaseStatusBadge status={c.status} />
            <PriorityBadge priority={c.priority} />
            <DemoBadge label="DEMO" />
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-3">
            <div className="flex items-center gap-2">{runControls}</div>
            <button
              onClick={() => openCase(c.ref)}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-zinc-400 transition-colors hover:text-white"
              aria-label={`View full case ${c.ref}`}
            >
              Full case <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>

        <MobileTabs
          tab={mobileTab}
          onChange={setMobileTab}
          counts={{
            findings: caseFindings.length,
            sources: caseSources.length,
            evidence: caseEvidence.length,
          }}
        />

        <div aria-live="polite">
          {mobileTab === "timeline" && (
            <section className="sasi-card p-4" aria-label="Investigation timeline">
              {timelineBlock}
            </section>
          )}
          {mobileTab === "findings" && (
            <section aria-label="Findings">{findingsBlock(true)}</section>
          )}
          {mobileTab === "sources" && (
            <section aria-label="Sources">{sourcesBlock}</section>
          )}
          {mobileTab === "evidence" && (
            <section aria-label="Evidence">{evidenceBlock}</section>
          )}
        </div>
      </div>

      {/* ---------- DESKTOP 3-COLUMN ---------- */}
      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4">
        {/* LEFT — case context */}
        <aside
          className="lg:col-span-3 lg:sticky lg:top-20 lg:self-start"
          aria-label="Case context"
        >
          <div className="sasi-card space-y-4 p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="font-mono text-[11px] tracking-[0.14em] text-zinc-500">
                {c.ref}
              </p>
              <DemoBadge label="DEMO" />
            </div>
            <div>
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]",
                    SERVICE_TINT[c.service]
                  )}
                >
                  <ServiceIcon service={c.service} className="h-4 w-4" />
                </span>
                <h1 className="text-[15px] font-semibold leading-snug text-white">
                  {c.title}
                </h1>
              </div>
              <p className="mt-2 text-[12px] text-zinc-500">
                {locationLabel(c.location, "suburb")}
                {c.location.ward ? ` · ${c.location.ward}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <CaseStatusBadge status={c.status} />
              <PriorityBadge priority={c.priority} />
              <AIStateChip state={aiState} />
            </div>
            {(c.impact || c.description) && (
              <p className="border-l-2 border-white/10 pl-3 text-[12.5px] leading-relaxed text-zinc-400">
                {c.impact ?? c.description}
              </p>
            )}
            <div className="flex items-center justify-between border-t border-white/5 pt-3 text-[11px] text-zinc-600">
              <span>
                Sources {caseSources.length} · Evidence {caseEvidence.length}
              </span>
              <span>Opened {timeAgo(c.createdAt)}</span>
            </div>
            <button
              onClick={() => openCase(c.ref)}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-zinc-300 transition-colors hover:text-white"
              aria-label={`View full case ${c.ref}`}
            >
              View full case <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </aside>

        {/* CENTER — AI investigation timeline */}
        <section
          className="sasi-card mt-0 p-5 lg:col-span-6"
          aria-label="AI investigation timeline"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionLabel>Investigation timeline</SectionLabel>
            <div className="flex items-center gap-2">
              {runControls}
              <DemoBadge label="DEMO" />
            </div>
          </div>
          <div className="mt-4">{timelineBlock}</div>
        </section>

        {/* RIGHT — findings / sources / evidence */}
        <div
          className="space-y-5 lg:col-span-3 lg:sticky lg:top-20 lg:self-start"
          aria-label="Investigation outputs"
        >
          <div>
            <SectionLabel className="mb-2">Findings</SectionLabel>
            <div className="sasi-scroll max-h-96 space-y-3 overflow-y-auto pr-1">
              {caseFindings.length === 0 ? (
                <p className="rounded-lg border border-white/8 bg-white/[0.02] p-3.5 text-[12px] leading-relaxed text-zinc-500">
                  No findings yet. SASI records findings here once sources have
                  been correlated and checked.
                </p>
              ) : (
                caseFindings.map((f) => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                  >
                    <FindingCard finding={f} />
                  </motion.div>
                ))
              )}
            </div>
          </div>

          <div>
            <SectionLabel className="mb-2">Sources</SectionLabel>
            <div className="sasi-scroll max-h-80 space-y-3 overflow-y-auto pr-1">
              {caseSources.length === 0 ? (
                <p className="rounded-lg border border-white/8 bg-white/[0.02] p-3.5 text-[12px] leading-relaxed text-zinc-500">
                  No sources matched yet.
                </p>
              ) : (
                caseSources.map((s) => <SourceCard key={s.id} source={s} />)
              )}
            </div>
          </div>

          <div>
            <SectionLabel className="mb-2">Evidence</SectionLabel>
            <div className="sasi-scroll max-h-96 space-y-3 overflow-y-auto pr-1">
              {caseEvidence.length === 0 ? (
                <p className="rounded-lg border border-white/8 bg-white/[0.02] p-3.5 text-[12px] leading-relaxed text-zinc-500">
                  No evidence attached to this case yet.
                </p>
              ) : (
                caseEvidence.map((e) => (
                  <EvidenceCard
                    key={e.id}
                    item={e}
                    onOpen={() => navigate("evidence")}
                  />
                ))
              )}
            </div>
          </div>

          <ConfidenceSummary findings={caseFindings} />
        </div>
      </div>
    </div>
  );
}
