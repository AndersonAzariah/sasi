"use client";

import { useMemo } from "react";
import {
  ArrowUpRight,
  ChevronRight,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { ACTIVITY, DEMO_NOW, DEMO_USER, INCIDENTS } from "@/lib/sasi/data";
import { SERVICES } from "@/lib/sasi/utils";
import type { ServiceKey, View } from "@/lib/sasi/types";
import { cn } from "@/lib/utils";
import { ActivityRow, CaseCard, IncidentCard } from "@/components/sasi/domain";
import {
  DemoBadge,
  GhostButton,
  PrimaryButton,
  SectionLabel,
  ServiceIcon,
  SERVICE_TINT,
  SasiPulse,
  StatTile,
} from "@/components/sasi/primitives";

const SHORTCUTS: ServiceKey[] = ["water", "electricity", "roads", "waste"];

const TIPS: { label: string; view: View }[] = [
  { label: "Report a new issue", view: "report" },
  { label: "Start an investigation", view: "start-investigation" },
  { label: "Browse nearby incidents", view: "incidents" },
];

function greetingForDemo(): string {
  const h = new Date(DEMO_NOW).getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardView() {
  const navigate = useSasiStore((s) => s.navigate);
  const setCommandOpen = useSasiStore((s) => s.setCommandOpen);
  const openCase = useSasiStore((s) => s.openCase);
  const openIncident = useSasiStore((s) => s.openIncident);
  const openService = useSasiStore((s) => s.openService);
  const cases = useSasiStore((s) => s.cases);
  const savedLocation = useSasiStore((s) => s.savedLocation);

  const sortedCases = useMemo(
    () => [...cases].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [cases]
  );

  const activeCount = cases.filter(
    (c) => c.status !== "RESOLVED" && c.status !== "CLOSED"
  ).length;
  const investigatingCount = cases.filter(
    (c) => c.aiState !== "IDLE" && c.aiState !== "COMPLETE"
  ).length;
  const actionCount = cases.filter((c) => c.status === "ACTION_REQUIRED").length;

  const flagship = cases.find((c) => c.id === "case-123");
  const flagshipAction = flagship?.proposedAction;
  const actionPending = flagshipAction?.state === "PROPOSED";
  const actionRunning =
    flagshipAction?.state === "APPROVED" || flagshipAction?.state === "IN_PROGRESS";
  const actionDone = flagshipAction?.state === "COMPLETED";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ---------- Header ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              {greetingForDemo()}, {DEMO_USER.firstName}.
            </h1>
            <DemoBadge />
          </div>
          <p className="mt-1 text-[13px] text-zinc-500">
            Here is your civic picture for {savedLocation.city},{" "}
            {savedLocation.province}.
          </p>
        </div>
        <GhostButton onClick={() => navigate("start-investigation")}>
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Start an investigation
        </GhostButton>
      </div>

      {/* ---------- Command card ---------- */}
      <div className="sasi-command-focus mt-6 rounded-xl">
        <div className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] pl-4 transition-colors hover:border-white/20 hover:bg-white/[0.04]">
          <button
            onClick={() => setCommandOpen(true)}
            className="flex h-full min-w-0 flex-1 items-center gap-3 text-left"
            aria-label="Ask SASI — open the command palette"
          >
            <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[14px] text-zinc-500">
              What do you need help with?
            </span>
          </button>
          <div
            className="h-6 w-px shrink-0 bg-white/8"
            role="separator"
            aria-orientation="vertical"
          />
          <button
            onClick={() => navigate("ask-sasi")}
            className="group flex h-full shrink-0 items-center gap-1.5 pr-2.5 pl-1 text-[12.5px] font-medium text-zinc-400 transition-colors hover:text-[#e3c567]"
            aria-label="Open the Ask SASI chat"
          >
            <Sparkles className="h-3.5 w-3.5 transition-colors group-hover:text-[#e3c567]" aria-hidden />
            <span className="hidden sm:inline">Ask SASI</span>
          </button>
          <kbd className="mr-3 hidden shrink-0 items-center rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:flex">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* ---------- Stat tiles ---------- */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Active cases" value={activeCount} tone="default" />
        <StatTile label="Investigating" value={investigatingCount} tone="blue" />
        <StatTile label="Action required" value={actionCount} tone="gold" />
        <StatTile
          label="Nearby incidents"
          value={INCIDENTS.length}
          hint="Demo dataset"
          tone="red"
        />
      </div>

      {/* ---------- Main grid ---------- */}
      <div className="mt-6 grid grid-cols-12 gap-5">
        {/* LEFT — 8 cols */}
        <div className="col-span-12 space-y-7 lg:col-span-8">
          <section aria-label="Current cases">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>Current cases</SectionLabel>
              <span className="font-mono text-[10px] tracking-wider text-zinc-600">
                {cases.length} ON RECORD
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {sortedCases.map((c) => (
                <CaseCard key={c.id} c={c} onOpen={() => openCase(c.ref)} />
              ))}
            </div>
            <button
              onClick={() => navigate("cases")}
              className="mt-3.5 inline-flex items-center gap-1 text-[12.5px] font-medium text-zinc-500 transition-colors hover:text-white"
            >
              View all cases
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </section>

          <section aria-label="Nearby incidents">
            <div className="flex items-center gap-2.5">
              <SectionLabel>Nearby</SectionLabel>
              <span className="font-mono text-[9.5px] tracking-[0.14em] text-zinc-700">
                DEMO DATASET
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {INCIDENTS.slice(0, 2).map((inc) => (
                <IncidentCard
                  key={inc.id}
                  incident={inc}
                  onOpen={() => openIncident(inc.id)}
                />
              ))}
            </div>
          </section>

          <section aria-label="Civic intelligence">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>Civic intelligence</SectionLabel>
              <DemoBadge />
            </div>
            <div className="sasi-card mt-3 divide-y divide-white/[0.04] p-2">
              {ACTIVITY.slice(0, 3).map((ev) => (
                <ActivityRow key={ev.id} event={ev} />
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT — 4 cols (stacks after main content on mobile) */}
        <div className="col-span-12 space-y-4 lg:col-span-4">
          {/* NEXT STEPS */}
          <SasiPulse color="gold" className="sasi-card p-4">
            <SectionLabel>Next steps</SectionLabel>
            {actionPending ? (
              <>
                <div className="mt-3 flex items-center gap-2">
                  <ShieldAlert
                    className="h-4 w-4 text-[#e3c567]"
                    aria-hidden
                  />
                  <p className="text-[13px] font-semibold text-white">
                    Approval needed
                  </p>
                </div>
                <p className="mt-2 text-[13.5px] font-medium leading-snug text-zinc-100">
                  {flagshipAction?.title}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">
                  SASI prepared this action for {flagship?.ref}. Nothing is
                  submitted until you approve it.
                </p>
                <PrimaryButton
                  className="mt-3.5 h-8 w-full"
                  onClick={() => navigate("case-detail", "case-123")}
                >
                  Review
                </PrimaryButton>
              </>
            ) : actionRunning ? (
              <>
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className="sasi-breathe h-2 w-2 rounded-full bg-[#64b5f6]"
                    aria-hidden
                  />
                  <p className="text-[13px] font-semibold text-white">
                    Action in progress
                  </p>
                </div>
                <p className="mt-2 text-[13.5px] font-medium leading-snug text-zinc-100">
                  {flagshipAction?.title}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">
                  You approved this action. SASI is executing it and will
                  verify the outcome.
                </p>
                <GhostButton
                  className="mt-3.5 h-8 w-full"
                  onClick={() => navigate("case-detail", "case-123")}
                >
                  Review
                </GhostButton>
              </>
            ) : actionDone ? (
              <>
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full bg-[#66bb6a]"
                    aria-hidden
                  />
                  <p className="text-[13px] font-semibold text-white">
                    Action completed
                  </p>
                </div>
                <p className="mt-2 text-[13.5px] font-medium leading-snug text-zinc-100">
                  {flagshipAction?.title}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">
                  SASI executed the approved action and recorded the
                  verification outcome.
                </p>
                <GhostButton
                  className="mt-3.5 h-8 w-full"
                  onClick={() => navigate("case-detail", "case-123")}
                >
                  Review
                </GhostButton>
              </>
            ) : (
              <>
                <p className="mt-3 text-[12.5px] leading-relaxed text-zinc-500">
                  No action is waiting on you right now. A few places to start:
                </p>
                <ul className="mt-2 space-y-0.5">
                  {TIPS.map((t) => (
                    <li key={t.label}>
                      <button
                        onClick={() => navigate(t.view)}
                        className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-[12.5px] text-zinc-300 transition-colors hover:bg-white/[0.04] hover:text-white"
                      >
                        {t.label}
                        <ArrowUpRight
                          className="h-3.5 w-3.5 text-zinc-600"
                          aria-hidden
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </SasiPulse>

          {/* SERVICE SHORTCUTS */}
          <section aria-label="Service shortcuts" className="sasi-card p-2">
            <div className="px-2 pb-1.5 pt-2">
              <SectionLabel>Service shortcuts</SectionLabel>
            </div>
            <ul>
              {SHORTCUTS.map((key) => (
                <li key={key}>
                  <button
                    onClick={() => openService(key)}
                    aria-label={`Open ${SERVICES[key].label} service`}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.03]"
                  >
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]",
                        SERVICE_TINT[key]
                      )}
                    >
                      <ServiceIcon service={key} className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-200">
                      {SERVICES[key].label}
                    </span>
                    <ArrowUpRight
                      className="h-3.5 w-3.5 shrink-0 text-zinc-700"
                      aria-hidden
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* RECENT ACTIVITY */}
          <section aria-label="Recent activity" className="sasi-card p-2">
            <div className="px-2 pb-1.5 pt-2">
              <SectionLabel>Recent activity</SectionLabel>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {ACTIVITY.slice(0, 4).map((ev) => (
                <ActivityRow key={ev.id} event={ev} />
              ))}
            </div>
            <button
              onClick={() => navigate("activity")}
              className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg px-2 py-2 text-[12px] text-zinc-500 transition-colors hover:bg-white/[0.03] hover:text-white"
            >
              View all activity
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
