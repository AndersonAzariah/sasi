"use client";

import { memo, useMemo, useState } from "react";
import { Crosshair, Map as MapIcon, Search, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSasiStore } from "@/lib/sasi/store";
import { useT } from "@/lib/sasi/i18n";
import { INCIDENTS } from "@/lib/sasi/data";
import type { Incident, SasiCase, TrustStatus } from "@/lib/sasi/types";
import { SERVICES, timeAgo } from "@/lib/sasi/utils";
import {
  CaseStatusBadge,
  DemoBadge,
  PriorityBadge,
  PrimaryButton,
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
   The user's own reports are placed near their saved location
   with a deterministic per-ref jitter (stable across renders).
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

/** city → stylised coords (reuse the label table so they always agree) */
const CITY_COORDS: Record<string, { x: number; y: number }> = Object.fromEntries(
  CITY_LABELS.map((c) => [c.name.toLowerCase(), { x: c.x, y: c.y }])
);

/** deterministic pseudo-jitter so user-case markers don't stack on one dot */
function jitterFrom(seed: string, span = 3.2): { dx: number; dy: number } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const unit = ((h >>> 0) % 1000) / 1000; // 0..1, stable per seed
  const angle = (((h >>> 7) % 360) * Math.PI) / 180;
  const r = 1.3 + unit * span;
  return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r * 0.82 };
}

/** place a user report near their saved city (falls back to Johannesburg) */
export function placeAtCity(city: string, seed: string): { x: number; y: number } {
  const base =
    CITY_COORDS[city.trim().toLowerCase()] ?? CITY_COORDS["johannesburg"] ?? { x: 51, y: 60 };
  const j = jitterFrom(seed);
  return { x: base.x + j.dx, y: base.y + j.dy };
}

export const MARKER_COLOR: Record<string, string> = {
  URGENT: "#ef5350",
  CONFIRMED: "#66bb6a",
  REPORTED: "#64b5f6",
  RESOLVED: "#4b5563",
  INFERRED: "#e3c567",
  UNVERIFIED: "#a1a1aa",
};

/** user-placed reports get the national-light gold so they read as "yours" */
export const USER_CASE_COLOR = "#e3c567";

const LEGEND: { key: "status.urgent" | "status.confirmed" | "status.reported" | "status.resolved"; color: string }[] = [
  { key: "status.urgent", color: "#ef5350" },
  { key: "status.confirmed", color: "#66bb6a" },
  { key: "status.reported", color: "#64b5f6" },
  { key: "status.resolved", color: "#4b5563" },
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
  /** marker provenance — picks the a11y label + selection ring treatment */
  kind?: "incident" | "case";
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
        const ariaKind =
          m.kind === "case"
            ? "Your report marker"
            : "Incident marker";
        return (
          <g
            key={m.id}
            transform={`translate(${m.x} ${m.y})`}
            className="cursor-pointer outline-none"
            role="button"
            tabIndex={0}
            aria-label={m.label ? `${ariaKind} ${m.label}` : `${ariaKind} — untitled`}
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
            {m.kind === "case" && (
              /* quiet inner core so user reports read distinct from incidents */
              <circle r={r * 0.38} fill="#0a0b0d" opacity={0.55} pointerEvents="none" />
            )}
            {selected && <circle r={1.1} fill="#ffffff" pointerEvents="none" />}
          </g>
        );
      })}
    </g>
  );
}

