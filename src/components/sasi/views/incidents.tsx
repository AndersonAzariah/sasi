"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, List, Rows3, Search, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSasiStore } from "@/lib/sasi/store";
import { GAUTENG_MUNICIPALITIES, INCIDENTS } from "@/lib/sasi/data";
import type { Incident, TrustStatus } from "@/lib/sasi/types";
import { SERVICES, locationLabel, timeAgo } from "@/lib/sasi/utils";
import {
  CardSkeleton,
  DemoBadge,
  EmptyState,
  GhostButton,
  PriorityBadge,
  ServiceIcon,
  SERVICE_TINT,
  StatTile,
  StatusBadge,
} from "../primitives";
import { IncidentCard } from "../domain";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ============================================================
   INCIDENTS EXPLORER — filterable list of demo incidents
   ============================================================ */

const SERVICE_KEYS = [
  "water",
  "electricity",
  "roads",
  "waste",
  "healthcare",
  "education",
  "housing",
] as const;

const STATUS_KEYS: TrustStatus[] = ["CONFIRMED", "REPORTED", "URGENT", "RESOLVED"];
const SEVERITY_KEYS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-white bg-white text-black"
          : "border-white/10 bg-transparent text-zinc-400 hover:border-white/25 hover:text-zinc-200"
      )}
    >
      {children}
    </button>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
        {label}
      </span>
      {children}
    </div>
  );
}

