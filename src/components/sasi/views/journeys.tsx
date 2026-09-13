"use client";

/* Journeys — the guided-journey catalogue (Task 28-c, Phase 9).
   Cards come from the SERVICE REGISTRY (entries with a journeyId);
   progress comes from the resident's real JourneyRun rows via
   GET /api/sasi/journeys. SASI journeys are preparation checklists —
   completing one never completes an official government application. */

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Ban,
  BadgeCheck,
  FileCheck2,
  Landmark,
  MapPin,
  Route,
  ShieldAlert,
} from "lucide-react";

import { useSasiStore } from "@/lib/sasi/store";
import { getSessionId } from "@/lib/sasi/utils";
import {
  JOURNEY_ENTRIES,
  type JourneyRunDTO,
  type ServiceRegistryEntry,
} from "@/lib/sasi/services-registry";
import { cn } from "@/lib/utils";
import { EmptyState, GhostButton, SectionLabel, TrustNotice } from "@/components/sasi/primitives";

type LoadState = "loading" | "ready" | "error";

function sourceLine(entry: ServiceRegistryEntry): string {
  if (!entry.officialSource) {
    return `No single official link verified — confirm through ${entry.department}.`;
  }
  return entry.officialSource.verified
    ? `Official source: ${entry.officialSource.org} (verified government site)`
    : `Source: ${entry.officialSource.org} (not verified by SASI)`;
}

export default function JourneysView() {
  const navigate = useSasiStore((s) => s.navigate);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [runs, setRuns] = useState<Map<string, JourneyRunDTO>>(new Map());

  const load = useCallback(async (silent: boolean) => {
    if (!silent) setLoadState("loading");
    try {
      const res = await fetch(`/api/sasi/journeys?sessionId=${encodeURIComponent(getSessionId())}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { runs?: JourneyRunDTO[] };
      const map = new Map<string, JourneyRunDTO>();
      for (const run of data.runs ?? []) map.set(run.journeyId, run);
      setRuns(map);
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ---------- Header ---------- */}
      <header>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-white">Service journeys</h1>
          <span className="font-mono text-[10.5px] tracking-wider text-zinc-600">
            {JOURNEY_ENTRIES.length} GUIDED · STEP BY STEP
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-zinc-500">
          Preparation checklists for real South African services — what to bring, where to go and
          what to expect. Your progress is saved in SASI as you go.
        </p>
      </header>

      {/* ---------- Honesty banner ---------- */}
      <TrustNotice variant="warning" className="mt-5">
        Completing a SASI checklist does not complete an official government application. Follow the
        official source shown on each journey for the actual submission.
      </TrustNotice>

      {/* ---------- Catalogue ---------- */}
      {loadState === "loading" ? (
        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="sasi-card h-[124px] animate-pulse p-5" />
          ))}
        </div>
      ) : loadState === "error" ? (
        <EmptyState
          className="mt-6"
          icon={ShieldAlert}
          title="Your journey progress could not be loaded"
          description="SASI could not reach your saved journeys just now. The catalogue below still works — your progress will return when the connection does."
          action={<GhostButton onClick={() => void load(false)}>Try again</GhostButton>}
        />
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          {JOURNEY_ENTRIES.map((entry) => {
            const run = runs.get(entry.journeyId ?? "");
            const started = Boolean(run);
            const completed = run?.status === "COMPLETED";
            const paused = run?.status === "PAUSED";
            const doneCount = run?.stepsDone.length ?? 0;

            return (
              <li key={entry.slug}>
                <button
                  onClick={() => navigate("journey", entry.journeyId ?? undefined)}
                  className="sasi-card sasi-card-interactive group flex h-full w-full flex-col p-5 text-left"
                  aria-label={`${started ? "Resume" : "Start"} the ${entry.title} journey`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold leading-snug text-white">
                        {entry.title}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-[12px] text-zinc-500">
                        <Landmark className="h-3.5 w-3.5 shrink-0 text-zinc-600" aria-hidden />
                        <span className="truncate">{entry.department}</span>
                      </p>
                    </div>
                    {started ? (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] font-medium",
                          completed
                            ? "border-[#66bb6a]/25 bg-[#66bb6a]/[0.08] text-[#a5d6a7]"
                            : paused
                              ? "border-white/10 bg-white/[0.03] text-zinc-400"
                              : "border-[#e3c567]/25 bg-[#e3c567]/[0.08] text-[#efe0a8]"
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            completed ? "bg-[#66bb6a]" : paused ? "bg-zinc-500" : "sasi-breathe bg-[#e3c567]"
                          )}
                          aria-hidden
                        />
                        {completed ? "Checklist done" : paused ? "Paused" : "In progress"}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-relaxed text-zinc-500">
                    {entry.summary}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-zinc-600">
                    <span className="inline-flex items-center gap-1">
                      <FileCheck2 className="h-3.5 w-3.5 text-zinc-600" aria-hidden />
                      {entry.requirements.length} requirements ·{" "}
                      {entry.requiredDocuments.length} documents
                    </span>
                    {entry.locationCategory ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-zinc-600" aria-hidden />
                        {entry.locationCategory.replace(/-/g, " ")}
                      </span>
                    ) : null}
                  </div>

                  <p
                    className={cn(
                      "mt-2 flex items-start gap-1.5 text-[11.5px] leading-relaxed",
                      entry.officialSource?.verified ? "text-[#a5d6a7]/80" : "text-zinc-600"
                    )}
                  >
                    {entry.officialSource?.verified ? (
                      <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#66bb6a]" aria-hidden />
                    ) : (
                      <Ban className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" aria-hidden />
                    )}
                    {sourceLine(entry)}
                  </p>

                  <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3.5">
                    <span className="text-[13px] font-medium text-zinc-200 transition-colors group-hover:text-white">
                      {completed
                        ? "Review checklist"
                        : started
                          ? `Resume · ${doneCount} step${doneCount === 1 ? "" : "s"} done`
                          : "Start journey"}
                    </span>
                    <ArrowRight
                      className="h-4 w-4 text-zinc-700 transition-all group-hover:translate-x-0.5 group-hover:text-[#e3c567]"
                      aria-hidden
                    />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ---------- How journeys work ---------- */}
      <section className="mt-10" aria-labelledby="journeys-how-heading">
        <SectionLabel className="sasi-eyebrow mb-3">How journeys work</SectionLabel>
        <h2 id="journeys-how-heading" className="sr-only">
          How SASI journeys work
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              title: "You tick, SASI remembers",
              detail:
                "Each step is a real part of preparing for the service. Ticking it records progress in your own SASI workspace only.",
            },
            {
              title: "Submission stays official",
              detail:
                "SASI never submits anything for you. The official department — Home Affairs, SASSA, SAPS or your municipality — handles the real application.",
            },
            {
              title: "Requirements can vary",
              detail:
                "The requirements and documents listed are commonly documented, but individual offices can ask for more. Always confirm details with the official source before you travel.",
            },
          ].map((item) => (
            <div key={item.title} className="sasi-card p-5">
              <p className="text-[13.5px] font-medium text-white">{item.title}</p>
              <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- Everything-else line ---------- */}
      <p className="mt-8 flex items-center gap-2 text-[12px] text-zinc-600">
        <Route className="h-3.5 w-3.5" aria-hidden />
        Looking for a service without a guided journey? Browse{" "}
        <button
          onClick={() => navigate("services")}
          className="min-h-[44px] shrink-0 rounded-lg px-1 text-[12px] text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition-colors hover:text-white"
        >
          all services
        </button>{" "}
        instead.
      </p>
    </div>
  );
}
