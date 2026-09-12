"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  MapPin,
  PenLine,
  Search,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSasiStore } from "@/lib/sasi/store";
import { POPULAR_SERVICES } from "@/lib/sasi/data";
import { SERVICES } from "@/lib/sasi/utils";
import type { ServiceKey } from "@/lib/sasi/types";
import {
  GhostButton,
  PrimaryButton,
  SectionLabel,
  ServiceIcon,
  SERVICE_TINT,
} from "@/components/sasi/primitives";

/* ============================================================
   START INVESTIGATION — pick an existing case or describe a
   new issue; SASI starts the staged investigation immediately.
   ============================================================ */

const LOCATION_CHIPS = ["Johannesburg", "Soweto", "Sandton", "Midrand", "Pretoria"];

const FLOW_CHIPS = [
  "UNDERSTAND",
  "RESEARCH",
  "CORRELATE",
  "VERIFY",
  "PREPARE FINDINGS",
  "ASK APPROVAL",
];

const INPUT_CLS =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-[13.5px] leading-relaxed text-white placeholder:text-zinc-600 outline-none transition-colors focus:border-white/30 focus:bg-white/[0.05]";

export default function StartInvestigationView() {
  const navigate = useSasiStore((s) => s.navigate);
  const startInvestigationFor = useSasiStore((s) => s.startInvestigationFor);
  const savedLocation = useSasiStore((s) => s.savedLocation);
  const cases = useSasiStore((s) => s.cases);

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [service, setService] = useState<ServiceKey>("water");
  const [location, setLocation] = useState(
    `${savedLocation.suburb}, ${savedLocation.city}`
  );
  const [attempted, setAttempted] = useState(false);

  const eligible = useMemo(
    () =>
      cases.filter((c) =>
        ["OPEN", "ACTION_REQUIRED", "INVESTIGATING"].includes(c.status)
      ),
    [cases]
  );

  const effectiveSelection =
    selectedCase ?? (eligible.length > 0 ? eligible[0].id : null);

  const canStart =
    mode === "existing"
      ? Boolean(effectiveSelection)
      : description.trim().length > 0;

  const handleStart = () => {
    setAttempted(true);
    if (!canStart) return;

    if (mode === "existing" && effectiveSelection) {
      startInvestigationFor(effectiveSelection);
      return;
    }

    /* new issue: record it as a report, then investigate immediately */
    const store = useSasiStore.getState();
    store.setReportDraft({
      service,
      problem: description.trim(),
      location: location.trim() || `${savedLocation.suburb}, ${savedLocation.city}`,
      when: "today",
      impact: "",
      evidenceNote: "",
    });
    store.submitReport();
    const newCaseId = useSasiStore.getState().activeCaseId;
    if (newCaseId) startInvestigationFor(newCaseId);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <SectionLabel>Investigate</SectionLabel>
          <h1 className="mt-1.5 text-[18px] font-semibold tracking-tight text-white">
            Investigate an issue
          </h1>
          <p className="mt-1 max-w-md text-[13px] leading-relaxed text-zinc-500">
            Tell SASI the essentials — it asks only what it needs.
          </p>
        </div>
      </header>

      {/* mode toggle */}
      <div
        className="mt-5 grid grid-cols-2 gap-1 rounded-lg border border-white/8 bg-white/[0.02] p-1"
        role="tablist"
        aria-label="Choose what to investigate"
      >
        <button
          role="tab"
          aria-selected={mode === "existing"}
          onClick={() => {
            setMode("existing");
            setAttempted(false);
          }}
          className={cn(
            "flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-[12.5px] font-medium transition-colors",
            mode === "existing"
              ? "bg-white/10 text-white"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <Search className="h-3.5 w-3.5" aria-hidden /> Existing case
        </button>
        <button
          role="tab"
          aria-selected={mode === "new"}
          onClick={() => {
            setMode("new");
            setAttempted(false);
          }}
          className={cn(
            "flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-[12.5px] font-medium transition-colors",
            mode === "new"
              ? "bg-white/10 text-white"
              : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          <PenLine className="h-3.5 w-3.5" aria-hidden /> Describe new
        </button>
      </div>

      {/* panel */}
      <motion.div
        key={mode}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="sasi-card mt-4 p-4 sm:p-5"
      >
        {mode === "existing" ? (
          <div
            className="space-y-2"
            role="radiogroup"
            aria-label="Pick a case to investigate"
          >
            {eligible.length === 0 ? (
              <p className="rounded-lg border border-white/8 bg-white/[0.02] p-4 text-[13px] leading-relaxed text-zinc-500">
                No open cases right now. Describe a new issue instead — SASI will
                record it and start investigating.
              </p>
            ) : (
              eligible.map((c) => {
                const selected = effectiveSelection === c.id;
                return (
                  <button
                    key={c.id}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      setSelectedCase(c.id);
                      setAttempted(false);
                    }}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-all active:scale-[0.99]",
                      selected
                        ? "border-white/40 bg-white/[0.06]"
                        : "border-white/8 hover:border-white/20"
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        selected ? "border-white" : "border-zinc-600"
                      )}
                    >
                      {selected && (
                        <span className="h-2 w-2 rounded-full bg-white" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-zinc-100">
                        {c.title}
                      </span>
                      <span className="mt-0.5 block font-mono text-[10.5px] tracking-wider text-zinc-600">
                        {c.ref} · {c.location.city}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[0.12em]",
                        c.status === "ACTION_REQUIRED"
                          ? "bg-[#e3c567]/10 text-[#efe0a8]"
                          : c.status === "INVESTIGATING"
                            ? "bg-[#64b5f6]/10 text-[#a7d3f9]"
                            : "bg-white/6 text-zinc-400"
                      )}
                    >
                      {c.status.replace("_", " ")}
                    </span>
                  </button>
                );
              })
            )}
            {attempted && !canStart && (
              <p className="text-[12px] text-[#fda4a0]">
                Select a case to continue.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <SectionLabel className="mb-2">Describe the issue</SectionLabel>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setAttempted(false);
                }}
                placeholder="What is happening? One or two sentences is enough — SASI will research the rest."
                aria-label="Describe the issue"
                rows={4}
                className={INPUT_CLS}
              />
              {attempted && !description.trim() && (
                <p className="mt-1.5 text-[12px] text-[#fda4a0]">
                  Write a short description so SASI knows what to investigate.
                </p>
              )}
            </div>

            <div>
              <SectionLabel className="mb-2">Service</SectionLabel>
              <div
                className="grid grid-cols-4 gap-2"
                role="radiogroup"
                aria-label="Which service is affected"
              >
                {POPULAR_SERVICES.map((key) => {
                  const selected = service === key;
                  return (
                    <button
                      key={key}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setService(key)}
                      aria-label={SERVICES[key].label}
                      className={cn(
                        "flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2.5 text-[10.5px] transition-all active:scale-[0.98]",
                        selected
                          ? "border-white/40 bg-white/[0.06] text-white"
                          : "border-white/8 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                      )}
                    >
                      <span className={selected ? SERVICE_TINT[key] : "text-zinc-600"}>
                        <ServiceIcon service={key} className="h-4 w-4" />
                      </span>
                      <span className="truncate">{SERVICES[key].label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <SectionLabel className="mb-2">Location</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {[`${savedLocation.suburb}, ${savedLocation.city}`, ...LOCATION_CHIPS].map(
                  (chip) => (
                    <button
                      key={chip}
                      onClick={() => setLocation(chip)}
                      className={cn(
                        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[12px] transition-colors",
                        location === chip
                          ? "border-white/40 bg-white/[0.06] text-white"
                          : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                      )}
                    >
                      <MapPin className="h-3 w-3" aria-hidden />
                      {chip === `${savedLocation.suburb}, ${savedLocation.city}`
                        ? `${chip} (saved)`
                        : chip}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 border-t border-white/5 pt-4">
          <PrimaryButton
            onClick={handleStart}
            disabled={!canStart}
            className="min-h-11 w-full sm:w-auto sm:px-6"
            aria-label="Start investigation"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> Start investigation
          </PrimaryButton>
          {mode === "new" && (
            <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-600">
              SASI records this as a report first, then opens the investigation
              workspace. Nothing is sent to any authority.
            </p>
          )}
        </div>
      </motion.div>

      {/* what the investigation will do */}
      <div className="sasi-card mt-4 p-4 sm:p-5">
        <SectionLabel>What the investigation will do</SectionLabel>
        <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Investigation flow">
          {FLOW_CHIPS.map((chip, i) => (
            <span key={chip} className="flex items-center gap-1.5">
              {i > 0 && (
                <ArrowRight className="h-3 w-3 text-zinc-700" aria-hidden />
              )}
              <span className="rounded border border-white/8 bg-white/[0.03] px-2 py-1 font-mono text-[9.5px] font-semibold tracking-[0.12em] text-zinc-400">
                {chip}
              </span>
            </span>
          ))}
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-zinc-500">
          SASI researches official and public sources, correlates them with your
          evidence, and prepares findings. If an action is needed — such as a
          service report — SASI always asks for your approval first.
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[12px] text-zinc-600">
            Prefer the full guided form?
          </p>
          <GhostButton
            onClick={() => navigate("report")}
            className="h-8 px-3 text-[12px]"
          >
            Use the report flow
          </GhostButton>
        </div>
      </div>
    </div>
  );
}