export default function IncidentsView() {
  const navigate = useSasiStore((s) => s.navigate);
  const openIncident = useSasiStore((s) => s.openIncident);

  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [service, setService] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");
  const [municipality, setMunicipality] = useState<string>("all");
  const [mode, setMode] = useState<"list" | "dense">("list");

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  const sorted = useMemo(
    () =>
      [...INCIDENTS].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sorted.filter((i) => {
      if (service !== "all" && i.service !== service) return false;
      if (status !== "all" && i.status !== status) return false;
      if (severity !== "all" && i.severity !== severity) return false;
      if (municipality !== "all" && i.location.municipality !== municipality) return false;
      if (q) {
        const hay = `${i.title} ${i.location.suburb ?? ""} ${i.location.city}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sorted, query, service, status, severity, municipality]);

  const hasActiveFilters =
    query.trim() !== "" ||
    service !== "all" ||
    status !== "all" ||
    severity !== "all" ||
    municipality !== "all";

  const clearFilters = () => {
    setQuery("");
    setService("all");
    setStatus("all");
    setSeverity("all");
    setMunicipality("all");
  };

  const counts = useMemo(
    () => ({
      confirmed: INCIDENTS.filter((i) => i.status === "CONFIRMED").length,
      reported: INCIDENTS.filter((i) => i.status === "REPORTED").length,
      urgent: INCIDENTS.filter((i) => i.status === "URGENT").length,
      resolved: INCIDENTS.filter((i) => i.status === "RESOLVED").length,
    }),
    []
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ---------- header ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold tracking-tight text-white">Civic incidents</h1>
          <p className="mt-1 text-[13px] text-zinc-500">
            Reported and confirmed service incidents across Gauteng.
          </p>
        </div>
        <DemoBadge label="DEMO DATA" />
      </div>

      {/* ---------- stat tiles ---------- */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Confirmed" value={counts.confirmed} tone="green" hint="Verified against sources" />
        <StatTile label="Reported" value={counts.reported} tone="blue" hint="Awaiting confirmation" />
        <StatTile label="Urgent" value={counts.urgent} tone="red" hint="Immediate attention" />
        <StatTile label="Resolved" value={counts.resolved} hint="Closed in demo dataset" />
      </div>

      {/* ---------- toolbar ---------- */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs min-w-0 flex-1 sm:flex-none sm:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, suburb or city…"
            aria-label="Search incidents by title, suburb or city"
            className="h-10 rounded-lg border-white/10 bg-white/[0.03] pl-9 text-[13px] text-white placeholder:text-zinc-600"
          />
        </div>

        <div
          className="flex items-center rounded-lg border border-white/10 p-0.5"
          role="group"
          aria-label="View mode"
        >
          <button
            type="button"
            onClick={() => setMode("list")}
            aria-pressed={mode === "list"}
            aria-label="Card list view"
            className={cn(
              "flex h-9 w-10 items-center justify-center rounded-md transition-colors",
              mode === "list" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <List className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setMode("dense")}
            aria-pressed={mode === "dense"}
            aria-label="Dense list view"
            className={cn(
              "flex h-9 w-10 items-center justify-center rounded-md transition-colors",
              mode === "dense" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Rows3 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* ---------- filters ---------- */}
      <div className="mt-3 space-y-2 rounded-xl border border-white/5 bg-white/[0.015] p-3">
        <FilterGroup label="Service">
          <FilterChip active={service === "all"} onClick={() => setService("all")}>
            All
          </FilterChip>
          {SERVICE_KEYS.map((s) => (
            <FilterChip key={s} active={service === s} onClick={() => setService(s)}>
              {SERVICES[s].label}
            </FilterChip>
          ))}
        </FilterGroup>

        <FilterGroup label="Status">
          <FilterChip active={status === "all"} onClick={() => setStatus("all")}>
            All
          </FilterChip>
          {STATUS_KEYS.map((s) => (
            <FilterChip key={s} active={status === s} onClick={() => setStatus(s)}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </FilterChip>
          ))}
        </FilterGroup>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-6">
            <FilterGroup label="Severity">
              <FilterChip active={severity === "all"} onClick={() => setSeverity("all")}>
                All
              </FilterChip>
              {SEVERITY_KEYS.map((s) => (
                <FilterChip key={s} active={severity === s} onClick={() => setSeverity(s)}>
                  {s.charAt(0) + s.slice(1).toLowerCase()}
                </FilterChip>
              ))}
            </FilterGroup>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                Municipality
              </span>
              <Select value={municipality} onValueChange={setMunicipality}>
                <SelectTrigger
                  size="sm"
                  aria-label="Filter by municipality"
                  className="h-8 w-[200px] rounded-full border-white/10 bg-transparent text-[11px] text-zinc-300"
                >
                  <SelectValue placeholder="All municipalities" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#0b0c0e] text-zinc-200">
                  <SelectItem value="all">All municipalities</SelectItem>
                  {GAUTENG_MUNICIPALITIES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-[11.5px] font-medium text-zinc-400 underline underline-offset-4 transition-colors hover:text-white"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ---------- count line ---------- */}
      <p className="mt-3 font-mono text-[11px] tracking-wide text-zinc-600" aria-live="polite">
        {filtered.length} incident{filtered.length === 1 ? "" : "s"} · {filtered.length} demo
      </p>

      {/* ---------- results ---------- */}
      <div className="mt-2.5">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Zap}
            title="No incidents match these filters"
            description="Adjust filters to widen the search across the demo dataset."
            action={<GhostButton onClick={clearFilters}>Clear all filters</GhostButton>}
          />
        ) : mode === "list" ? (
          <motion.div layout className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {filtered.map((incident: Incident) => (
                <motion.div
                  key={incident.id}
                  layout
                  className="min-w-0"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.985 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  <IncidentCard incident={incident} onOpen={() => openIncident(incident.id)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="sasi-card divide-y divide-white/5 overflow-hidden">
            <AnimatePresence initial={false}>
              {filtered.map((incident) => (
                <motion.div
                  key={incident.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <button
                    type="button"
                    onClick={() => openIncident(incident.id)}
                    aria-label={`Open incident ${incident.ref}: ${incident.title}`}
                    className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]",
                        SERVICE_TINT[incident.service]
                      )}
                    >
                      <ServiceIcon service={incident.service} className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-white">
                        {incident.title}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[10px] tracking-wider text-zinc-600">
                        {incident.ref} · {locationLabel(incident.location, "suburb")}
                      </span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
                      <StatusBadge status={incident.status} size="sm" />
                      <PriorityBadge priority={incident.severity} />
                      <DemoBadge label="DEMO" />
                    </span>
                    <span className="hidden shrink-0 text-[11px] text-zinc-600 md:block">
                      {timeAgo(incident.updatedAt)}
                    </span>
                    <ArrowUpRight
                      className="h-4 w-4 shrink-0 text-zinc-600 transition-colors group-hover:text-zinc-300"
                      aria-hidden
                    />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
