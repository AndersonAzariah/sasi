"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, FolderLock, Plus } from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { GAUTENG_MUNICIPALITIES } from "@/lib/sasi/data";
import { PRIORITY_META, SERVICES } from "@/lib/sasi/utils";
import type { Priority } from "@/lib/sasi/types";
import { cn } from "@/lib/utils";
import { CaseCard } from "@/components/sasi/domain";
import {
  DemoBadge,
  EmptyState,
  GhostButton,
  ListSkeleton,
  PrimaryButton,
} from "@/components/sasi/primitives";

type StatusTab =
  | "ALL"
  | "OPEN"
  | "INVESTIGATING"
  | "ACTION_REQUIRED"
  | "WAITING"
  | "RESOLVED";

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "OPEN", label: "Open" },
  { key: "INVESTIGATING", label: "Investigating" },
  { key: "ACTION_REQUIRED", label: "Action required" },
  { key: "WAITING", label: "Waiting" },
  { key: "RESOLVED", label: "Resolved" },
];

const PRIORITY_OPTIONS: Priority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="relative inline-flex">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ colorScheme: "dark" }}
        className="h-9 appearance-none rounded-lg border border-white/10 bg-white/[0.03] pl-3 pr-8 text-[12.5px] text-zinc-200 outline-none transition-colors hover:border-white/20 focus:border-white/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
        aria-hidden
      />
    </label>
  );
}

export default function CasesView() {
  const navigate = useSasiStore((s) => s.navigate);
  const openCase = useSasiStore((s) => s.openCase);
  const cases = useSasiStore((s) => s.cases);

  const [tab, setTab] = useState<StatusTab>("ALL");
  const [service, setService] = useState<string>("ALL");
  const [location, setLocation] = useState<string>("ALL");
  const [priority, setPriority] = useState<string>("ALL");

  /* brief skeleton on first mount — premium loading feel */
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  const counts = useMemo(() => {
    const c: Record<StatusTab, number> = {
      ALL: cases.length,
      OPEN: 0,
      INVESTIGATING: 0,
      ACTION_REQUIRED: 0,
      WAITING: 0,
      RESOLVED: 0,
    };
    for (const k of cases) {
      if (k.status === "OPEN") c.OPEN += 1;
      else if (k.status === "INVESTIGATING") c.INVESTIGATING += 1;
      else if (k.status === "ACTION_REQUIRED") c.ACTION_REQUIRED += 1;
      else if (k.status === "WAITING") c.WAITING += 1;
      else if (k.status === "RESOLVED" || k.status === "CLOSED") c.RESOLVED += 1;
    }
    return c;
  }, [cases]);

  const filtered = useMemo(() => {
    return cases
      .filter((c) => {
        if (tab === "OPEN" && c.status !== "OPEN") return false;
        if (tab === "INVESTIGATING" && c.status !== "INVESTIGATING") return false;
        if (tab === "ACTION_REQUIRED" && c.status !== "ACTION_REQUIRED")
          return false;
        if (tab === "WAITING" && c.status !== "WAITING") return false;
        if (
          tab === "RESOLVED" &&
          c.status !== "RESOLVED" &&
          c.status !== "CLOSED"
        )
          return false;
        if (service !== "ALL" && c.service !== service) return false;
        if (
          location !== "ALL" &&
          c.location.municipality !== location &&
          c.location.city !== location
        )
          return false;
        if (priority !== "ALL" && c.priority !== priority) return false;
        return true;
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [cases, tab, service, location, priority]);

  /* same definition of "investigating" as the dashboard tile (AI state active) */
  const investigatingTotal = cases.filter(
    (c) => c.aiState !== "IDLE" && c.aiState !== "COMPLETE"
  ).length;
  const actionTotal = counts.ACTION_REQUIRED;
  const clearFilters = () => {
    setTab("ALL");
    setService("ALL");
    setLocation("ALL");
    setPriority("ALL");
  };

  const serviceOptions = [
    { value: "ALL", label: "All services" },
    ...Object.entries(SERVICES).map(([key, meta]) => ({
      value: key,
      label: meta.label,
    })),
  ];

  const locationOptions = [
    { value: "ALL", label: "All locations" },
    ...GAUTENG_MUNICIPALITIES.map((m) => ({ value: m, label: m })),
  ];

  const priorityOptions = [
    { value: "ALL", label: "All priorities" },
    ...PRIORITY_OPTIONS.map((p) => ({
      value: p,
      label: PRIORITY_META[p].label,
    })),
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ---------- Header ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Cases
            </h1>
            <DemoBadge />
          </div>
          <p className="mt-1 text-[13px] text-zinc-500">
            Every issue you have reported to SASI, with its investigation
            state.
          </p>
        </div>
        <PrimaryButton onClick={() => navigate("report")}>
          <Plus className="h-4 w-4" aria-hidden />
          Report an issue
        </PrimaryButton>
      </div>

      {/* ---------- Status tabs ---------- */}
      <div
        role="group"
        aria-label="Filter cases by status"
        className="mt-5 flex flex-wrap items-center gap-1 rounded-xl border border-white/8 bg-white/[0.02] p-1"
      >
        {STATUS_TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              aria-pressed={active}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                active
                  ? "bg-white/8 text-white"
                  : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "ml-1.5 font-mono text-[10px]",
                  active ? "text-zinc-400" : "text-zinc-600"
                )}
              >
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ---------- Filters + stats line ---------- */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FilterSelect
          label="Filter by service"
          value={service}
          onChange={setService}
          options={serviceOptions}
        />
        <FilterSelect
          label="Filter by location"
          value={location}
          onChange={setLocation}
          options={locationOptions}
        />
        <FilterSelect
          label="Filter by priority"
          value={priority}
          onChange={setPriority}
          options={priorityOptions}
        />
        <p className="ml-auto font-mono text-[11px] tracking-wide text-zinc-600">
          {cases.length} {cases.length === 1 ? "case" : "cases"} ·{" "}
          {investigatingTotal} investigating · {actionTotal}{" "}
          {actionTotal === 1 ? "needs" : "need"} approval
        </p>
      </div>

      {/* ---------- Grid ---------- */}
      {loading ? (
        <ListSkeleton rows={4} className="mt-5" />
      ) : filtered.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={FolderLock}
          title="No cases match these filters"
          description="Try a different status, service or location — or clear the filters to see every case on record."
          action={
            <GhostButton onClick={clearFilters}>Clear filters</GhostButton>
          }
        />
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CaseCard key={c.id} c={c} onOpen={() => openCase(c.ref)} />
          ))}
        </div>
      )}
    </div>
  );
}
