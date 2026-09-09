"use client";

import { memo, useMemo, useState } from "react";
import { Crosshair, Map as MapIcon, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSasiStore } from "@/lib/sasi/store";
import { INCIDENTS } from "@/lib/sasi/data";
import type { Incident, TrustStatus } from "@/lib/sasi/types";
import { SERVICES, timeAgo } from "@/lib/sasi/utils";
import {
  DemoBadge,
  PrimaryButton,
  PriorityBadge,
  ServiceIcon,
  SERVICE_TINT,
  StatusBadge,
} from "../primitives";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

/* ============================================================
   Stylized Gauteng map — pure SVG, no tiles, no network.
   Coordinate convention: viewBox 0 0 100 100; incidents carry
   location.mapX / location.mapY in that same space.
   ============================================================ */

const PROVINCE_PATH =
  "M 40,6 L 58,4 L 72,12 L 80,26 L 78,40 L 82,54 L 74,64 L 62,74 L 55,88 L 46,84 L 42,72 L 30,66 L 20,54 L 24,38 L 32,22 Z";

const VAAL_DAM_PATH =
  "M 55,69 C 58,67.5 60.5,69 60.5,71.5 C 60.5,74 58,75.5 55.5,74 C 53.5,72.5 53,70.5 55,69 Z";

const ROODEPLAAT_PATH =
  "M 65,9 C 67,8 70,9 70,11 C 70,13 67,13.5 65.5,12.5 C 64,11.5 63.5,10 65,9 Z";

const ROADS: { d: string; w: number; o: number }[] = [
  { d: "M 66,14 C 65,20 60,30 55,37 C 51,43 54,46 53,51 C 52,56 48,62 43,67 C 39,72 44,79 51,83", w: 0.75, o: 0.08 }, // N1 (stylised)
  { d: "M 53,53 C 58,52 62,55 66,55 C 70,55 72,60 71,64", w: 0.55, o: 0.05 }, // N3 (stylised)
  { d: "M 22,55 C 32,60 42,62 52,57 C 62,52 70,53 79,52", w: 0.55, o: 0.05 }, // N12/N17 (stylised)
  { d: "M 64,20 C 52,28 40,34 30,42", w: 0.5, o: 0.04 }, // N14 (stylised)
  { d: "M 70,14 C 74,18 76,24 77,30", w: 0.5, o: 0.04 }, // N4 (stylised)
];

const CITY_LABELS: { x: number; y: number; name: string }[] = [
  { x: 67.5, y: 17, name: "Pretoria" },
  { x: 68, y: 31, name: "Centurion" },
  { x: 55.5, y: 34, name: "Midrand" },
  { x: 47, y: 41.5, name: "Randburg" },
  { x: 58, y: 46.5, name: "Sandton" },
  { x: 51, y: 60, name: "Johannesburg" },
  { x: 32, y: 54.5, name: "Roodepoort" },
  { x: 38.5, y: 64, name: "Soweto" },
  { x: 74, y: 51, name: "Benoni" },
];

export const MARKER_COLOR: Record<string, string> = {
  URGENT: "#ef5350",
  CONFIRMED: "#66bb6a",
  REPORTED: "#64b5f6",
  RESOLVED: "#4b5563",
  INFERRED: "#e3c567",
  UNVERIFIED: "#a1a1aa",
};

const LEGEND: { label: string; color: string }[] = [
  { label: "Urgent", color: "#ef5350" },
  { label: "Confirmed", color: "#66bb6a" },
  { label: "Reported", color: "#64b5f6" },
  { label: "Resolved", color: "#4b5563" },
];

/* ---------- shared internals ---------- */

