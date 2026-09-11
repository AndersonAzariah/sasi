"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  Eye,
  History,
  Leaf,
  MapPin,
  MessageSquareText,
  RefreshCw,
  Newspaper,
  Siren,
  TriangleAlert,
} from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import type { BriefingRisk, BriefingSection, CityBriefing } from "@/lib/sasi/types";
import { cn } from "@/lib/utils";
import { formatDateTime, timeAgo } from "@/lib/sasi/utils";
import { toast } from "sonner";
import { RichText } from "./rich-text";
import { SectionLabel } from "./primitives";

/* ============================================================
   CityBriefingCard — the dashboard's AI-written daily digest.
   Grounded in the user's demo dataset (cases + incidents +
   saved location) via POST /api/sasi/briefing. Cached in
   sessionStorage for the browser session and persisted to the
   briefing history (SQLite) so past briefings can be reopened.
   Stale briefings (>6h) are quietly rewritten on mount.
   Chat-distilled briefings carry a FROM YOUR CHAT origin tag and
   a "City mode" chip that swaps the daily digest back for free.
   Honest framing: AI-generated, demo data, refs clickable,
   and a "SASI can be wrong" trust line.
   ============================================================ */

const RISK_META: Record<
  BriefingRisk,
  { label: string; cls: string; dot: string; icon: typeof Leaf; meter: number }
> = {
  CALM: {
    label: "Calm",
    cls: "border-[#66bb6a]/25 bg-[#66bb6a]/[0.08] text-[#a5d6a7]",
    dot: "bg-[#66bb6a]",
    icon: Leaf,
    meter: 25,
  },
  ELEVATED: {
    label: "Elevated",
    cls: "border-[#e3c567]/25 bg-[#e3c567]/[0.08] text-[#efe0a8]",
    dot: "bg-[#e3c567]",
    icon: Eye,
    meter: 50,
  },
  STRAINED: {
    label: "Strained",
    cls: "border-[#ffa726]/25 bg-[#ffa726]/[0.08] text-[#ffcc80]",
    dot: "bg-[#ffa726]",
    icon: TriangleAlert,
    meter: 75,
  },
  CRITICAL: {
    label: "Critical",
    cls: "border-[#ef5350]/30 bg-[#ef5350]/[0.1] text-[#fda4a0]",
    dot: "bg-[#ef5350]",
    icon: Siren,
    meter: 100,
  },
};

/* gradient stops per risk for the meter bar fill */
const RISK_METER_FILL: Record<BriefingRisk, string> = {
  CALM: "linear-gradient(90deg, rgba(102,187,106,0.25), rgba(102,187,106,0.9))",
  ELEVATED: "linear-gradient(90deg, rgba(227,197,103,0.2), rgba(227,197,103,0.9))",
  STRAINED: "linear-gradient(90deg, rgba(227,197,103,0.2), rgba(255,167,38,0.95))",
  CRITICAL: "linear-gradient(90deg, rgba(255,167,38,0.25), rgba(239,83,80,0.95))",
};

/* ---------- one briefing body, reused for today + past views ---------- */