/** "You are here" — quiet gold home marker at the saved location (non-interactive) */
function HomeMarker({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      className="pointer-events-none"
      aria-hidden
    >
      <circle
        r={5.2}
        fill="none"
        stroke={USER_CASE_COLOR}
        strokeOpacity={0.4}
        strokeWidth={0.35}
        strokeDasharray="1.1 1.5"
        className="sasi-home-ring"
      />
      <circle r={1.55} fill={USER_CASE_COLOR} stroke="#0a0b0d" strokeWidth={0.5} />
      <text
        y={-6.6}
        textAnchor="middle"
        fontSize={2.3}
        fill={USER_CASE_COLOR}
        opacity={0.85}
        className="font-mono"
      >
        {label}
      </text>
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
  const t = useT();
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" aria-hidden />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t("map.search")}
          aria-label={t("map.search-aria")}
          className="h-8 rounded-lg border-white/10 bg-white/[0.03] pl-8 text-[12.5px] text-white placeholder:text-zinc-600"
        />
      </div>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
          {t("map.service")}
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
                aria-label={`${t("map.service")}: ${SERVICES[s].label}`}
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
          {t("map.status")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {MAP_STATUSES.map((st) => {
            const active = statuses.has(st);
            const statusKey =
              st === "URGENT"
                ? "status.urgent"
                : st === "CONFIRMED"
                  ? "status.confirmed"
                  : st === "REPORTED"
                    ? "status.reported"
                    : "status.resolved";
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
                {t(statusKey)}
              </button>
            );
          })}
        </div>
      </div>

      <p className="border-t border-white/5 pt-2 font-mono text-[10px] tracking-wide text-zinc-600">
        {t("map.shown")
          .replace("{shown}", String(shown))
          .replace("{total}", String(total))}
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
  const t = useT();
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
          {t("map.updated").replace("{t}", timeAgo(incident.updatedAt))} ·{" "}
          {incident.sourceIds.length === 1
            ? t("map.sources-one").replace("{n}", "1")
            : t("map.sources-many").replace("{n}", String(incident.sourceIds.length))}
        </p>
      </div>

      <PrimaryButton onClick={onOpen} className="mt-3 h-11 w-full lg:h-9" aria-label={`Open incident ${incident.ref}`}>
        <MapIcon className="h-3.5 w-3.5" aria-hidden />
        {t("map.open-incident")}
      </PrimaryButton>
    </div>
  );
}

/* ---------- the user's own report (placed at their saved location) ---------- */

function SelectedCaseSummary({
  c,
  onOpen,
  compact = false,
}: {
  c: SasiCase;
  onOpen: () => void;
  compact?: boolean;
}) {
  const t = useT();
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#e3c567]/20 bg-[#e3c567]/[0.06]",
              SERVICE_TINT[c.service]
            )}
          >
            <ServiceIcon service={c.service} className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-white">{c.title}</p>
            <p className="mt-0.5 font-mono text-[10px] tracking-wider text-zinc-600">{c.ref}</p>
          </div>
        </div>
        <span
          className="sasi-live-tag inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[9px] tracking-[0.12em]"
          title="This is your own report — placed near your saved location"
        >
          {t("map.your-report-tag").toUpperCase()}
        </span>
      </div>

      {!compact && c.description && (
        <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-zinc-500">
          {c.description}
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <CaseStatusBadge status={c.status} />
        <PriorityBadge priority={c.priority} />
      </div>

      <div className="mt-2.5 space-y-0.5 border-t border-white/5 pt-2.5 text-[11.5px] text-zinc-500">
        <p className="truncate">
          {c.location.suburb ? `${c.location.suburb}, ` : ""}
          {c.location.city}
        </p>
        <p className="text-[11px] text-zinc-600">
          {t("map.filed").replace("{t}", timeAgo(c.createdAt))}
        </p>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">{t("map.saved-note")}</p>

      <PrimaryButton onClick={onOpen} className="mt-3 h-11 w-full lg:h-9" aria-label={`Open case ${c.ref}`}>
        <MapIcon className="h-3.5 w-3.5" aria-hidden />
        {t("map.open-case")}
      </PrimaryButton>
    </div>
  );
}

const MemoMarkers = memo(MapMarkers);
const MemoBase = memo(GautengBase);