function GautengBase({ withLabels = true }: { withLabels?: boolean }) {
  return (
    <g>
      <path
        d={PROVINCE_PATH}
        fill="#101214"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={0.6}
        strokeLinejoin="round"
      />
      <g fill="none" strokeLinecap="round">
        {ROADS.map((r, i) => (
          <path key={i} d={r.d} stroke={`rgba(255,255,255,${r.o})`} strokeWidth={r.w} />
        ))}
      </g>
      <path d={VAAL_DAM_PATH} fill="#64b5f6" opacity={0.06}>
        <title>Vaal Dam (stylised)</title>
      </path>
      <path d={ROODEPLAAT_PATH} fill="#64b5f6" opacity={0.06}>
        <title>Roodeplaat Dam (stylised)</title>
      </path>
      {withLabels && (
        <g className="font-mono" fontSize={2.2} fill="#52525b" textAnchor="middle" aria-hidden>
          {CITY_LABELS.map((c) => (
            <text key={c.name} x={c.x} y={c.y}>
              {c.name}
            </text>
          ))}
        </g>
      )}
    </g>
  );
}

export interface GautengMarker {
  id: string;
  x: number;
  y: number;
  color: string;
  label?: string;
  size?: number;
  onClick?: () => void;
}

function MapMarkers({
  markers,
  selectedId,
  onSelect,
}: {
  markers: GautengMarker[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  return (
    <g>
      {markers.map((m) => {
        const selected = m.id === selectedId;
        const r = m.size ?? 3;
        return (
          <g
            key={m.id}
            transform={`translate(${m.x} ${m.y})`}
            className="cursor-pointer outline-none"
            role="button"
            tabIndex={0}
            aria-label={m.label ? `Incident marker ${m.label}` : "Incident marker"}
            onClick={() => {
              m.onClick?.();
              onSelect?.(m.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                m.onClick?.();
                onSelect?.(m.id);
              }
            }}
            onFocus={() => onSelect?.(m.id)}
          >
            {/* capture area — sized to avoid overlapping neighbouring markers */}
            <circle r={4} fill="transparent" pointerEvents="all" />
            <circle r={r + 2.6} fill={m.color} opacity={0.14} pointerEvents="none" />
            {selected && (
              <circle
                r={r + 0.2}
                fill="none"
                stroke={m.color}
                strokeWidth={0.7}
                className="sasi-marker-ring"
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
                pointerEvents="none"
              />
            )}
            <circle r={r} fill={m.color} stroke="#0a0b0d" strokeWidth={0.7} />
            {selected && <circle r={1.1} fill="#ffffff" pointerEvents="none" />}
          </g>
        );
      })}
    </g>
  );
}

/* ---------- EXPORTED: GautengMiniMap ----------
   Reusable mini map for detail views.
   markers: [{ id, x, y, color, label?, size?, onClick? }] (0-100 coords)
   selectedId + onSelect wire the white-dot / pulse state.       */

export function GautengMiniMap({
  markers = [],
  selectedId = null,
  onSelect,
  className,
  withLabels = true,
}: {
  markers?: GautengMarker[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  withLabels?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-white/8 bg-[#0a0b0d]",
        className
      )}
    >
      <div className="sasi-grid-bg pointer-events-none absolute inset-0 opacity-60" />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="relative h-full w-full"
        role="img"
        aria-label="Stylised map of Gauteng"
      >
        <GautengBase withLabels={withLabels} />
        <MapMarkers markers={markers} selectedId={selectedId} onSelect={onSelect} />
      </svg>
    </div>
  );
}

/* ============================================================
   MAP VIEW — full-bleed civic intelligence map
   ============================================================ */

const MAP_SERVICES = ["water", "electricity", "roads", "waste"] as const;
const MAP_STATUSES: TrustStatus[] = ["URGENT", "CONFIRMED", "REPORTED", "RESOLVED"];

function toggleIn(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function MapFilterControls({
  query,
  onQuery,
  services,
  onToggleService,
  statuses,
  onToggleStatus,
  shown,
  total,
}: {
  query: string;
  onQuery: (v: string) => void;
  services: Set<string>;
  onToggleService: (s: string) => void;
  statuses: Set<string>;
  onToggleStatus: (s: string) => void;
  shown: number;
  total: number;
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" aria-hidden />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search incidents…"
          aria-label="Search incidents on map"
          className="h-8 rounded-lg border-white/10 bg-white/[0.03] pl-8 text-[12.5px] text-white placeholder:text-zinc-600"
        />
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
          Service
        </p>
        <div className="space-y-1.5">
          {MAP_SERVICES.map((s) => (
            <label
              key={s}
              className="flex min-h-[28px] cursor-pointer items-center gap-2 text-[12px] text-zinc-300"
            >
              <Checkbox
                checked={services.has(s)}
                onCheckedChange={() => onToggleService(s)}
                aria-label={`Filter by ${SERVICES[s].label}`}
                className="border-white/20 bg-transparent data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-black"
              />
              <span className={cn("flex items-center gap-1.5", SERVICE_TINT[s])}>
                <ServiceIcon service={s} className="h-3 w-3" />
                <span className="text-zinc-300">{SERVICES[s].label}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
          Status
        </p>
        <div className="flex flex-wrap gap-1.5">
          {MAP_STATUSES.map((st) => {
            const active = statuses.has(st);
            return (
              <button
                key={st}
                type="button"
                onClick={() => onToggleStatus(st)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10.5px] font-medium transition-colors",
                  active
                    ? "border-white/60 bg-white/10 text-white"
                    : "border-white/10 text-zinc-500 hover:border-white/25 hover:text-zinc-300"
                )}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: MARKER_COLOR[st] }}
                  aria-hidden
                />
                {st === "URGENT" ? "Urgent" : st === "CONFIRMED" ? "Confirmed" : st === "REPORTED" ? "Reported" : "Resolved"}
              </button>
            );
          })}
        </div>
      </div>

      <p className="border-t border-white/5 pt-2 font-mono text-[10px] tracking-wide text-zinc-600">
        {shown} of {total} demo incidents shown
      </p>
    </div>
  );
}

function SelectedIncidentSummary({
  incident,
  onOpen,
  compact = false,
}: {
  incident: Incident;
  onOpen: () => void;
  compact?: boolean;
}) {
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]",
              SERVICE_TINT[incident.service]
            )}
          >
            <ServiceIcon service={incident.service} className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-white">{incident.title}</p>
            <p className="mt-0.5 font-mono text-[10px] tracking-wider text-zinc-600">
              {incident.ref}
            </p>
          </div>
        </div>
        <DemoBadge label="DEMO" />
      </div>

      {!compact && incident.description && (
        <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-zinc-500">
          {incident.description}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <StatusBadge status={incident.status} size="sm" />
        <PriorityBadge priority={incident.severity} />
      </div>

      <div className="mt-2.5 space-y-0.5 border-t border-white/5 pt-2.5 text-[11.5px] text-zinc-500">
        <p className="truncate">
          {incident.location.suburb ? `${incident.location.suburb}, ` : ""}
          {incident.location.city}
        </p>
        <p className="text-[11px] text-zinc-600">
          Updated {timeAgo(incident.updatedAt)} · {incident.sourceIds.length} public source
          {incident.sourceIds.length === 1 ? "" : "s"}
        </p>
      </div>

      <PrimaryButton onClick={onOpen} className="mt-3 h-11 w-full lg:h-9" aria-label={`Open incident ${incident.ref}`}>
        <MapIcon className="h-3.5 w-3.5" aria-hidden />
        Open incident
      </PrimaryButton>
    </div>
  );
}

