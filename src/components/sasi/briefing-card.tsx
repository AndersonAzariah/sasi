"use client";

import { useEffect } from "react";
import {
  AlertTriangle,
  Eye,
  Leaf,
  RefreshCw,
  Newspaper,
  Siren,
  TriangleAlert,
} from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import type { BriefingRisk } from "@/lib/sasi/types";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/sasi/utils";
import { toast } from "sonner";
import { RichText } from "./rich-text";
import { SectionLabel } from "./primitives";

/* ============================================================
   CityBriefingCard — the dashboard's AI-written daily digest.
   Grounded in the user's demo dataset (cases + incidents +
   saved location) via POST /api/sasi/briefing. Cached in
   sessionStorage for the browser session; the user can force a
   regenerate. Honest framing: AI-generated, demo data, refs
   clickable, and a "SASI can be wrong" trust line.
   ============================================================ */

const RISK_META: Record<
  BriefingRisk,
  { label: string; cls: string; dot: string; icon: typeof Leaf }
> = {
  CALM: {
    label: "Calm",
    cls: "border-[#66bb6a]/25 bg-[#66bb6a]/[0.08] text-[#a5d6a7]",
    dot: "bg-[#66bb6a]",
    icon: Leaf,
  },
  ELEVATED: {
    label: "Elevated",
    cls: "border-[#e3c567]/25 bg-[#e3c567]/[0.08] text-[#efe0a8]",
    dot: "bg-[#e3c567]",
    icon: Eye,
  },
  STRAINED: {
    label: "Strained",
    cls: "border-[#ffa726]/25 bg-[#ffa726]/[0.08] text-[#ffcc80]",
    dot: "bg-[#ffa726]",
    icon: TriangleAlert,
  },
  CRITICAL: {
    label: "Critical",
    cls: "border-[#ef5350]/30 bg-[#ef5350]/[0.1] text-[#fda4a0]",
    dot: "bg-[#ef5350]",
    icon: Siren,
  },
};

export function CityBriefingCard() {
  const briefing = useSasiStore((s) => s.briefing);
  const busy = useSasiStore((s) => s.briefingBusy);
  const error = useSasiStore((s) => s.briefingError);
  const generateBriefing = useSasiStore((s) => s.generateBriefing);
  const cases = useSasiStore((s) => s.cases);
  const openCase = useSasiStore((s) => s.openCase);
  const openIncident = useSasiStore((s) => s.openIncident);

  /* restore from session cache, or auto-generate once per session */
  useEffect(() => {
    void generateBriefing();
  }, [generateBriefing]);

  /* refs in the briefing are clickable — but only when they exist */
  const handleRef = (ref: string) => {
    if (ref.startsWith("CASE-")) {
      if (cases.some((c) => c.ref === ref)) openCase(ref);
      else
        toast("Reference not in this demo record", {
          description: `The briefing cited ${ref}, which SASI cannot open here. Treated as a note.`,
        });
    } else {
      openIncident(ref.toLowerCase());
    }
  };

  const risk = briefing ? RISK_META[briefing.risk] : null;
  const RiskIcon = risk?.icon ?? Eye;

  return (
    <section aria-label="City briefing" className="sasi-card sasi-glow-soft relative overflow-hidden p-4 sm:p-5">
      {/* faint national-light hairline at the very top */}
      <div className="sasi-hairline-rainbow absolute inset-x-0 top-0 opacity-40" aria-hidden />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Newspaper className="h-3.5 w-3.5 text-[#e3c567]" aria-hidden />
          <SectionLabel>City briefing</SectionLabel>
          <span className="font-mono text-[9.5px] tracking-[0.14em] text-zinc-700">
            DAILY · DEMO
          </span>
        </div>
        <div className="flex items-center gap-2">
          {briefing && risk && (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
                risk.cls
              )}
            >
              <RiskIcon className="h-3 w-3" aria-hidden />
              {risk.label}
            </span>
          )}
          <button
            onClick={() => void generateBriefing({ force: true })}
            disabled={busy}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/8 bg-white/[0.03] text-zinc-500 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={busy ? "Writing briefing…" : "Regenerate the briefing"}
            title="Regenerate"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", busy && "sasi-spin")} aria-hidden />
          </button>
        </div>
      </div>

      {/* ---------- busy: shimmer skeleton ---------- */}
      {busy && !briefing && (
        <div className="mt-4 space-y-3" aria-live="polite" aria-label="SASI is writing today's briefing">
          <div className="sasi-skeleton h-5 w-4/5" />
          <div className="sasi-skeleton h-3.5 w-full" />
          <div className="sasi-skeleton h-3.5 w-11/12" />
          <div className="sasi-skeleton h-3.5 w-3/5" />
          <p className="pt-1 font-mono text-[10px] tracking-[0.14em] text-zinc-600">
            SASI IS WRITING TODAY&apos;S BRIEFING…
          </p>
        </div>
      )}

      {/* ---------- error (honest, retryable) ---------- */}
      {error && !busy && (
        <div className="mt-4 rounded-lg border border-[#ef5350]/25 bg-[#ef5350]/[0.06] p-3.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#fda4a0]" aria-hidden />
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium text-[#fda4a0]">
                The briefing could not be written
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">{error}</p>
              <button
                onClick={() => void generateBriefing({ force: true })}
                className="mt-2 text-[12px] font-medium text-[#e3c567] transition-colors hover:text-[#f0d98c]"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- briefing body ---------- */}
      {briefing && !busy && (
        <>
          <h3 className="mt-3.5 text-balance text-[15.5px] font-semibold leading-snug text-white">
            {briefing.headline}
          </h3>

          <div className="mt-4 space-y-4">
            {briefing.sections.map((sec) => (
              <div key={sec.title}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  {sec.title}
                </p>
                <RichText
                  content={sec.body}
                  onRef={handleRef}
                  className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-zinc-300 [&_p]:text-[13px]"
                />
              </div>
            ))}
          </div>

          {briefing.watchlist.length > 0 && (
            <div className="mt-4 rounded-lg border border-white/8 bg-white/[0.02] p-3">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                <Eye className="h-3 w-3" aria-hidden />
                Worth watching
              </p>
              <ul className="mt-2 space-y-1.5">
                {briefing.watchlist.map((w, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-zinc-300">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-zinc-600" aria-hidden />
                    <RichText content={w} onRef={handleRef} className="min-w-0 flex-1 [&>div]:space-y-0" />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-4 border-t border-white/5 pt-3 text-[11px] leading-relaxed text-zinc-600">
            Written by SASI&apos;s AI from your demo data —{" "}
            <span className="text-zinc-500">{timeAgo(briefing.generatedAt)}</span> · for{" "}
            {briefing.locationLabel}. SASI can be wrong; nothing here is an official
            statement and nothing is shared with any authority.
          </p>
        </>
      )}
    </section>
  );
}