export default function MapView() {
  const openIncident = useSasiStore((s) => s.openIncident);
  const openCase = useSasiStore((s) => s.openCase);
  const mapFocusRef = useSasiStore((s) => s.mapFocusRef);
  const clearMapFocus = useSasiStore((s) => s.clearMapFocus);
  const cases = useSasiStore((s) => s.cases);
  const savedLocation = useSasiStore((s) => s.savedLocation);
  const t = useT();

  const [query, setQuery] = useState("");
  const [services, setServices] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  /* the user's own reports — placed near their saved location, always visible */
  const userCases = useMemo(
    () => cases.filter((c) => c.id.startsWith("case-new-")),
    [cases]
  );
  const home = useMemo(
    () => placeAtCity(savedLocation.city, "sasi-home"),
    [savedLocation.city]
  );

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

  /* briefing watchlist → map click-through: the focused ref (incident OR the
     user's own case) is always visible and pre-selected, bypassing filters */
  const focusCase = useMemo(() => {
    if (!mapFocusRef || !mapFocusRef.startsWith("CASE-")) return null;
    return cases.find((c) => c.ref.toUpperCase() === mapFocusRef) ?? null;
  }, [mapFocusRef, cases]);

  const focusIncident = useMemo(() => {
    if (!mapFocusRef || mapFocusRef.startsWith("CASE-")) return null;
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

  const caseMarkers = useMemo<GautengMarker[]>(
    () =>
      userCases.map((c) => {
        const pos = placeAtCity(c.location.city || savedLocation.city, c.ref);
        return {
          id: c.id,
          x: pos.x,
          y: pos.y,
          color: USER_CASE_COLOR,
          label: `${c.ref} — ${c.title}`,
          size: 2.7,
          kind: "case" as const,
          onClick: () => setSelectedId(c.id),
        };
      }),
    [userCases, savedLocation.city]
  );

  const incidentMarkers = useMemo<GautengMarker[]>(
    () =>
      effectiveFiltered.map((i) => ({
        id: i.id,
        x: i.location.mapX ?? 50,
        y: i.location.mapY ?? 50,
        color: MARKER_COLOR[i.status] ?? "#a1a1aa",
        label: `${i.ref} — ${i.title}`,
        size: 3,
        kind: "incident" as const,
        onClick: () => setSelectedId(i.id),
      })),
    [effectiveFiltered]
  );

  const markers = useMemo(
    () => [...incidentMarkers, ...caseMarkers],
    [incidentMarkers, caseMarkers]
  );

  /* selection: a case id wins; otherwise resolve the incident panel */
  const focusCaseId = focusCase?.id ?? null;
  const selectedCase =
    focusCaseId || (selectedId?.startsWith("case-new-") ?? false)
      ? userCases.find((c) => c.id === (focusCaseId ?? selectedId)) ?? null
      : null;
  const selectedIncident = selectedCase
    ? null
    : effectiveFiltered.find((i) => i.id === (focusIncident?.id ?? selectedId)) ?? null;
  const selected = selectedCase ?? selectedIncident;
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

  const summaryPanel = selectedCase ? (
    <SelectedCaseSummary c={selectedCase} onOpen={() => openCase(selectedCase.ref)} />
  ) : selectedIncident ? (
    <SelectedIncidentSummary incident={selectedIncident} onOpen={() => openIncident(selectedIncident.id)} />
  ) : null;

  return (
    <div className="relative -mb-24 h-[calc(100dvh-3.5rem)] w-full overflow-hidden bg-[#0a0b0d] lg:-mb-8">
      {/* base map */}
      <div className="sasi-grid-bg pointer-events-none absolute inset-0 opacity-70" />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="Civic intelligence map of Gauteng with incident markers and your reports"
      >
        <MemoBase />
        <HomeMarker x={home.x} y={home.y} label={t("map.you-are-here")} />
        <MemoMarkers markers={markers} selectedId={focusCase?.id ?? focusIncident?.id ?? selectedId} onSelect={setSelectedId} />
      </svg>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 42%, transparent 45%, rgba(0,0,0,0.55) 100%)" }}
        aria-hidden
      />

      {/* briefing focus banner — honest origin + one-click clear */}
      {(focusIncident || focusCase) && (
        <div className="sasi-pop absolute left-1/2 top-4 z-20 -translate-x-1/2">
          <div className="sasi-map-focus flex items-center gap-2 rounded-full border py-1.5 pl-3 pr-1.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#e3c567] sasi-breathe" aria-hidden />
            <p className="whitespace-nowrap text-[11.5px] text-[#efe0a8]">
              <span className="font-medium">{focusCase?.ref ?? focusIncident?.ref}</span>
              <span className="hidden sm:inline">
                {" "}
                · {focusCase ? t("map.your-report-tag") : t("map.from-briefing")}
              </span>
            </p>
            <button
              onClick={clearMapFocus}
              className="flex h-6 items-center gap-1 rounded-full border border-[#e3c567]/25 px-2 text-[10.5px] font-medium text-[#efe0a8] transition-colors hover:border-[#e3c567]/50 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e3c567]/60"
              aria-label="Clear briefing focus and return to your filters"
            >
              <X className="h-3 w-3" aria-hidden />
              {t("map.clear")}
            </button>
          </div>
        </div>
      )}

      {/* desktop — floating filter panel */}
      <div className="absolute left-4 top-4 z-10 hidden w-64 lg:block">
        <div className="sasi-card p-3">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
              {t("map.filters")}
            </p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-[10.5px] text-zinc-500 transition-colors hover:text-zinc-200"
                aria-label="Clear map filters"
              >
                <X className="h-3 w-3" aria-hidden /> {t("map.clear")}
              </button>
            )}
          </div>
          {filtersNode}
        </div>
      </div>

      {/* desktop — floating detail panel */}
      <div className="absolute right-4 top-4 z-10 hidden w-80 lg:block">
        <div className="sasi-card p-4">
          {summaryPanel ?? (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03]">
                <Crosshair className="h-4.5 w-4.5 text-zinc-500" aria-hidden />
              </span>
              <p className="text-[13px] font-medium text-white">{t("map.select-marker")}</p>
              <p className="mt-1 max-w-[240px] text-[12px] leading-relaxed text-zinc-500">
                {t("map.select-hint")}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {LEGEND.map((l) => (
                  <span
                    key={l.key}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/8 px-2 py-0.5 text-[10px] text-zinc-400"
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} aria-hidden />
                    {t(l.key)}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e3c567]/25 bg-[#e3c567]/[0.06] px-2 py-0.5 text-[10px] text-[#e3c567]">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: USER_CASE_COLOR }} aria-hidden />
                  {t("map.your-reports")}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* desktop — legend */}
      <div className="absolute bottom-4 left-4 z-10 hidden lg:block">
        <div className="sasi-card flex items-center gap-3.5 px-3.5 py-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
            {t("map.status")}
          </span>
          {LEGEND.map((l) => (
            <span key={l.key} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} aria-hidden />
              {t(l.key)}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 border-l border-white/8 pl-3 text-[11px] text-[#e3c567]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: USER_CASE_COLOR }} aria-hidden />
            {t("map.your-reports")}
          </span>
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

      {/* mobile — selected summary bottom card (above bottom nav) */}
      {summaryPanel && (
        <div className="absolute inset-x-4 bottom-20 z-10 lg:hidden">
          <div className="sasi-card p-3.5">
            {selectedCase ? (
              <SelectedCaseSummary c={selectedCase} onOpen={() => openCase(selectedCase.ref)} compact />
            ) : (
              selectedIncident && (
                <SelectedIncidentSummary
                  incident={selectedIncident}
                  onOpen={() => openIncident(selectedIncident.id)}
                  compact
                />
              )
            )}
          </div>
        </div>
      )}

      {/* mobile — no results hint */}
      {filtered.length === 0 && (
        <div className="absolute left-1/2 top-16 z-10 w-[calc(100%-2rem)] max-w-xs -translate-x-1/2 lg:left-auto lg:right-4 lg:top-40 lg:w-80 lg:translate-x-0">
          <div className="sasi-card p-3.5 text-center">
            <p className="text-[12.5px] font-medium text-white">{t("map.none-title")}</p>
            <p className="mt-1 text-[11.5px] text-zinc-500">{t("map.none-hint")}</p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-2.5 text-[11.5px] font-medium text-zinc-300 underline underline-offset-4 hover:text-white"
              >
                {t("map.clear-all")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* mobile — filters drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="border-white/10 bg-[#0b0c0e] text-white">
          <DrawerHeader className="pb-1 text-left">
            <DrawerTitle className="text-[14px] font-semibold text-white">{t("map.filters")}</DrawerTitle>
            <DrawerDescription className="text-[12px] text-zinc-500">
              {t("map.filters.description")}
            </DrawerDescription>
          </DrawerHeader>
          <div className="sasi-scroll max-h-[55vh] overflow-y-auto px-4 pb-2">{filtersNode}</div>
          <div className="border-t border-white/5 px-4 py-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {LEGEND.map((l) => (
                  <span key={l.key} className="inline-flex items-center gap-1 text-[10.5px] text-zinc-400">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} aria-hidden />
                    {t(l.key)}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1 text-[10.5px] text-[#e3c567]">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: USER_CASE_COLOR }} aria-hidden />
                  {t("map.your-reports")}
                </span>
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
              {filtered.length === 1
                ? t("map.show-one")
                : t("map.show-many").replace("{n}", String(filtered.length))}
            </PrimaryButton>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
