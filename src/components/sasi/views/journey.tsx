"use client";

/* Journey runner — Task 28-c (Phase 9). A SASI preparation checklist
   for one registered service journey. Steps are ticked and the run is
   persisted (upsert by sessionId+journeyId, debounced) via
   /api/sasi/journeys. Status reflects ONLY the resident's own
   checklist progress — never a government application outcome. */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  Check,
  CheckCircle2,
  Circle,
  FileCheck2,
  Landmark,
  MapPin,
  Pause,
  Play,
  Route,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

import { useSasiStore } from "@/lib/sasi/store";
import { getSessionId } from "@/lib/sasi/utils";
import {
  journeyStepsFor,
  registryEntryByJourneyId,
  type JourneyRunDTO,
  type JourneyRunStatus,
} from "@/lib/sasi/services-registry";
import { cn } from "@/lib/utils";
import {
  EmptyState,
  GhostButton,
  SectionLabel,
  TrustNotice,
  OfficialSource,
} from "@/components/sasi/primitives";

type LoadState = "loading" | "ready" | "error";

const STATUS_CHIP: Record<JourneyRunStatus, { label: string; className: string; dot: string }> = {
  ACTIVE: {
    label: "In progress",
    className: "border-[#e3c567]/25 bg-[#e3c567]/[0.08] text-[#efe0a8]",
    dot: "sasi-breathe bg-[#e3c567]",
  },
  PAUSED: {
    label: "Paused",
    className: "border-white/10 bg-white/[0.03] text-zinc-400",
    dot: "bg-zinc-500",
  },
  COMPLETED: {
    label: "Checklist complete",
    className: "border-[#66bb6a]/25 bg-[#66bb6a]/[0.08] text-[#a5d6a7]",
    dot: "bg-[#66bb6a]",
  },
};

