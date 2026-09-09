"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Link2,
  Loader2,
  ShieldCheck,
  StickyNote,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSasiStore } from "@/lib/sasi/store";
import { POPULAR_SERVICES, SERVICE_REPORT_OPTIONS } from "@/lib/sasi/data";
import { SERVICES, formatDate } from "@/lib/sasi/utils";
import type { ServiceKey } from "@/lib/sasi/types";
import {
  DemoBadge,
  GhostButton,
  PrimaryButton,
  SectionLabel,
  ServiceIcon,
  SERVICE_TINT,
} from "@/components/sasi/primitives";

/* ============================================================
   REPORT WIZARD — What / Where / When / Impact / Evidence /
   Review / Done. Draft persists into store.reportDraft so
   navigation never loses input.
   ============================================================ */

const STEP_LABELS = [
  "What",
  "Where",
  "When",
  "Impact",
  "Evidence",
  "Review",
  "Done",
];

const GENERIC_PROBLEM_OPTIONS = [
  "Service not delivered",
  "Damaged or unsafe infrastructure",
  "No response to a previous report",
  "Billing or account problem",
  "Other",
];

const LOCATION_CHIPS = [
  "Johannesburg",
  "Soweto",
  "Sandton",
  "Midrand",
  "Pretoria",
];

type EvidenceChip = { id: string; kind: "note" | "link"; value: string };

function serializeEvidence(items: EvidenceChip[]): string {
  return items
    .map((i) => `${i.kind === "note" ? "Note" : "Link"}: ${i.value}`)
    .join(" | ");
}

function parseEvidenceNote(note: string): EvidenceChip[] {
  if (!note) return [];
  return note.split(" | ").map((part, i) => {
    const isLink = part.toLowerCase().startsWith("link:");
    return {
      id: `evd-${i}-${Math.random().toString(36).slice(2, 6)}`,
      kind: isLink ? "link" : "note",
      value: part.replace(/^(note|link):\s*/i, ""),
    };
  });
}

function whenLabel(w: string): string {
  if (w === "today") return "Today";
  if (w === "yesterday") return "Yesterday";
  if (w === "older") return "More than 2 days ago";
  if (w) return formatDate(w);
  return "—";
}

/* ---------- shared input styles ---------- */

const INPUT_CLS =
  "h-11 w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[13.5px] text-white placeholder:text-zinc-600 outline-none transition-colors focus:border-white/30 focus:bg-white/[0.05]";

function StepShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="space-y-5">{children}</div>;
}

function OptionCard({
  selected,
  onClick,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-[13px] transition-all active:scale-[0.99]",
        selected
          ? "border-white/40 bg-white/[0.06] text-white"
          : "border-white/8 bg-transparent text-zinc-400 hover:border-white/20 hover:text-zinc-200"
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
        selected ? "border-white" : "border-zinc-600"
      )}
    >
      {selected && <span className="h-2 w-2 rounded-full bg-white" />}
    </span>
  );
}

/* ============================================================
   VIEW
   ============================================================ */

