"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  Link2,
  Loader2,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  StickyNote,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSasiStore } from "@/lib/sasi/store";
import { useT, type TKey } from "@/lib/sasi/i18n";
import { POPULAR_SERVICES, SERVICE_REPORT_OPTIONS } from "@/lib/sasi/data";
import { SERVICES, formatDate } from "@/lib/sasi/utils";
import type { EvidenceAnalysis, ServiceKey } from "@/lib/sasi/types";
import {
  DemoBadge,
  GhostButton,
  PrimaryButton,
  SectionLabel,
  ServiceIcon,
  SERVICE_TINT,
  ThinkingDots,
} from "@/components/sasi/primitives";

/* ============================================================
   REPORT WIZARD — What / Where / When / Impact / Evidence /
   Review / Done. Draft persists into store.reportDraft so
   navigation never loses input.
   ============================================================ */

/* Step labels are display-only; stored drafts keep canonical values. */
const STEP_KEYS: TKey[] = [
  "rp.step.what",
  "rp.step.where",
  "rp.step.when",
  "cd.impact",
  "cd.tab.evidence",
  "rp.step.review",
  "rp.step.done",
];

const GENERIC_PROBLEM_OPTIONS = [
  "Service not delivered",
  "Damaged or unsafe infrastructure",
  "No response to a previous report",
  "Billing or account problem",
  "Other",
];

/* Display labels for the canonical English problem option values
   (SERVICE_REPORT_OPTIONS + GENERIC_PROBLEM_OPTIONS). Unknown values
   (the user's own "Other" text) render as-is. */
const PROBLEM_KEYS: Record<string, TKey> = {
  "Service not delivered": "rp.problem.not-delivered",
  "Damaged or unsafe infrastructure": "rp.problem.infrastructure",
  "No response to a previous report": "rp.problem.no-response",
  "Billing or account problem": "rp.problem.billing",
  Other: "rp.problem.other",
  "No water": "rp.problem.no-water",
  "Low pressure": "rp.problem.low-pressure",
  "Burst pipe": "rp.problem.burst-pipe",
  Leak: "rp.problem.leak",
  "Dirty / discoloured water": "rp.problem.dirty-water",
  "Infrastructure damage": "rp.problem.infra-damage",
};

const LOCATION_CHIPS = [
  "Johannesburg",
  "Soweto",
  "Sandton",
  "Midrand",
  "Pretoria",
];

type EvidenceChip = { id: string; kind: "note" | "link" | "photo"; value: string };

function serializeEvidence(items: EvidenceChip[]): string {
  return items
    .map((i) =>
      `${i.kind === "photo" ? "Photo" : i.kind === "link" ? "Link" : "Note"}: ${i.value}`
    )
    .join(" | ");
}

function parseEvidenceNote(note: string): EvidenceChip[] {
  if (!note) return [];
  return note.split(" | ").map((part, i) => {
    const lower = part.toLowerCase();
    const kind: EvidenceChip["kind"] = lower.startsWith("link:")
      ? "link"
      : lower.startsWith("photo:")
        ? "photo"
        : "note";
    return {
      id: `evd-${i}-${Math.random().toString(36).slice(2, 6)}`,
      kind,
      value: part.replace(/^(note|link|photo):\s*/i, ""),
    };
  });
}

function whenLabel(w: string, t: (k: TKey) => string): string {
  if (w === "today") return t("rp.when.today");
  if (w === "yesterday") return t("rp.when.yesterday");
  if (w === "older") return t("rp.when.older");
  if (w) return formatDate(w);
  return "—";
}

/* ---------- photo → analysis support ---------- */

const SEVERITY_STYLE: Record<EvidenceAnalysis["severity"], string> = {
  LOW: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  MEDIUM: "border-[#e3c567]/35 bg-[#e3c567]/10 text-[#e3c567]",
  HIGH: "border-orange-400/35 bg-orange-400/10 text-orange-300",
  CRITICAL: "border-[#ef5350]/40 bg-[#ef5350]/10 text-[#fda4a0]",
};