function BriefingBody({
  briefing,
  onRef,
  onAsk,
  onMap,
}: {
  briefing: CityBriefing;
  onRef: (ref: string) => void;
  onAsk: (section: BriefingSection) => void;
  onMap: (ref: string) => void;
}) {
  return (
    <>
      <h3 className="mt-3.5 text-balance text-[15.5px] font-semibold leading-snug text-white">
        {briefing.headline}
      </h3>

      <div className="mt-4 space-y-4">
        {briefing.sections.map((sec) => (
          <div key={sec.title} className="group/sec relative">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                {sec.title}
              </p>
              <button
                onClick={() => onAsk(sec)}
                className="sasi-chip-ask -mr-1 inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium text-zinc-600 transition-colors hover:text-[#e3c567] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e3c567]/50"
                aria-label={`Ask SASI about the ${sec.title} section of the briefing`}
              >
                <Bot className="h-3 w-3" aria-hidden />
                Ask SASI about this
              </button>
            </div>
            <RichText
              content={sec.body}
              onRef={onRef}
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
            {briefing.watchlist.map((w, i) => {
              /* watchlist rows citing a ref get a map click-through:
                 INC refs are blue (demo incident markers), CASE refs are
                 gold (the user's own reports, placed at their location) */
              const incRef = /INC-\d{3,4}/i.exec(w)?.[0];
              const caseRef = /CASE-\d{4,6}/i.exec(w)?.[0];
              return (
                <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-zinc-300">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-zinc-600" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <RichText content={w} onRef={onRef} className="min-w-0 [&>div]:space-y-0" />
                    {incRef && (
                      <button
                        onClick={() => onMap(incRef)}
                        className="sasi-chip-map mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium text-zinc-500 transition-colors hover:text-[#64b5f6] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#64b5f6]/50"
                        aria-label={`Show ${incRef} on the SASI map`}
                      >
                        <MapPin className="h-3 w-3" aria-hidden />
                        View on map
                      </button>
                    )}
                    {!incRef && caseRef && (
                      <button
                        onClick={() => onMap(caseRef)}
                        className="sasi-chip-map-gold mt-1 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e3c567]/50"
                        aria-label={`Show your report ${caseRef} on the SASI map`}
                      >
                        <MapPin className="h-3 w-3" aria-hidden />
                        View on map
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
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
  );
}

/* ---------- history row ---------- */

function HistoryRow({
  briefing,
  onOpen,
}: {
  briefing: CityBriefing;
  onOpen: () => void;
}) {
  const meta = RISK_META[briefing.risk] ?? RISK_META.ELEVATED;
  return (
    <li>
      <button
        onClick={onOpen}
        className="group/row relative flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-white/8 hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/30"
        aria-label={`Open briefing from ${formatDateTime(briefing.generatedAt)}: ${briefing.headline}`}
      >
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)}
          aria-hidden
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] leading-snug text-zinc-300 transition-colors group-hover/row:text-white">
            {briefing.headline}
          </span>
          <span className="mt-0.5 block font-mono text-[9.5px] tracking-[0.1em] text-zinc-600">
            {formatDateTime(briefing.generatedAt).toUpperCase()} · {meta.label.toUpperCase()}
          </span>
        </span>
        <ChevronRight small />
      </button>
    </li>
  );
}

function ChevronRight({ small }: { small?: boolean }) {
  return (
    <ChevronDown
      className={cn(
        "shrink-0 -rotate-90 text-zinc-700 transition-colors group-hover/row:text-zinc-400",
        small ? "h-3 w-3" : "h-3.5 w-3.5"
      )}
      aria-hidden
    />
  );
}

export function CityBriefingCard() {
  const briefing = useSasiStore((s) => s.briefing);
  const busy = useSasiStore((s) => s.briefingBusy);
  const error = useSasiStore((s) => s.briefingError);
  const history = useSasiStore((s) => s.briefingHistory);
  const generateBriefing = useSasiStore((s) => s.generateBriefing);
  const restoreCityBriefing = useSasiStore((s) => s.restoreCityBriefing);
  const setPendingAsk = useSasiStore((s) => s.setPendingAsk);
  const navigate = useSasiStore((s) => s.navigate);
  const focusOnMap = useSasiStore((s) => s.focusOnMap);
  const cases = useSasiStore((s) => s.cases);
  const openCase = useSasiStore((s) => s.openCase);
  const openIncident = useSasiStore((s) => s.openIncident);

  /* "today" vs a reopened past briefing */
  const [viewingPast, setViewingPast] = useState<CityBriefing | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  /* restore from session cache, or auto-generate once per session (stale → refresh) */
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

  /* grounded pre-filled question for the Ask SASI chat */
  const askAboutSection = (section: BriefingSection) => {
    const city = viewingPast?.locationLabel ?? briefing?.locationLabel ?? "";
    const q = `About the "${section.title}" part of my city briefing${
      city ? ` for ${city}` : ""
    }: what does this mean for me and what should I do next?`;
    setPendingAsk(q);
    navigate("ask-sasi");
  };

  /* watchlist → map: pre-select the cited incident (store guards unknown refs) */
  const mapFromWatchlist = (ref: string) => focusOnMap(ref);

  /* past items exclude what is currently shown as "today" (or being viewed) */
  const pastItems = useMemo(
    () =>
      history.filter(
        (h) =>
          h.generatedAt !== briefing?.generatedAt &&
          h.generatedAt !== viewingPast?.generatedAt
      ),
    [history, briefing, viewingPast]
  );

  const shown = viewingPast ?? briefing;
  const risk = shown ? RISK_META[shown.risk] : null;
  const RiskIcon = risk?.icon ?? Eye;

  return (
    <section aria-label="City briefing" className="sasi-card sasi-glow-soft relative overflow-hidden p-4 sm:p-5">
      {/* faint national-light hairline at the very top */}
      <div className="sasi-hairline-rainbow absolute inset-x-0 top-0 opacity-40" aria-hidden />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Newspaper className="h-3.5 w-3.5 text-[#e3c567]" aria-hidden />
          <SectionLabel>City briefing</SectionLabel>
          {shown?.origin === "chat" ? (
            <span
              className="sasi-origin-chat inline-flex items-center gap-1 rounded-md border border-[#64b5f6]/25 bg-[#64b5f6]/[0.08] px-1.5 py-0.5 font-mono text-[9px] tracking-[0.14em] text-[#a7d3f5]"
              title="This briefing was distilled from your Ask SASI conversation"
            >
              <MessageSquareText className="h-2.5 w-2.5" aria-hidden />
              FROM YOUR CHAT
            </span>
          ) : (
            <span className="font-mono text-[9.5px] tracking-[0.14em] text-zinc-700">
              DAILY · DEMO
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {shown && risk && (
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
          {/* chat-distilled card → one-click swap back to the daily digest */}
          {briefing?.origin === "chat" && !viewingPast && (
            <button
              onClick={() => void restoreCityBriefing()}
              disabled={busy}
              className="sasi-chip-city inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-50"
              title="Swap this conversation summary back to the daily city briefing"
              aria-label="Restore the daily city briefing"
            >
              <Newspaper className="h-3 w-3" aria-hidden />
              City mode
            </button>
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

      {/* ---------- risk meter (quiet gauge under the header) ---------- */}
      {shown && risk && !busy && (
        <div
          className="sasi-risk-track mt-3 h-[3px] w-full overflow-hidden rounded-full"
          role="img"
          aria-label={`Situation level: ${risk.label}`}
        >
          <div
            className="h-full rounded-full transition-[width] duration-700 ease-out"
            style={{ width: `${risk.meter}%`, background: RISK_METER_FILL[shown.risk] }}
          />
        </div>
      )}

      {/* ---------- busy: shimmer skeleton ---------- */}
      {busy && !shown && (
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

      {/* ---------- viewing a past briefing banner ---------- */}
      {viewingPast && !busy && (
        <div className="sasi-pop mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#e3c567]/20 bg-[#e3c567]/[0.05] px-3 py-2">
          <p className="flex min-w-0 items-center gap-2 text-[11.5px] text-[#efe0a8]">
            <History className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              Viewing a past briefing · {formatDateTime(viewingPast.generatedAt)}
            </span>
          </p>
          <button
            onClick={() => setViewingPast(null)}
            className="shrink-0 rounded-md border border-white/10 px-2 py-0.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
          >
            Back to today
          </button>
        </div>
      )}

      {/* ---------- briefing body (today or reopened) ---------- */}
      {shown && !busy && (
        <BriefingBody briefing={shown} onRef={handleRef} onAsk={askAboutSection} onMap={mapFromWatchlist} />
      )}

      {/* ---------- past briefings ---------- */}
      {pastItems.length > 0 && (
        <div className="mt-4 border-t border-white/5 pt-3">
          <button
            onClick={() => setHistoryOpen((o) => !o)}
            aria-expanded={historyOpen}
            aria-controls="briefing-history"
            className="flex w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-left text-[11px] font-medium text-zinc-500 transition-colors hover:text-zinc-200"
          >
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-200 motion-reduce:transition-none",
                historyOpen && "rotate-180"
              )}
              aria-hidden
            />
            Past briefings
            <span className="rounded-full bg-white/[0.06] px-1.5 py-px font-mono text-[9px] text-zinc-500">
              {pastItems.length}
            </span>
          </button>
          {historyOpen && (
            <ul id="briefing-history" className="sasi-pop mt-1.5 space-y-px">
              {pastItems.map((b) => (
                <HistoryRow
                  key={b.generatedAt}
                  briefing={b}
                  onOpen={() => {
                    setViewingPast(b);
                    setHistoryOpen(false);
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