export default function ReportView() {
  const storedDraft = useSasiStore((s) => s.reportDraft);
  const savedLocation = useSasiStore((s) => s.savedLocation);

  const [step, setStep] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ref: string; caseId: string } | null>(
    null
  );

  const [service, setService] = useState<string>(storedDraft?.service ?? "water");
  const [problem, setProblem] = useState(storedDraft?.problem ?? "");
  const [otherActive, setOtherActive] = useState(() => {
    const p = storedDraft?.problem ?? "";
    if (!p) return false;
    const opts = SERVICE_REPORT_OPTIONS[storedDraft?.service ?? "water"] ?? GENERIC_PROBLEM_OPTIONS;
    return !opts.includes(p);
  });
  const [location, setLocation] = useState(
    storedDraft?.location ??
      `${savedLocation.suburb}, ${savedLocation.city}`
  );
  const [when, setWhen] = useState(storedDraft?.when ?? "today");
  const [impact, setImpact] = useState(storedDraft?.impact ?? "");
  const [evidenceItems, setEvidenceItems] = useState<EvidenceChip[]>(() =>
    parseEvidenceNote(storedDraft?.evidenceNote ?? "")
  );
  const [noteInput, setNoteInput] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [uploadNote, setUploadNote] = useState(false);

  const doneRef = useRef(false);
  const problemInputRef = useRef<HTMLInputElement | null>(null);

  const problemOptions = useMemo(
    () => SERVICE_REPORT_OPTIONS[service] ?? GENERIC_PROBLEM_OPTIONS,
    [service]
  );
  const serviceKey = (service as ServiceKey) ?? "water";

  /* persist draft into the store so navigation does not lose input */
  useEffect(() => {
    if (doneRef.current) return;
    useSasiStore.getState().setReportDraft({
      service,
      problem,
      location,
      when,
      impact,
      evidenceNote: serializeEvidence(evidenceItems),
    });
  }, [service, problem, location, when, impact, evidenceItems]);

  const stepValid = useMemo(() => {
    switch (step) {
      case 0:
        return problem.trim().length > 0;
      case 1:
        return location.trim().length > 0;
      default:
        return true;
    }
  }, [step, problem, location]);

  const goNext = () => {
    if (!stepValid) {
      setAttempted(true);
      return;
    }
    setAttempted(false);
    if (step < 5) setStep(step + 1);
  };

  const goBack = () => {
    setAttempted(false);
    if (step > 0) setStep(step - 1);
  };

  const handleEnterKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && step < 5) {
      e.preventDefault();
      goNext();
    }
  };

  const addEvidence = (kind: "note" | "link") => {
    const raw = kind === "note" ? noteInput : linkInput;
    const value = raw.trim();
    if (!value) return;
    setEvidenceItems((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, kind, value }]);
    if (kind === "note") setNoteInput("");
    else setLinkInput("");
  };

  const handleSubmit = () => {
    if (submitting) return;
    if (!problem.trim() || !location.trim()) {
      setAttempted(true);
      return;
    }
    setSubmitting(true);
    window.setTimeout(() => {
      const store = useSasiStore.getState();
      store.setReportDraft({
        service,
        problem: problem.trim(),
        location: location.trim(),
        when,
        impact: impact.trim(),
        evidenceNote: serializeEvidence(evidenceItems),
      });
      const ref = store.submitReport();
      const newCaseId = useSasiStore.getState().activeCaseId;
      doneRef.current = true;
      useSasiStore.getState().clearReportDraft();
      setResult({ ref, caseId: newCaseId ?? "" });
      setSubmitting(false);
      setStep(6);
    }, 800);
  };

  /* ---------- step content ---------- */

  const stepContent = () => {
    switch (step) {
      case 0:
        return (
          <StepShell>
            <div>
              <SectionLabel className="mb-2">Service</SectionLabel>
              <div
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
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
                      onClick={() => {
                        setService(key);
                        const opts =
                          SERVICE_REPORT_OPTIONS[key] ?? GENERIC_PROBLEM_OPTIONS;
                        if (problem && !opts.includes(problem)) {
                          setProblem("");
                          setOtherActive(false);
                        }
                      }}
                      className={cn(
                        "flex min-h-11 flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-3 text-[12px] transition-all active:scale-[0.98]",
                        selected
                          ? "border-white/40 bg-white/[0.06] text-white"
                          : "border-white/8 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                      )}
                    >
                      <span className={cn(selected ? SERVICE_TINT[key] : "text-zinc-500")}>
                        <ServiceIcon service={key} className="h-4 w-4" />
                      </span>
                      {SERVICES[key].label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <SectionLabel className="mb-2">What is the problem</SectionLabel>
              <div
                className="grid gap-2 sm:grid-cols-2"
                role="radiogroup"
                aria-label="Problem description options"
              >
                {problemOptions.map((opt) => {
                  const isOther = opt === "Other";
                  const selected = isOther ? otherActive : problem === opt;
                  return (
                    <OptionCard
                      key={opt}
                      role="radio"
                      aria-checked={selected}
                      selected={selected}
                      onClick={() => {
                        if (isOther) {
                          setOtherActive(true);
                          setProblem("");
                          window.setTimeout(() => problemInputRef.current?.focus(), 0);
                        } else {
                          setOtherActive(false);
                          setProblem(opt);
                        }
                        setAttempted(false);
                      }}
                    >
                      <RadioDot selected={selected} />
                      {opt}
                    </OptionCard>
                  );
                })}
              </div>
              {otherActive && (
                <div className="mt-2">
                  <input
                    ref={problemInputRef}
                    value={problem}
                    onChange={(e) => {
                      setProblem(e.target.value);
                      setAttempted(false);
                    }}
                    onKeyDown={handleEnterKey}
                    placeholder="Describe the problem in your own words"
                    aria-label="Describe the problem in your own words"
                    className={INPUT_CLS}
                  />
                </div>
              )}
              {attempted && !problem.trim() && (
                <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#fda4a0]">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                  Choose an option or describe the problem to continue.
                </p>
              )}
            </div>
          </StepShell>
        );

      case 1:
        return (
          <StepShell>
            <div>
              <SectionLabel className="mb-2">Where is it happening</SectionLabel>
              <input
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setAttempted(false);
                }}
                onKeyDown={handleEnterKey}
                placeholder="Suburb, street or landmark"
                aria-label="Location of the issue"
                className={INPUT_CLS}
              />
              <p className="mt-1.5 text-[12px] text-zinc-600">
                Include a street or landmark if possible.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[`${savedLocation.suburb}, ${savedLocation.city}`, ...LOCATION_CHIPS].map(
                  (chip) => (
                    <button
                      key={chip}
                      onClick={() => setLocation(chip)}
                      className={cn(
                        "min-h-9 rounded-full border px-3 text-[12px] transition-colors",
                        location === chip
                          ? "border-white/40 bg-white/[0.06] text-white"
                          : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                      )}
                    >
                      {chip === `${savedLocation.suburb}, ${savedLocation.city}`
                        ? `Use my saved location (${chip})`
                        : chip}
                    </button>
                  )
                )}
              </div>
              {attempted && !location.trim() && (
                <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#fda4a0]">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                  Enter a location so SASI can match official sources to your area.
                </p>
              )}
            </div>
          </StepShell>
        );

      case 2:
        return (
          <StepShell>
            <div>
              <SectionLabel className="mb-2">When did it start</SectionLabel>
              <div
                className="grid gap-2 sm:grid-cols-2"
                role="radiogroup"
                aria-label="When the issue started"
              >
                {[
                  { value: "today", label: "Today" },
                  { value: "yesterday", label: "Yesterday" },
                  { value: "older", label: "More than 2 days ago" },
                ].map((opt) => {
                  const selected = when === opt.value;
                  return (
                    <OptionCard
                      key={opt.value}
                      role="radio"
                      aria-checked={selected}
                      selected={selected}
                      onClick={() => setWhen(opt.value)}
                    >
                      <RadioDot selected={selected} />
                      {opt.label}
                    </OptionCard>
                  );
                })}
                <label
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] transition-colors",
                    !["today", "yesterday", "older"].includes(when)
                      ? "border-white/40 bg-white/[0.06] text-white"
                      : "border-white/8 text-zinc-400 hover:border-white/20"
                  )}
                >
                  <RadioDot selected={!["today", "yesterday", "older"].includes(when)} />
                  <span className="shrink-0">Custom date</span>
                  <input
                    type="date"
                    value={!["today", "yesterday", "older"].includes(when) ? when : ""}
                    onChange={(e) => e.target.value && setWhen(e.target.value)}
                    aria-label="Custom start date"
                    className="min-w-0 flex-1 bg-transparent text-right text-[12.5px] text-zinc-300 outline-none [color-scheme:dark]"
                  />
                </label>
              </div>
            </div>
          </StepShell>
        );

      case 3:
        return (
          <StepShell>
            <div>
              <SectionLabel className="mb-2">Impact (optional)</SectionLabel>
              <textarea
                value={impact}
                onChange={(e) => setImpact(e.target.value)}
                placeholder="How is this affecting you, your household or the area?"
                aria-label="How is this affecting you"
                rows={5}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-[13.5px] leading-relaxed text-white placeholder:text-zinc-600 outline-none transition-colors focus:border-white/30 focus:bg-white/[0.05]"
              />
              <p className="mt-1.5 text-[12px] text-zinc-600">
                Impact helps SASI judge urgency. It is never shared without your approval.
              </p>
            </div>
          </StepShell>
        );

      case 4:
        return (
          <StepShell>
            <div>
              <SectionLabel className="mb-2">Evidence (optional)</SectionLabel>
              <button
                onClick={() => setUploadNote(true)}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.015] px-4 py-7 text-center transition-colors hover:border-white/25 hover:bg-white/[0.03]"
                aria-label="Add photo or file evidence"
              >
                <Upload className="h-5 w-5 text-zinc-500" aria-hidden />
                <span className="text-[13px] font-medium text-zinc-300">
                  Add a photo or file
                </span>
                <span className="text-[11.5px] text-zinc-600">
                  Tap to see what is supported in this demo
                </span>
              </button>
              {uploadNote && (
                <p className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-zinc-400">
                  File upload is coming soon. For the demo, add a note or link below.
                </p>
              )}

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <StickyNote
                      className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600"
                      aria-hidden
                    />
                    <input
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addEvidence("note");
                        }
                      }}
                      placeholder="Add a note"
                      aria-label="Add an evidence note"
                      className={cn(INPUT_CLS, "pl-9")}
                    />
                  </div>
                  <GhostButton
                    onClick={() => addEvidence("note")}
                    className="h-11 shrink-0 px-3"
                    aria-label="Add note"
                  >
                    Add
                  </GhostButton>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Link2
                      className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600"
                      aria-hidden
                    />
                    <input
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addEvidence("link");
                        }
                      }}
                      placeholder="Add a link"
                      aria-label="Add an evidence link"
                      className={cn(INPUT_CLS, "pl-9")}
                    />
                  </div>
                  <GhostButton
                    onClick={() => addEvidence("link")}
                    className="h-11 shrink-0 px-3"
                    aria-label="Add link"
                  >
                    Add
                  </GhostButton>
                </div>
              </div>

              {evidenceItems.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {evidenceItems.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-2.5 pr-1.5 text-[11.5px] text-zinc-300"
                    >
                      {item.kind === "note" ? (
                        <StickyNote className="h-3 w-3 shrink-0 text-zinc-500" aria-hidden />
                      ) : (
                        <Link2 className="h-3 w-3 shrink-0 text-zinc-500" aria-hidden />
                      )}
                      <span className="truncate">{item.value}</span>
                      <button
                        onClick={() =>
                          setEvidenceItems((prev) => prev.filter((p) => p.id !== item.id))
                        }
                        aria-label={`Remove ${item.kind}: ${item.value}`}
                        className="rounded-full p-0.5 text-zinc-500 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </StepShell>
        );

      case 5: {
        const rows: { label: string; value: string; editStep: number }[] = [
          {
            label: "Service",
            value: SERVICES[serviceKey]?.label ?? service,
            editStep: 0,
          },
          { label: "Problem", value: problem || "—", editStep: 0 },
          { label: "Where", value: location || "—", editStep: 1 },
          { label: "When", value: whenLabel(when), editStep: 2 },
          { label: "Impact", value: impact.trim() || "Not provided", editStep: 3 },
          {
            label: "Evidence",
            value: evidenceItems.length
              ? `${evidenceItems.length} item${evidenceItems.length === 1 ? "" : "s"} added`
              : "None added",
            editStep: 4,
          },
        ];
        return (
          <StepShell>
            <div className="overflow-hidden rounded-lg border border-white/8">
              {rows.map((row, i) => (
                <div
                  key={row.label}
                  className={cn(
                    "flex items-center justify-between gap-3 px-3.5 py-3",
                    i > 0 && "border-t border-white/5"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                      {row.label}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] text-zinc-200">
                      {row.value}
                    </p>
                  </div>
                  <button
                    onClick={() => setStep(row.editStep)}
                    className="shrink-0 rounded-md border border-white/10 px-2.5 py-1 text-[11.5px] text-zinc-400 transition-colors hover:border-white/25 hover:text-white"
                    aria-label={`Edit ${row.label}`}
                  >
                    Edit
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-[#e3c567]/25 bg-[#e3c567]/[0.06] p-3.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#e3c567]" aria-hidden />
              <p className="text-[12.5px] leading-relaxed text-[#efe0a8]">
                On submit, SASI records this report and can start an investigation.
                SASI will not contact any authority without your explicit approval.
              </p>
            </div>
          </StepShell>
        );
      }

      default:
        return null;
    }
  };

  /* ---------- done screen ---------- */

  if (step === 6 && result) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="sasi-card p-6 text-center sm:p-10"
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, delay: 0.1, ease: "easeOut" }}
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#66bb6a]/30 bg-[#66bb6a]/10"
            >
              <CheckCircle2 className="h-6 w-6 text-[#8ee09a]" aria-hidden />
            </motion.div>
            <h1 className="mt-4 text-[18px] font-semibold text-white">
              Reported to SASI
            </h1>
            <p className="mt-1.5 font-mono text-[13px] tracking-[0.14em] text-zinc-400">
              {result.ref}
            </p>
            <p className="mx-auto mt-4 max-w-md text-[13px] leading-relaxed text-zinc-400">
              This is recorded in SASI. It is NOT yet filed with any government
              authority. SASI investigates first and will ask your approval
              before any contact is made.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <PrimaryButton
                onClick={() => {
                  if (result.caseId) {
                    useSasiStore.getState().startInvestigationFor(result.caseId);
                  }
                }}
                className="min-h-11 w-full sm:w-auto"
                disabled={!result.caseId}
              >
                Start investigation now
              </PrimaryButton>
              <GhostButton
                onClick={() => useSasiStore.getState().openCase(result.ref)}
                className="min-h-11 w-full sm:w-auto"
              >
                View case
              </GhostButton>
              <GhostButton
                onClick={() => useSasiStore.getState().navigate("dashboard")}
                className="min-h-11 w-full sm:w-auto"
              >
                Back to dashboard
              </GhostButton>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  /* ---------- wizard ---------- */

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight text-white">
              Tell SASI what is happening
            </h1>
            <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-zinc-500">
              SASI will investigate and prepare next steps. Reporting to SASI is
              not a government submission — SASI will ask before contacting anyone.
            </p>
          </div>
          <DemoBadge label="DEMO" className="mt-1 shrink-0" />
        </header>

        {/* stepper */}
        <nav className="mt-6" aria-label="Report progress">
          <div className="sasi-scroll flex items-center gap-1 overflow-x-auto pb-1">
            {STEP_LABELS.map((label, i) => {
              const done = i < step;
              const current = i === step;
              return (
                <Fragment key={label}>
                  {i > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        "h-px w-3 shrink-0 sm:w-5",
                        i <= step ? "bg-white/25" : "bg-white/10"
                      )}
                    />
                  )}
                  <span
                    aria-current={current ? "step" : undefined}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-medium",
                      current
                        ? "border-white bg-white text-black"
                        : done
                          ? "border-white/10 bg-white/[0.03] text-zinc-400"
                          : "border-white/8 text-zinc-600"
                    )}
                  >
                    {done ? (
                      <Check className="h-3 w-3" aria-hidden />
                    ) : (
                      <span className="font-mono text-[9px] opacity-70">{i + 1}</span>
                    )}
                    {label}
                  </span>
                </Fragment>
              );
            })}
          </div>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white transition-all duration-300"
              style={{ width: `${((step + 1) / STEP_LABELS.length) * 100}%` }}
              role="progressbar"
              aria-valuenow={step + 1}
              aria-valuemin={1}
              aria-valuemax={STEP_LABELS.length}
              aria-label="Report completion"
            />
          </div>
        </nav>

        {/* step body */}
        <div className="sasi-card mt-5 p-4 sm:p-6">
          <p className="mb-4 font-mono text-[10.5px] uppercase tracking-[0.16em] text-zinc-600">
            Step {step + 1} of {STEP_LABELS.length} · {STEP_LABELS[step]}
          </p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {stepContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* footer nav */}
        {step < 6 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <GhostButton
              onClick={goBack}
              disabled={step === 0}
              className="min-h-11 flex-1 sm:flex-none sm:px-5"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back
            </GhostButton>
            {step < 5 ? (
              <PrimaryButton
                onClick={goNext}
                className="min-h-11 flex-1 sm:flex-none sm:px-6"
              >
                Continue <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </PrimaryButton>
            ) : (
              <PrimaryButton
                onClick={handleSubmit}
                disabled={submitting || !problem.trim() || !location.trim()}
                className="min-h-11 flex-1 sm:flex-none sm:px-6"
              >
                {submitting && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                )}
                Submit to SASI
              </PrimaryButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
