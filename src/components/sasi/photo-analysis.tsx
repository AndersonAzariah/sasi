"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  ScanSearch,
  StickyNote,
} from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import type { EvidenceAnalysis, EvidenceItem } from "@/lib/sasi/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ThinkingDots, useRotatingStatus } from "@/components/sasi/primitives";

/* ============================================================
   PhotoAnalysisPanel — "SASI reads this photo" for evidence
   that already lives in the vault. Fetches the bundled demo
   photo, downscales it, POSTs it to /api/sasi/vision and
   renders the structured result with honest AI framing.
   The photo itself is never persisted — only the analysis.
   ============================================================ */

const SEVERITY_CLS: Record<EvidenceAnalysis["severity"], string> = {
  LOW: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
  MEDIUM: "border-[#e3c567]/35 bg-[#e3c567]/10 text-[#e3c567]",
  HIGH: "border-orange-400/35 bg-orange-400/10 text-orange-300",
  CRITICAL: "border-[#ef5350]/40 bg-[#ef5350]/10 text-[#fda4a0]",
};

/** module-level so the rotating-status interval never resets on re-render */
const WORK_STAGES = [
  "FRAMING THE SCENE…",
  "READING TEXTURES…",
  "GAUGING SEVERITY…",
] as const;

/** Downscale an image data-URL to ≤1280px compact JPEG. */
function scaleDataUrl(src: string, maxDim = 1280, quality = 0.82): Promise<string> {
  return new Promise((res, rej) => {
    const img = document.createElement("img");
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      if (scale >= 1 && src.length < 2_600_000) return res(src);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return res(src);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      res(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => rej(new Error("That photo could not be read."));
    img.src = src;
  });
}

export function PhotoAnalysisPanel({ item }: { item: EvidenceItem }) {
  const savedLocation = useSasiStore((s) => s.savedLocation);
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<EvidenceAnalysis | null>(null);
  const filedRef = useRef(false);
  /* hook at the top level — the working branch below only renders it */
  const workStage = useRotatingStatus(WORK_STAGES);

  const analyse = async () => {
    if (state === "working") return;
    setState("working");
    setError(null);
    setAnalysis(null);
    filedRef.current = false;
    try {
      /* demo photos are bundled at /demo/<key>.jpg — fetch → scale → analyse */
      const res = await fetch(`/demo/${item.imageKey ?? "leak-street"}.jpg`);
      if (!res.ok) throw new Error("The photo file could not be loaded.");
      const blob = await res.blob();
      const rawUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("The photo could not be read."));
        r.readAsDataURL(blob);
      });
      const dataUrl = await scaleDataUrl(rawUrl);

      const api = await fetch("/api/sasi/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: dataUrl,
          context: {
            problem: item.title,
            location: item.location ?? `${savedLocation.suburb}, ${savedLocation.city}`,
          },
        }),
      });
      const data = (await api.json()) as { analysis?: EvidenceAnalysis; error?: string };
      if (!api.ok || !data.analysis) {
        throw new Error(data.error ?? "SASI could not analyse that photo.");
      }
      setAnalysis(data.analysis);
      setState("done");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "SASI could not analyse that photo just now.");
      setState("error");
    }
  };

  /* reset when a different item is previewed */
  useEffect(() => {
    setState("idle");
    setAnalysis(null);
    setError(null);
    filedRef.current = false;
  }, [item.id]);

  const fileAsNote = () => {
    if (!analysis || filedRef.current) return;
    filedRef.current = true;
    const caption = analysis.suggested_caption || `Photo read — ${item.title}`;
    useSasiStore.getState().addEvidence({
      id: `EVD-read-${Date.now()}`,
      type: "NOTE",
      title: `AI photo read — ${caption}`,
      description: analysis.what_i_see,
      createdAt: new Date().toISOString(),
      location: item.location,
      caseId: item.caseId,
      verification: "INFERRED",
    });
    toast.success("Analysis filed as evidence", {
      description: "A note is now in your Evidence Vault — labelled AI-inferred, not proof.",
    });
  };

  /* ---------- idle ---------- */
  if (state === "idle") {
    return (
      <div className="rounded-lg border border-[#e3c567]/20 bg-[#e3c567]/[0.04] p-3.5">
        <p className="text-[12.5px] font-medium text-[#efe0a8]">
          SASI can read this photo
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">
          The AI visual analyst will describe the scene, guess the service and rate
          the severity — labelled AI-inferred, never proof.
        </p>
        <button
          onClick={() => void analyse()}
          className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e3c567]/35 bg-[#e3c567]/10 px-3 text-[12px] font-medium text-[#e3c567] transition-colors hover:bg-[#e3c567]/[0.16]"
        >
          <ScanSearch className="h-3.5 w-3.5" aria-hidden />
          Analyse this photo
        </button>
      </div>
    );
  }

  /* ---------- working ---------- */
  if (state === "working") {
    return (
      <div
        className="rounded-lg border border-white/8 bg-white/[0.02] p-3.5"
        aria-live="polite"
        aria-label="SASI is reading the photo"
      >
        <div className="flex items-center gap-2">
          <span className="sasi-breathe h-2 w-2 rounded-full bg-[#e3c567]" aria-hidden />
          <p className="text-[12.5px] font-medium text-white">SASI is reading the photo…</p>
        </div>
        {/* honest stage line + national lights — no skeleton bars */}
        <p className="mt-3 font-mono text-[10px] tracking-[0.16em] text-zinc-500">
          {workStage.toUpperCase()}
        </p>
        <ThinkingDots className="mt-2.5" label="SASI is reading the photo" />
      </div>
    );
  }

  /* ---------- error ---------- */
  if (state === "error") {
    return (
      <div className="rounded-lg border border-[#ef5350]/25 bg-[#ef5350]/[0.06] p-3.5">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#fda4a0]" aria-hidden />
          <div className="min-w-0">
            <p className="text-[12.5px] font-medium text-[#fda4a0]">Analysis failed</p>
            <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">{error}</p>
            <button
              onClick={() => void analyse()}
              className="mt-2 text-[12px] font-medium text-[#e3c567] transition-colors hover:text-[#f0d98c]"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- result ---------- */
  return (
    <div className="rounded-lg border border-[#e3c567]/22 bg-[#e3c567]/[0.035] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          <Camera className="h-3 w-3 text-[#e3c567]" aria-hidden />
          SASI visual analysis
        </p>
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-[0.12em]",
            analysis ? SEVERITY_CLS[analysis.severity] : ""
          )}
        >
          {analysis?.severity} SEVERITY
        </span>
      </div>

      <p className="mt-2.5 text-[13px] leading-relaxed text-zinc-200">
        {analysis?.what_i_see}
      </p>

      {analysis?.useful_for.length ? (
        <ul className="mt-2.5 space-y-1">
          {analysis.useful_for.map((u, i) => (
            <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-zinc-300">
              <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-[#e3c567]/70" aria-hidden />
              {u}
            </li>
          ))}
        </ul>
      ) : null}

      {analysis?.notable.length ? (
        <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-500">
          Notable: {analysis.notable.join(" · ")}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={fileAsNote}
          disabled={filedRef.current}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium transition-colors",
            filedRef.current
              ? "cursor-default border-[#66bb6a]/30 bg-[#66bb6a]/10 text-[#a5d6a7]"
              : "border-white/12 bg-white/[0.04] text-zinc-200 hover:border-[#e3c567]/45 hover:text-white"
          )}
        >
          {filedRef.current ? (
            <>
              <Check className="h-3.5 w-3.5" aria-hidden /> Filed to vault
            </>
          ) : (
            <>
              <StickyNote className="h-3.5 w-3.5" aria-hidden /> File as evidence note
            </>
          )}
        </button>
        <button
          onClick={() => void analyse()}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-zinc-500 transition-colors hover:text-white"
        >
          Re-analyse
        </button>
      </div>

      {analysis?.quality_tip && (
        <p className="mt-2.5 rounded-md border border-white/8 bg-white/[0.02] px-2.5 py-2 text-[11.5px] leading-relaxed text-zinc-500">
          <span className="font-medium text-zinc-400">Better photo tip:</span>{" "}
          {analysis.quality_tip}
        </p>
      )}

      <p className="mt-2.5 text-[11px] text-zinc-600">
        AI-assisted read of a demo photo — not proof, not an official finding. The
        photo itself is not stored.
      </p>
    </div>
  );
}