export default function JourneyView() {
  const param = useSasiStore((s) => s.param);
  const navigate = useSasiStore((s) => s.navigate);

  const journeyId = (param ?? "").trim();
  const entry = journeyId ? registryEntryByJourneyId(journeyId) : undefined;
  const registrySteps = entry ? journeyStepsFor(journeyId) : undefined;

  const [loadState, setLoadState] = useState<LoadState>(entry ? "loading" : "ready");
  const [run, setRun] = useState<JourneyRunDTO | null>(null);
  const [starting, setStarting] = useState(false);

  /* ---------- debounced persistence ---------- */
  const saveTimer = useRef<number | null>(null);
  const pendingSave = useRef<{ stepsDone: number[]; status: JourneyRunStatus } | null>(null);

  const flushSave = useCallback(
    async (journeyIdToSave: string, stepsDone: number[], status: JourneyRunStatus) => {
      try {
        const res = await fetch("/api/sasi/journeys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: getSessionId(),
            journeyId: journeyIdToSave,
            status,
            stepsDone,
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch {
        toast.error("SASI could not save that step just now. Check your connection and try again.");
      }
    },
    []
  );

  const queueSave = useCallback(
    (stepsDone: number[], status: JourneyRunStatus) => {
      if (!journeyId) return;
      pendingSave.current = { stepsDone, status };
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        const pending = pendingSave.current;
        pendingSave.current = null;
        if (pending) void flushSave(journeyId, pending.stepsDone, pending.status);
      }, 600);
    },
    [journeyId, flushSave]
  );

  useEffect(() => {
    return () => {
      /* flush a pending toggle when leaving the view */
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      const pending = pendingSave.current;
      const id = journeyId;
      if (pending && id) void flushSave(id, pending.stepsDone, pending.status);
    };
  }, [flushSave, journeyId]);

  /* ---------- load existing run ---------- */
  const load = useCallback(async () => {
    if (!entry) return;
    setLoadState("loading");
    try {
      const res = await fetch(
        `/api/sasi/journeys?sessionId=${encodeURIComponent(getSessionId())}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { runs?: JourneyRunDTO[] };
      setRun(data.runs?.find((r) => r.journeyId === journeyId) ?? null);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, [entry, journeyId]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ---------- unknown journey (honest, no guessing) ---------- */
  if (!entry || !registrySteps) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <EmptyState
          icon={Route}
          title="This journey is not in SASI's registry"
          description="SASI only guides journeys it can name, source and step out honestly. Open a journey from the catalogue instead."
          action={<GhostButton onClick={() => navigate("journeys")}>Back to journeys</GhostButton>}
        />
      </div>
    );
  }

  /* ---------- mutations ---------- */
  const startRun = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/sasi/journeys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: getSessionId(),
          journeyId,
          status: "ACTIVE",
          stepsDone: [],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { run?: JourneyRunDTO };
      if (data.run) setRun(data.run);
      toast.success("Journey started — your progress is saved in SASI as you tick steps.");
    } catch {
      toast.error("SASI could not start the journey just now. Please try again.");
    } finally {
      setStarting(false);
    }
  };

  const setStatus = (status: JourneyRunStatus) => {
    if (!run) return;
    const next = { ...run, status };
    setRun(next);
    queueSave(run.stepsDone, status);
  };

  const toggleStep = (index: number) => {
    if (!run || run.status === "COMPLETED") return;
    const current = new Set(run.stepsDone);
    if (current.has(index)) current.delete(index);
    else current.add(index);
    const stepsDone = [...current].sort((a, b) => a - b);
    setRun({ ...run, stepsDone, status: run.status === "PAUSED" ? "ACTIVE" : run.status });
    queueSave(stepsDone, run.status === "PAUSED" ? "ACTIVE" : run.status);
  };

  /* ---------- derived ---------- */
  const steps = registrySteps;
  const active = run && run.status !== "COMPLETED";
  const doneCount = run ? run.stepsDone.filter((i) => i >= 0 && i < steps.length).length : 0;
  const allDone = run !== null && doneCount === steps.length;
  const statusChip = run ? STATUS_CHIP[run.status] : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      {/* ---------- Header ---------- */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        aria-labelledby="journey-heading"
      >
        <GhostButton
          onClick={() => navigate("journeys")}
          className="mb-6 h-8 px-3 text-[12.5px]"
          aria-label="Back to all journeys"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          All journeys
        </GhostButton>

        <div className="flex flex-wrap items-center gap-2">
          <h1 id="journey-heading" className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {entry.title}
          </h1>
          {statusChip ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
                statusChip.className
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", statusChip.dot)} aria-hidden />
              {statusChip.label}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-zinc-500">
          <Landmark className="h-3.5 w-3.5 shrink-0 text-zinc-600" aria-hidden />
          {entry.department}
        </p>
        <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-zinc-400">{entry.summary}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-zinc-600">
          <span className="inline-flex items-center gap-1">
            <FileCheck2 className="h-3.5 w-3.5" aria-hidden />
            {entry.requirements.length} requirements · {entry.requiredDocuments.length} documents
          </span>
          {entry.locationCategory ? (
            <button
              onClick={() => navigate("map", entry.locationCategory ?? undefined)}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-1 text-[11.5px] text-zinc-400 underline decoration-zinc-700 underline-offset-4 transition-colors hover:text-white"
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              Nearby: {entry.locationCategory.replace(/-/g, " ")}
            </button>
          ) : null}
        </div>
      </motion.section>

      {/* ---------- honest banner (ALWAYS visible) ---------- */}
      <TrustNotice variant="warning" className="mt-5">
        Completing this SASI checklist does not complete an official government application. Follow
        the official source for submission.
      </TrustNotice>

      {/* ---------- Start / status controls ---------- */}
      {loadState === "loading" ? (
        <div className="sasi-card mt-5 px-6 py-10 text-center" aria-hidden>
          <div className="mx-auto h-[76px] w-full max-w-xs animate-pulse rounded-lg bg-white/[0.04]" />
        </div>
      ) : loadState === "error" ? (
        <EmptyState
          className="mt-5"
          icon={ShieldAlert}
          title="Your progress could not be loaded"
          description="SASI could not check whether you already started this journey. Nothing is lost — try again."
          action={<GhostButton onClick={() => void load()}>Try again</GhostButton>}
        />
      ) : !run ? (
        <div className="sasi-card mt-5 flex flex-col items-center px-6 py-8 text-center">
          <p className="text-[14px] font-medium text-white">Not started yet</p>
          <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-zinc-500">
            The checklist below shows every step. Start the journey to tick steps off — your
            progress is saved in your own SASI workspace, nowhere else.
          </p>
          <GhostButton onClick={() => void startRun()} disabled={starting} className="mt-5">
            <Play className="h-3.5 w-3.5" aria-hidden />
            {starting ? "Starting…" : "Start journey"}
          </GhostButton>
        </div>
      ) : (
        <div className="sasi-card mt-5 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-[13px] text-zinc-300">
            <span className="font-semibold text-white">
              {doneCount} of {steps.length}
            </span>{" "}
            steps done
            {run.status === "PAUSED" ? " · journey paused" : ""}
          </p>
          <div className="flex items-center gap-2">
            {run.status === "PAUSED" ? (
              <GhostButton onClick={() => setStatus("ACTIVE")} className="min-h-[44px]">
                <Play className="h-3.5 w-3.5" aria-hidden />
                Resume
              </GhostButton>
            ) : active ? (
              <GhostButton onClick={() => setStatus("PAUSED")} className="min-h-[44px]">
                <Pause className="h-3.5 w-3.5" aria-hidden />
                Pause
              </GhostButton>
            ) : null}
          </div>
        </div>
      )}

      {/* ---------- Steps ---------- */}
      <section className="mt-8" aria-labelledby="journey-steps-heading">
        <SectionLabel className="sasi-eyebrow mb-3">Checklist</SectionLabel>
        <h2 id="journey-steps-heading" className="sr-only">
          Journey checklist steps
        </h2>
        <ol className="space-y-2">
          {steps.map((step, i) => {
            const done = run ? run.stepsDone.includes(i) : false;
            const interactive = Boolean(run) && run?.status !== "COMPLETED";
            return (
              <li key={step.title}>
                <button
                  onClick={() => toggleStep(i)}
                  disabled={!interactive}
                  aria-pressed={done}
                  className={cn(
                    "sasi-card group flex w-full items-start gap-3.5 p-4 text-left transition-colors",
                    interactive && "sasi-card-interactive",
                    !interactive && "cursor-default",
                    done && "border-[#66bb6a]/20"
                  )}
                >
                  <span className="mt-0.5 shrink-0" aria-hidden>
                    {done ? (
                      <CheckCircle2 className="h-5 w-5 text-[#66bb6a]" />
                    ) : interactive ? (
                      <Circle className="h-5 w-5 text-zinc-600 transition-colors group-hover:text-zinc-400" />
                    ) : (
                      <Circle className="h-5 w-5 text-zinc-700" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "flex items-baseline gap-2 text-[13.5px] font-medium",
                        done ? "text-[#a5d6a7]" : "text-white"
                      )}
                    >
                      <span className="font-mono text-[10.5px] text-zinc-600">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {step.title}
                    </span>
                    <span className="mt-1 block text-[12.5px] leading-relaxed text-zinc-500">
                      {step.detail}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* completion offer — honest wording, SASI-side only */}
        {run && allDone && run.status !== "COMPLETED" ? (
          <div className="sasi-card mt-4 flex flex-col items-start gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[12.5px] leading-relaxed text-zinc-400">
              All {steps.length} checklist steps are done. Your next move is with{" "}
              {entry.officialSource?.org ?? entry.department} — submitting is the official part.
            </p>
            <GhostButton
              onClick={() => setStatus("COMPLETED")}
              className="min-h-[44px] shrink-0"
              aria-label="Mark the SASI checklist as complete"
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Mark checklist complete
            </GhostButton>
          </div>
        ) : null}

        {run && run.status === "COMPLETED" ? (
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-[#66bb6a]/20 bg-[#66bb6a]/[0.05] p-3.5 text-[12.5px] leading-relaxed text-[#a5d6a7]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            SASI checklist complete — {formatChecklistNote(entry.title)}. This records only your
            preparation. No government application has been made through SASI.
          </p>
        ) : null}
      </section>

      {/* ---------- Requirements & documents ---------- */}
      {entry.requirements.length > 0 ? (
        <section className="mt-10" aria-labelledby="journey-req-heading">
          <SectionLabel className="sasi-eyebrow mb-3">Requirements</SectionLabel>
          <h2 id="journey-req-heading" className="sr-only">
            Requirements for {entry.title}
          </h2>
          <ul className="sasi-card divide-y divide-white/[0.04]">
            {entry.requirements.map((req) => (
              <li key={req} className="flex items-start gap-2.5 px-4 py-3">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#66bb6a]" aria-hidden />
                <span className="text-[12.5px] leading-relaxed text-zinc-300">{req}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {entry.requiredDocuments.length > 0 ? (
        <section className="mt-8" aria-labelledby="journey-docs-heading">
          <SectionLabel className="sasi-eyebrow mb-3">Documents to bring</SectionLabel>
          <h2 id="journey-docs-heading" className="sr-only">
            Documents to bring for {entry.title}
          </h2>
          <ul className="sasi-card divide-y divide-white/[0.04]">
            {entry.requiredDocuments.map((doc) => (
              <li key={doc} className="flex items-start gap-2.5 px-4 py-3">
                <FileCheck2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                <span className="text-[12.5px] leading-relaxed text-zinc-300">{doc}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 px-1 text-[11.5px] leading-relaxed text-zinc-600">
            Requirements are commonly documented, but offices can ask for more — confirm with the
            official source before you travel.
          </p>
        </section>
      ) : null}

      {/* ---------- Official source ---------- */}
      <section className="mt-10 pb-6" aria-labelledby="journey-source-heading">
        <SectionLabel className="sasi-eyebrow mb-3">Official source</SectionLabel>
        <h2 id="journey-source-heading" className="sr-only">
          Official source for {entry.title}
        </h2>
        {entry.officialSource ? (
          <OfficialSource
            title={entry.title}
            organisation={entry.officialSource.org}
            href={entry.officialSource.verified ? entry.officialSource.url : undefined}
            note={
              entry.officialSource.verified
                ? "Verified by SASI as an official government site. The department's pages carry the authoritative requirements and fees."
                : "SASI has not verified this link — confirm details through the organisation directly."
            }
          />
        ) : (
          <TrustNotice>
            SASI has not verified a single official page for this service — confirm details through{" "}
            {entry.department} directly.
          </TrustNotice>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-zinc-600">
          <BadgeCheck className="h-3.5 w-3.5 text-[#66bb6a]" aria-hidden />
          Verified government sources only ·
          <Ban className="h-3.5 w-3.5 text-zinc-600" aria-hidden />
          SASI never asks for fees, PINs or OTPs
        </p>
      </section>
    </div>
  );
}

/** Honest completion note phrased per service ("checklist for the tourist passport"). */
function formatChecklistNote(title: string): string {
  return `your preparation checklist for the ${title.toLowerCase()} is finished`;
}