/** Read a File, downscale to ≤1280px and re-encode as compact JPEG. */
async function fileToScaledDataUrl(
  file: File,
  maxDim = 1280,
  quality = 0.82
): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("rp.err.read"));
    r.readAsDataURL(file);
  });
  const img = document.createElement("img");
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("rp.err.image"));
    img.src = dataUrl;
  });
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale >= 1 && dataUrl.length < 2_600_000) return dataUrl;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
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
  const t = useT();
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

  /* ---- photo evidence + SASI vision analysis ---- */
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [photo, setPhoto] = useState<{ dataUrl: string; name: string } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<EvidenceAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const analysisUsedRef = useRef(false);

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

  /* ---- SASI vision: pick → downscale → analyse ---- */
  const runPhotoAnalysis = async (dataUrl: string) => {
    setAnalyzing(true);
    setAnalysis(null);
    setAnalysisError(null);
    try {
      const res = await fetch("/api/sasi/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: dataUrl,
          context: { service, problem, location },
        }),
      });
      const data = (await res.json()) as { analysis?: EvidenceAnalysis; error?: string };
      if (!res.ok || !data.analysis) {
        throw new Error(data.error ?? t("rp.err.analyse"));
      }
      setAnalysis(data.analysis);
      analysisUsedRef.current = false;
    } catch (err) {
      setAnalysisError(
        err instanceof Error && err.message
          ? err.message
          : t("rp.err.analyse-now")
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handlePhotoFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) {
      setAnalysisError(t("rp.err.format"));
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setAnalysisError(t("rp.err.size"));
      return;
    }
    try {
      const dataUrl = await fileToScaledDataUrl(file);
      setPhoto({ dataUrl, name: file.name });
      setAnalysis(null);
      setAnalysisError(null);
      void runPhotoAnalysis(dataUrl);
    } catch (err) {
      setAnalysisError(
        err instanceof Error && err.message
          ? err.message.startsWith("rp.")
            ? t(err.message)
            : err.message
          : t("rp.err.read")
      );
    }
  };

  const useAnalysisAsNote = () => {
    if (!analysis || analysisUsedRef.current) return;
    analysisUsedRef.current = true;
    const caption = analysis.suggested_caption || t("rp.evidence.photo-fallback");
    setEvidenceItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-photo`,
        kind: "photo",
        value: `${caption} ${t("rp.evidence.analysis-suffix")}`,
      },
    ]);
    useSasiStore.getState().addEvidence({
      id: `EVD-user-${Date.now()}`,
      type: "PHOTO",
      title: caption,
      description: analysis.what_i_see,
      createdAt: new Date().toISOString(),
      location: location.trim() || undefined,
      verification: "UNVERIFIED",
      isDemo: true,
    });
    toast.success(t("rp.toast.photo-title"), {
      description: t("rp.toast.photo-desc"),
    });
  };

  const clearPhoto = () => {
    setPhoto(null);
    setAnalysis(null);
    setAnalysisError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
              <SectionLabel className="mb-2">{t("cd.facts.service")}</SectionLabel>
              <div
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                role="radiogroup"
                aria-label={t("rp.service-aria")}
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
              <SectionLabel className="mb-2">{t("rp.problem.title")}</SectionLabel>
              <div
                className="grid gap-2 sm:grid-cols-2"
                role="radiogroup"
                aria-label={t("rp.problem.aria")}
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
                      {PROBLEM_KEYS[opt] ? t(PROBLEM_KEYS[opt]) : opt}
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
                    placeholder={t("rp.problem.placeholder")}
                    aria-label={t("rp.problem.placeholder")}
                    className={INPUT_CLS}
                  />
                </div>
              )}
              {attempted && !problem.trim() && (
                <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#fda4a0]">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                  {t("rp.problem.required")}
                </p>
              )}
            </div>
          </StepShell>
        );

      case 1:
        return (
          <StepShell>
            <div>
              <SectionLabel className="mb-2">{t("rp.where.title")}</SectionLabel>
              <input
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  setAttempted(false);
                }}
                onKeyDown={handleEnterKey}
                placeholder={t("rp.where.placeholder")}
                aria-label={t("rp.where.aria")}
                className={INPUT_CLS}
              />
              <p className="mt-1.5 text-[12px] text-zinc-600">
                {t("rp.where.hint")}
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
                        ? t("rp.where.use-saved").replace("{loc}", chip)
                        : chip}
                    </button>
                  )
                )}
              </div>
              {attempted && !location.trim() && (
                <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[#fda4a0]">
                  <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                  {t("rp.where.required")}
                </p>
              )}
            </div>
          </StepShell>
        );

      case 2:
        return (
          <StepShell>
            <div>
              <SectionLabel className="mb-2">{t("rp.when.title")}</SectionLabel>
              <div
                className="grid gap-2 sm:grid-cols-2"
                role="radiogroup"
                aria-label={t("rp.when.aria")}
              >
                {[
                  { value: "today", label: t("rp.when.today") },
                  { value: "yesterday", label: t("rp.when.yesterday") },
                  { value: "older", label: t("rp.when.older") },
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
                  <span className="shrink-0">{t("rp.when.custom")}</span>
                  <input
                    type="date"
                    value={!["today", "yesterday", "older"].includes(when) ? when : ""}
                    onChange={(e) => e.target.value && setWhen(e.target.value)}
                    aria-label={t("rp.when.custom-aria")}
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
              <SectionLabel className="mb-2">{t("rp.impact.title")}</SectionLabel>
              <textarea
                value={impact}
                onChange={(e) => setImpact(e.target.value)}
                placeholder={t("rp.impact.placeholder")}
                aria-label={t("rp.impact.aria")}
                rows={5}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-[13.5px] leading-relaxed text-white placeholder:text-zinc-600 outline-none transition-colors focus:border-white/30 focus:bg-white/[0.05]"
              />
              <p className="mt-1.5 text-[12px] text-zinc-600">
                {t("rp.impact.hint")}
              </p>
            </div>
          </StepShell>
        );

      case 4:
        return (
          <StepShell>
            <div>
              <SectionLabel className="mb-2">{t("rp.evidence.title")}</SectionLabel>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => void handlePhotoFile(e.target.files?.[0])}
              />
              {!photo ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.015] px-4 py-7 text-center transition-colors hover:border-[#e3c567]/40 hover:bg-white/[0.03]"
                  aria-label={t("rp.evidence.photo-aria")}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-400 transition group-hover:border-[#e3c567]/30 group-hover:text-[#e3c567]">
                    <Camera className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <span className="text-[13px] font-medium text-zinc-200">
                    {t("rp.evidence.photo-title")}
                  </span>
                  <span className="text-[11.5px] text-zinc-600">
                    {t("rp.evidence.photo-hint")}
                  </span>
                </button>
              ) : (
                <div className="overflow-hidden rounded-xl border border-white/10">
                  <div className="relative">
                    <img
                      src={photo.dataUrl}
                      alt={t("rp.evidence.attached-alt").replace("{name}", photo.name)}
                      className="max-h-44 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={clearPhoto}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-black/60 text-zinc-300 backdrop-blur transition hover:text-white"
                      aria-label={t("rp.evidence.remove-photo")}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <span className="absolute bottom-2 left-2 rounded-md border border-white/15 bg-black/60 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-zinc-300 backdrop-blur">
                      {t("rp.evidence.attached-tag")}
                    </span>
                  </div>

                  <div className="border-t border-white/8 bg-white/[0.02] p-3.5">
                    {analyzing && (
                      <div className="flex items-start gap-3">
                        <div className="sasi-glow-soft mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e3c567]/25 bg-[#e3c567]/10">
                          <Loader2
                            className="h-4 w-4 animate-spin text-[#e3c567]"
                            aria-hidden
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-medium text-zinc-200">
                            {t("rp.evidence.reading")}
                          </p>
                          {/* national thinking lights — no skeleton bars */}
                          <ThinkingDots className="mt-3" label="SASI is reading the photo" />
                        </div>
                      </div>
                    )}

                    {!analyzing && analysisError && (
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#ef5350]/30 bg-[#ef5350]/10 text-[#ef5350]">
                          <AlertCircle className="h-4 w-4" aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] text-[#fda4a0]">{analysisError}</p>
                          <button
                            type="button"
                            onClick={() => void runPhotoAnalysis(photo.dataUrl)}
                            className="mt-1.5 inline-flex h-7 items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-2.5 text-[11.5px] text-zinc-300 transition hover:border-white/25 hover:text-white"
                          >
                            <RefreshCw className="h-3 w-3" aria-hidden />
                            {t("rp.evidence.try-again")}
                          </button>
                        </div>
                      </div>
                    )}

                    {!analyzing && analysis && (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                      >
                        <div className="flex items-center gap-2">
                          <ScanSearch
                            className="h-4 w-4 shrink-0 text-[#e3c567]"
                            aria-hidden
                          />
                          <p className="min-w-0 flex-1 text-[12.5px] font-semibold text-white">
                            {t("rp.evidence.analysis-title")}
                          </p>
                          <span
                            className={cn(
                              "rounded-full border px-2 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wider",
                              SEVERITY_STYLE[analysis.severity]
                            )}
                          >
                            {analysis.severity}
                          </span>
                        </div>

                        <p className="mt-2 text-[12.5px] leading-relaxed text-zinc-300">
                          {analysis.what_i_see}
                        </p>

                        {analysis.service_guess && (
                          <p className="mt-2 text-[11.5px] text-zinc-500">
                            {t("rp.evidence.reads-like")}{" "}
                            <span className="font-medium text-zinc-300">
                              {analysis.service_guess}
                            </span>
                            {analysis.service_guess !== service && (
                              <button
                                type="button"
                                onClick={() => setService(analysis.service_guess)}
                                className="ml-1.5 text-[11px] font-medium text-[#e3c567] underline decoration-[#e3c567]/40 underline-offset-2 transition hover:decoration-[#e3c567]"
                              >
                                {t("rp.evidence.change-service").replace("{svc}", analysis.service_guess)}
                              </button>
                            )}
                          </p>
                        )}

                        {analysis.useful_for.length > 0 && (
                          <div className="mt-2.5 space-y-1">
                            {analysis.useful_for.map((u, i) => (
                              <div key={i} className="flex gap-2">
                                <span
                                  className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-[#e3c567]/70"
                                  aria-hidden
                                />
                                <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-zinc-400">
                                  {u}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {analysis.notable.length > 0 && (
                          <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500">
                            {t("rp.evidence.also-noted")} {analysis.notable.join(" · ")}
                          </p>
                        )}

                        {analysis.quality_tip && (
                          <p className="mt-2 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2 text-[11px] leading-relaxed text-zinc-500">
                            <span className="font-medium text-zinc-400">{t("rp.evidence.tip")} </span>
                            {analysis.quality_tip}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {!analysisUsedRef.current ? (
                            <button
                              type="button"
                              onClick={useAnalysisAsNote}
                              className="sasi-btn-sheen inline-flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[12px] font-medium text-black transition hover:bg-zinc-200 active:scale-[0.98]"
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden />
                              {t("rp.evidence.use-note")}
                            </button>
                          ) : (
                            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#66bb6a]/25 bg-[#66bb6a]/10 px-3 text-[12px] font-medium text-[#8fd694]">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                              {t("rp.evidence.filed")}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => void runPhotoAnalysis(photo.dataUrl)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.03] px-2.5 text-[12px] text-zinc-400 transition hover:border-white/25 hover:text-zinc-200"
                          >
                            <RefreshCw className="h-3 w-3" aria-hidden />
                            {t("rp.evidence.reanalyse")}
                          </button>
                        </div>

                        <p className="mt-2.5 flex items-center gap-1.5 text-[10px] text-zinc-600">
                          <ShieldCheck className="h-3 w-3 shrink-0 text-zinc-600" aria-hidden />
                          {t("rp.evidence.ai-note")}
                        </p>
                      </motion.div>
                    )}
                  </div>
                </div>
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
                      placeholder={t("rp.evidence.note-placeholder")}
                      aria-label={t("rp.evidence.note-aria")}
                      className={cn(INPUT_CLS, "pl-9")}
                    />
                  </div>
                  <GhostButton
                    onClick={() => addEvidence("note")}
                    className="h-11 shrink-0 px-3"
                    aria-label={t("rp.evidence.add-note-aria")}
                  >
                    {t("rp.add")}
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
                      placeholder={t("rp.evidence.link-placeholder")}
                      aria-label={t("rp.evidence.link-aria")}
                      className={cn(INPUT_CLS, "pl-9")}
                    />
                  </div>
                  <GhostButton
                    onClick={() => addEvidence("link")}
                    className="h-11 shrink-0 px-3"
                    aria-label={t("rp.evidence.add-link-aria")}
                  >
                    {t("rp.add")}
                  </GhostButton>
                </div>
              </div>

              {evidenceItems.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {evidenceItems.map((item) => (
                    <span
                      key={item.id}
                      className={cn(
                        "inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-1.5 text-[11.5px]",
                        item.kind === "photo"
                          ? "border-[#e3c567]/30 bg-[#e3c567]/[0.08] text-[#e3c567]"
                          : "border-white/10 bg-white/[0.04] text-zinc-300"
                      )}
                    >
                      {item.kind === "note" ? (
                        <StickyNote className="h-3 w-3 shrink-0 text-zinc-500" aria-hidden />
                      ) : item.kind === "photo" ? (
                        <Camera className="h-3 w-3 shrink-0 text-[#e3c567]" aria-hidden />
                      ) : (
                        <Link2 className="h-3 w-3 shrink-0 text-zinc-500" aria-hidden />
                      )}
                      <span className="truncate">{item.value}</span>
                      <button
                        onClick={() =>
                          setEvidenceItems((prev) => prev.filter((p) => p.id !== item.id))
                        }
                        aria-label={t("rp.evidence.remove")
                          .replace("{kind}", t(`rp.kind.${item.kind}` as TKey))
                          .replace("{value}", item.value)}
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
            label: t("cd.facts.service"),
            value: SERVICES[serviceKey]?.label ?? service,
            editStep: 0,
          },
          {
            label: t("rp.review.problem"),
            value: problem
              ? PROBLEM_KEYS[problem]
                ? t(PROBLEM_KEYS[problem])
                : problem
              : "—",
            editStep: 0,
          },
          { label: t("rp.step.where"), value: location || "—", editStep: 1 },
          { label: t("rp.step.when"), value: whenLabel(when, t), editStep: 2 },
          { label: t("cd.impact"), value: impact.trim() || t("rp.review.not-provided"), editStep: 3 },
          {
            label: t("cd.tab.evidence"),
            value: evidenceItems.length
              ? evidenceItems.length === 1
                ? t("rp.review.items-one")
                : t("rp.review.items-many").replace("{n}", String(evidenceItems.length))
              : t("rp.review.none"),
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
                    aria-label={t("rp.review.edit-aria").replace("{what}", row.label)}
                  >
                    {t("rp.review.edit")}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-[#e3c567]/25 bg-[#e3c567]/[0.06] p-3.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#e3c567]" aria-hidden />
              <p className="text-[12.5px] leading-relaxed text-[#efe0a8]">
                {t("rp.review.submit-note")}
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
              {t("rp.done.title")}
            </h1>
            <p className="mt-1.5 font-mono text-[13px] tracking-[0.14em] text-zinc-400">
              {result.ref}
            </p>
            <p className="mx-auto mt-4 max-w-md text-[13px] leading-relaxed text-zinc-400">
              {t("rp.done.body")}
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
                {t("rp.done.start-investigation")}
              </PrimaryButton>
              <GhostButton
                onClick={() => useSasiStore.getState().openCase(result.ref)}
                className="min-h-11 w-full sm:w-auto"
              >
                {t("rp.done.view-case")}
              </GhostButton>
              <GhostButton
                onClick={() => useSasiStore.getState().navigate("dashboard")}
                className="min-h-11 w-full sm:w-auto"
              >
                {t("rp.done.back-dashboard")}
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
              {t("landing.cta.report")}
            </h1>
            <p className="mt-1 max-w-lg text-[13px] leading-relaxed text-zinc-500">
              {t("rp.subtitle")}
            </p>
          </div>
          <DemoBadge label="DEMO" className="mt-1 shrink-0" />
        </header>

        {/* stepper */}
        <nav className="mt-6" aria-label={t("rp.progress-aria")}>
          <div className="sasi-scroll flex items-center gap-1 overflow-x-auto pb-1">
            {STEP_KEYS.map((key, i) => {
              const label = t(key);
              const done = i < step;
              const current = i === step;
              return (
                <Fragment key={key}>
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
              style={{ width: `${((step + 1) / STEP_KEYS.length) * 100}%` }}
              role="progressbar"
              aria-valuenow={step + 1}
              aria-valuemin={1}
              aria-valuemax={STEP_KEYS.length}
              aria-label={t("rp.completion-aria")}
            />
          </div>
        </nav>

        {/* step body */}
        <div className="sasi-card mt-5 p-4 sm:p-6">
          <p className="mb-4 font-mono text-[10.5px] uppercase tracking-[0.16em] text-zinc-600">
            {t("rp.step-counter")
              .replace("{n}", String(step + 1))
              .replace("{total}", String(STEP_KEYS.length))
              .replace("{label}", t(STEP_KEYS[step]))}
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
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> {t("rp.back")}
            </GhostButton>
            {step < 5 ? (
              <PrimaryButton
                onClick={goNext}
                className="min-h-11 flex-1 sm:flex-none sm:px-6"
              >
                {t("rp.continue")} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
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
                {t("rp.submit")}
              </PrimaryButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