const MemoMarkers = memo(MapMarkers);
const MemoBase = memo(GautengBase);

export default function MapView() {
  const openIncident = useSasiStore((s) => s.openIncident);
  const mapFocusRef = useSasiStore((s) => s.mapFocusRef);
  const clearMapFocus = useSasiStore((s) => s.clearMapFocus);

  const [query, setQuery] = useState("");
  const [services, setServices] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return INCIDENTS.filter((i) => {
      if (services.size > 0 && !services.has(i.service)) return false;
      if (statuses.size > 0 && !statuses.has(i.status)) return false;
      if (q) {
        const hay = `${i.title} ${i.location.suburb ?? ""} ${i.location.city}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [query, services, statuses]);

  /* briefing watchlist → map click-through: the focused incident is always
     visible and pre-selected, bypassing the user's filters until cleared */
  const focusIncident = useMemo(() => {
    if (!mapFocusRef) return null;
    const ref = mapFocusRef.toLowerCase();
    return (
      INCIDENTS.find(
        (i) => i.ref.toLowerCase() === ref || i.id === ref
      ) ?? null
    );
  }, [mapFocusRef]);

  const effectiveFiltered = useMemo(() => {
    if (!focusIncident || filtered.some((i) => i.id === focusIncident.id)) return filtered;
    return [focusIncident, ...filtered];
  }, [filtered, focusIncident]);

  const markers = useMemo<GautengMarker[]>(
    () =>
      effectiveFiltered.map((i) => ({
        id: i.id,
        x: i.location.mapX ?? 50,
        y: i.location.mapY ?? 50,
        color: MARKER_COLOR[i.status] ?? "#a1a1aa",
        label: `${i.ref} — ${i.title}`,
        size: 3,
        onClick: () => setSelectedId(i.id),
      })),
    [effectiveFiltered]
  );

  const selected =
    effectiveFiltered.find((i) => i.id === (focusIncident?.id ?? selectedId)) ?? null;
  const activeFilterCount = services.size + statuses.size + (query.trim() ? 1 : 0);

  const clearFilters = () => {
    setQuery("");
    setServices(new Set());
    setStatuses(new Set());
  };

  const filtersNode = (
    <MapFilterControls
      query={query}
      onQuery={setQuery}
      services={services}
      onToggleService={(s) => setServices((prev) => toggleIn(prev, s))}
      statuses={statuses}
      onToggleStatus={(s) => setStatuses((prev) => toggleIn(prev, s))}
      shown={filtered.length}
      total={INCIDENTS.length}
    />
  );

  return (
    <div className="relative -mb-24 h-[calc(100dvh-3.5rem)] w-full overflow-hidden bg-[#0a0b0d] lg:-mb-8">
      {/* base map */}
      <div className="sasi-grid-bg pointer-events-none absolute inset-0 opacity-70" />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="Civic intelligence map of Gauteng with incident markers"
      >
        <MemoBase />
        <MemoMarkers markers={markers} selectedId={focusIncident?.id ?? selectedId} onSelect={setSelectedId} />
      </svg>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 42%, transparent 45%, rgba(0,0,0,0.55) 100%)" }}
        aria-hidden
      />

      {/* briefing focus banner — honest origin + one-click clear */}
      {focusIncident && (
        <div className="sasi-pop absolute left-1/2 top-4 z-20 -translate-x-1/2">
          <div className="sasi-map-focus flex items-center gap-2 rounded-full border py-1.5 pl-3 pr-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#e3c567] sasi-breathe" aria-hidden />
            <p className="whitespace-nowrap text-[11.5px] text-[#efe0a8]">
              <span className="font-medium">{focusIncident.ref}</span>
              <span className="hidden sm:inline"> · From your city briefing</span>
            </p>
            <button
              onClick={clearMapFocus}
              className="flex h-6 items-center gap-1 rounded-full border border-[#e3c567]/25 px-2 text-[10.5px] font-medium text-[#efe0a8] transition-colors hover:border-[#e3c567]/50 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e3c567]/60"
              aria-label="Clear briefing focus and return to your filters"
            >
              <X className="h-3 w-3" aria-hidden />
              Clear
            </button>
          </div>
        </div>
      )}

      {/* desktop — floating filter panel */}
      <div className="absolute left-4 top-4 z-10 hidden w-64 lg:block">
        <div className="sasi-card p-3">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              Map filters
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-[10.5px] text-zinc-500 transition-colors hover:text-zinc-200"
                aria-label="Clear map filters"
              >
                <X className="h-3 w-3" aria-hidden /> Clear
              </button>
            )}
          </div>
          {filtersNode}
        </div>
      </div>

      {/* desktop — floating detail panel */}
      <div className="absolute right-4 top-4 z-10 hidden w-80 lg:block">
        <div className="sasi-card p-4">
          {selected ? (
            <SelectedIncidentSummary incident={selected} onOpen={() => openIncident(selected.id)} />
          ) : (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03]">
                <Crosshair className="h-4.5 w-4.5 text-zinc-500" aria-hidden />
              </span>
              <p className="text-[13px] font-medium text-white">Select a marker</p>
              <p className="mt-1 max-w-[240px] text-[12px] leading-relaxed text-zinc-500">
                Markers are colour-coded by trust status. Choose one to see the incident summary
                here.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {LEGEND.map((l) => (
                  <span
                    key={l.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/8 px-2 py-0.5 text-[10px] text-zinc-400"
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} aria-hidden />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* desktop — legend */}
      <div className="absolute bottom-4 left-4 z-10 hidden lg:block">
        <div className="sasi-card flex items-center gap-3.5 px-3.5 py-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
            Status
          </span>
          {LEGEND.map((l) => (
            <span key={l.label} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} aria-hidden />
              {l.label}
            </span>
          ))}
          <span className="border-l border-white/8 pl-3 font-mono text-[9px] tracking-[0.14em] text-zinc-700">
            STYLISED · NOT TO SCALE
          </span>
        </div>
      </div>

      {/* mobile — filter button (44px touch target) */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label={`Open map filters${activeFilterCount > 0 ? ` (${activeFilterCount} active)` : ""}`}
        className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 bg-black/70 text-zinc-200 backdrop-blur transition-colors hover:text-white lg:hidden"
      >
        <SlidersHorizontal className="h-5 w-5" aria-hidden />
        {activeFilterCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 font-mono text-[9px] font-bold text-black">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* mobile — selected incident bottom card (above bottom nav) */}
      {selected && (
        <div className="absolute inset-x-4 bottom-20 z-10 lg:hidden">
          <div className="sasi-card p-3.5">
            <SelectedIncidentSummary incident={selected} onOpen={() => openIncident(selected.id)} compact />
          </div>
        </div>
      )}

      {/* mobile — no results hint */}
      {filtered.length === 0 && (
        <div className="absolute left-1/2 top-16 z-10 w-[calc(100%-2rem)] max-w-xs -translate-x-1/2 lg:left-auto lg:right-4 lg:top-40 lg:w-80 lg:translate-x-0">
          <div className="sasi-card p-3.5 text-center">
            <p className="text-[12.5px] font-medium text-white">No incidents match these filters</p>
            <p className="mt-1 text-[11.5px] text-zinc-500">Widen the service or status filters.</p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-2.5 text-[11.5px] font-medium text-zinc-300 underline underline-offset-4 hover:text-white"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>
      )}

      {/* mobile — filters drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="border-white/10 bg-[#0b0c0e] text-white">
          <DrawerHeader className="pb-1 text-left">
            <DrawerTitle className="text-[14px] font-semibold text-white">Map filters</DrawerTitle>
            <DrawerDescription className="text-[12px] text-zinc-500">
              Filter the demo incidents shown on the map.
            </DrawerDescription>
          </DrawerHeader>
          <div className="sasi-scroll max-h-[55vh] overflow-y-auto px-4 pb-2">{filtersNode}</div>
          <div className="border-t border-white/5 px-4 py-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {LEGEND.map((l) => (
                  <span key={l.label} className="inline-flex items-center gap-1 text-[10.5px] text-zinc-400">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} aria-hidden />
                    {l.label}
                  </span>
                ))}
              </div>
              <span className="font-mono text-[9px] tracking-[0.14em] text-zinc-700">DEMO</span>
            </div>
          </div>
          <DrawerFooter className="pt-1">
            <PrimaryButton
              className="h-11 w-full"
              onClick={() => setDrawerOpen(false)}
              aria-label="Show filtered incidents on map"
            >
              Show {filtered.length} incident{filtered.length === 1 ? "" : "s"}
            </PrimaryButton>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
