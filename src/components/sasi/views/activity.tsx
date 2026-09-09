"use client";

import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import { ACTIVITY, DEMO_NOW } from "@/lib/sasi/data";
import type { ActivityEvent, ActivityKind } from "@/lib/sasi/types";
import { useT, type TKey } from "@/lib/sasi/i18n";
import { cn } from "@/lib/utils";
import { ActivityRow } from "@/components/sasi/domain";
import { DemoBadge, EmptyState, SectionLabel } from "@/components/sasi/primitives";

const NOW_MS = new Date(DEMO_NOW).getTime();
const DAY_MS = 86_400_000;

type DayBucket = "today" | "yesterday" | "earlier";

/* Bucket labels are display-only; reuse rp.when where identical. */
const BUCKET_LABEL: Record<DayBucket, TKey> = {
  today: "rp.when.today",
  yesterday: "rp.when.yesterday",
  earlier: "act.bucket.earlier",
};

/** UTC-day bucketing against the fixed demo clock — deterministic + hydration-safe. */
function bucketFor(iso: string): DayBucket {
  const t = new Date(iso).getTime();
  const todayStart = Math.floor(NOW_MS / DAY_MS) * DAY_MS;
  if (t >= todayStart) return "today";
  if (t >= todayStart - DAY_MS) return "yesterday";
  return "earlier";
}

type ActivityFilter =
  | "ALL"
  | "CASES"
  | "EVIDENCE"
  | "SOURCES"
  | "FINDINGS"
  | "ACTIONS"
  | "VERIFICATION";

const FILTERS: { key: ActivityFilter; labelKey: TKey; kinds: ActivityKind[] }[] = [
  {
    key: "ALL",
    labelKey: "cases.filter.all",
    kinds: [
      "CASE_UPDATED",
      "EVIDENCE_ADDED",
      "SOURCE_FOUND",
      "FINDING_GENERATED",
      "PERMISSION_REQUESTED",
      "ACTION_APPROVED",
      "ACTION_COMPLETED",
      "VERIFICATION_COMPLETED",
      "INVESTIGATION_STARTED",
      "CONFIDENCE_UPDATED",
      "INCIDENT_REPORTED",
    ],
  },
  { key: "CASES", labelKey: "nav.cases", kinds: ["CASE_UPDATED", "INVESTIGATION_STARTED"] },
  { key: "EVIDENCE", labelKey: "nav.evidence.item", kinds: ["EVIDENCE_ADDED"] },
  { key: "SOURCES", labelKey: "cd.tab.sources", kinds: ["SOURCE_FOUND"] },
  {
    key: "FINDINGS",
    labelKey: "cd.findings",
    kinds: ["FINDING_GENERATED", "CONFIDENCE_UPDATED"],
  },
  {
    key: "ACTIONS",
    labelKey: "cd.tab.actions",
    kinds: ["PERMISSION_REQUESTED", "ACTION_APPROVED", "ACTION_COMPLETED"],
  },
  { key: "VERIFICATION", labelKey: "act.filter.verification", kinds: ["VERIFICATION_COMPLETED"] },
];

const BUCKET_ORDER: DayBucket[] = ["today", "yesterday", "earlier"];

export default function ActivityView() {
  const t = useT();
  const [filter, setFilter] = useState<ActivityFilter>("ALL");

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter);
    if (!f) return ACTIVITY;
    return ACTIVITY.filter((ev) => f.kinds.includes(ev.kind));
  }, [filter]);

  const groups = useMemo(() => {
    const g: Record<DayBucket, ActivityEvent[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    };
    for (const ev of filtered) g[bucketFor(ev.at)].push(ev);
    return g;
  }, [filtered]);

  const isEmpty = filtered.length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ---------- Header ---------- */}
      <header>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-white">
            {t("nav.activity")}
          </h1>
          <DemoBadge />
          <span className="font-mono text-[10.5px] tracking-wider text-zinc-600">
            {t("act.count").replace("{n}", String(ACTIVITY.length))}
          </span>
        </div>
        <p className="mt-1 text-[13px] text-zinc-500">
          {t("act.subtitle")}
        </p>
      </header>

      {/* ---------- Kind filter chips ---------- */}
      <div
        role="group"
        aria-label={t("act.filter-aria")}
        className="mt-5 flex flex-wrap items-center gap-1.5"
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                active
                  ? "border-white/15 bg-white/8 text-white"
                  : "border-white/8 bg-transparent text-zinc-500 hover:border-white/15 hover:text-zinc-300"
              )}
            >
              {t(f.labelKey)}
            </button>
          );
        })}
      </div>

      {/* ---------- Day-grouped rail ---------- */}
      {isEmpty ? (
        <EmptyState
          className="mt-6"
          icon={Inbox}
          title={t("act.empty.title")}
          description={t("act.empty.description")}
        />
      ) : (
        <div className="mt-6 space-y-7">
          {BUCKET_ORDER.map((b) =>
            groups[b].length === 0 ? null : (
              <section
                key={b}
                aria-label={t("act.bucket-aria").replace("{bucket}", t(BUCKET_LABEL[b]))}
                className="relative border-l border-white/8 pl-4 sm:pl-5"
              >
                <div className="sticky top-14 z-10 -ml-4 inline-block bg-[#050505]/95 px-1 py-1 backdrop-blur-sm sm:-ml-5">
                  <SectionLabel>{t(BUCKET_LABEL[b])}</SectionLabel>
                </div>
                <div className="mt-1 space-y-0.5">
                  {groups[b].map((ev) => (
                    <ActivityRow key={ev.id} event={ev} />
                  ))}
                </div>
              </section>
            )
          )}
        </div>
      )}
    </div>
  );
}
