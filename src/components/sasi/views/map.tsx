"use client"

import "leaflet/dist/leaflet.css";
import type * as LeafletTypes from "leaflet";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Crosshair,
  Layers,
  LocateFixed,
  Map as MapIcon,
  MapPinned,
  Minus,
  Moon,
  Plus,
  Satellite,
  Search,
  SlidersHorizontal,
  WifiOff,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSasiStore } from "@/lib/sasi/store";
import { useT } from "@/lib/sasi/i18n";
import { INCIDENTS } from "@/lib/sasi/data";
import type { Incident, ServiceKey, SasiCase, TrustStatus } from "@/lib/sasi/types";
import {
  CASE_STATUS_META,
  PRIORITY_META,
  SERVICES,
  TRUST_STATUS_META,
  timeAgo,
} from "@/lib/sasi/utils";
import { ServiceIcon, SERVICE_TINT } from "../primitives";
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
   MAP VIEW — Leaflet service-intelligence map (Gauteng)

   Tiles: Google road imagery under a dark "national-light" CSS
   filter, with automatic OpenStreetMap fallback after repeated
   tile errors, and an honest offline note when no imagery can
   load at all (markers, pins and coordinates keep working).
   Task 20: three imagery styles — Midnight (dark filtered
   road), Satellite (true-colour) and Hybrid (satellite +
   roads) — switchable from the layers popover.

   Coordinates: the stylised 0–100 map space (mapX/mapY) is
   projected onto real Gauteng lat/lng with a per-axis linear
   calibration (least-squares fit over nine city anchors —
   Pretoria, Centurion, Midrand, Randburg, Sandton,
   Johannesburg, Roodepoort, Soweto, Benoni; residual ≈ 3–5 km,
   honest for a stylised demo canvas).

   Task 20 map system:
   — PIN CLUSTERING: overlapping pins collapse into numbered
     glass clusters (greedy pixel-distance grouping, recomputed
     on zoom); a cluster click flies out to reveal its members.
     The selected pin and a briefing focus pin always stay solo.
   — PIN DIRECTORY: a live index of everything plotted, sorted
     by distance from the saved location; a row click flies to
     the pin and opens its popup.
   — LIVE READOUT: centre coordinates + zoom in a mono chip.
   — KEYBOARD CYCLING: ArrowUp/ArrowDown walks the visible
     pins while the map has focus.

   Content honesty: the map plots the user's OWN reports (store
   cases) plus whatever demo incidents still exist in data.ts.
   If both are empty the view shows an explicit empty state —
   SASI never invents map data.
   ============================================================ */


/* ---------- calibration: stylised 0–100 space → Gauteng lat/lng ---------- */

const CAL_LNG_A = 27.51385;
const CAL_LNG_B = 0.010135;
const CAL_LAT_A = -25.58251;
const CAL_LAT_B = -0.0109497;

/** project a point from the stylised 0–100 map space onto real Gauteng coordinates */
function svgToLatLng(x: number, y: number): [number, number] {
  return [CAL_LAT_A + CAL_LAT_B * y, CAL_LNG_A + CAL_LNG_B * x];
}

/** calibrated bounds of the whole stylised canvas (SW corner, NE corner) */
const CANVAS_BOUNDS: [[number, number], [number, number]] = [
  svgToLatLng(0, 100),
  svgToLatLng(100, 0),
];

const FOCUS_ZOOM = 13;
const HOME_ZOOM = 12;
/** pins closer than this (screen px) collapse into one numbered cluster */
const CLUSTER_PX = 44;

/* ---------- tile sources + honest fallback state machine ---------- */

type MapStyleKey = "midnight" | "satellite" | "hybrid";

const TILE_URLS: Record<MapStyleKey, string> = {
  midnight: "https://mt{s}.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}",
  satellite: "https://mt{s}.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}",
  hybrid: "https://mt{s}.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}",
};

const MAP_STYLE_LABEL: Record<MapStyleKey, string> = {
  midnight: "Midnight",
  satellite: "Satellite",
  hybrid: "Hybrid",
};

const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

type TileState = "loading" | "google" | "osm" | "offline";

function attributionLine(state: TileState): string {
  if (state === "google") return "Imagery © Google";
  if (state === "osm") return "Imagery © OpenStreetMap contributors";
  if (state === "offline") return "Live imagery unavailable offline";
  return "Loading imagery…";
}

/* ---------- marker glyphs (raw lucide paths — divIcon HTML cannot hold React) ---------- */

const GLYPH_SVG_OPEN =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

const SERVICE_GLYPH: Record<ServiceKey, string> = {
  water: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  electricity: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  roads: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  waste: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
  healthcare: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
  education: '<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
  housing: '<path d="M3 22h18"/><path d="M6 18v-7"/><path d="M10 18v-7"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="m12 2 8 5H4l8-5Z"/>',
  documents: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  safety: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  "local-government": '<path d="M3 22h18"/><path d="M6 18v-7"/><path d="M10 18v-7"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="m12 2 8 5H4l8-5Z"/>',
  other: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
};

const HOME_GLYPH =
  '<path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>';

const OPEN_ARROW_GLYPH = '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>';

/** per-service accent colours (mirrors SERVICE_TINT + MARKER_COLOR families) */
const SERVICE_ACCENT: Record<ServiceKey, string> = {
  water: "#64b5f6",
  electricity: "#e3c567",
  roads: "#d4d4d8",
  waste: "#66bb6a",
  healthcare: "#ef5350",
  education: "#64b5f6",
  housing: "#e3c567",
  documents: "#d4d4d8",
  safety: "#ef5350",
  "local-government": "#d4d4d8",
  other: "#a1a1aa",
};

/** user-placed reports carry the national-light gold ring so they read as "yours" */
const USER_GOLD = "#e3c567";

/* ---------- pin HTML (28px glass tile + optional gold mine-dot + selection halo) ---------- */

function pinInnerHtml(glyph: string, accent: string, opts: { selected: boolean; mine: boolean }): string {
  const classes = [
    "sasi-pin",
    opts.mine ? "sasi-pin-mine" : "",
    opts.selected ? "sasi-pin-sel" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    `<div class="${classes}" style="--pin:${accent}">` +
    (opts.selected ? '<span class="sasi-pin-halo" aria-hidden="true"></span>' : "") +
    `<span class="sasi-pin-tile" aria-hidden="true">${GLYPH_SVG_OPEN}${glyph}</svg></span>` +
    (opts.mine ? '<span class="sasi-pin-mine-dot" aria-hidden="true"></span>' : "") +
    "</div>"
  );
}

function homeInnerHtml(label: string): string {
  return (
    '<div class="sasi-home" aria-hidden="true">' +
    `<span class="sasi-home-dot">${GLYPH_SVG_OPEN}${HOME_GLYPH}</svg></span>` +
    `<span class="sasi-home-label">${label}</span>` +
    "</div>"
  );
}

function clusterInnerHtml(count: number): string {
  return (
    '<div class="sasi-cluster" aria-hidden="true">' +
    `<span class="sasi-cluster-count">${count}</span>` +
    "</div>"
  );
}

/** members of a dead-end cluster (pins too close to ever separate
    by zooming) — one row per report, click force-solos that pin */
function clusterListHtml(pins: PlotPin[]): string {
  const rows = pins
    .map(
      (p) =>
        '<button type="button" class="sasi-pop-row" data-sasi-pin="' + esc(p.id) + '">' +
        '<span class="sasi-pop-row-dot" style="background:' + p.accent + '" aria-hidden="true"></span>' +
        '<span class="sasi-pop-row-main"><span class="sasi-pop-row-title">' + esc(p.title) + '</span>' +
        '<span class="sasi-pop-row-ref">' + esc(p.ref) + (p.kind === "case" ? " · YOURS" : "") + '</span></span>' +
        '</button>'
    )
    .join("");
  return (
    '<div class="sasi-pop-card">' +
    '<p class="sasi-pop-clustertitle">' + pins.length + ' reports at this spot</p>' +
    rows +
    "</div>"
  );
}

/** priority accent dots inside the popup meta line */
const PRIORITY_DOT: Record<string, string> = {
  CRITICAL: "#ef5350",
  HIGH: "#ef5350",
  MEDIUM: "#e3c567",
  LOW: "#a1a1aa",
};

/* ---------- popup HTML (minimal glass card) ---------- */

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function popupHtml(pin: PlotPin, yoursTag: string, openLabel: string): string {
  const serviceLabel = SERVICES[pin.service]?.label ?? "Service";
  const priorityDot = pin.priorityKey
    ? `<span class="sasi-pop-pdot" style="background:${PRIORITY_DOT[pin.priorityKey] ?? "#a1a1aa"}" aria-hidden="true"></span>`
    : "";
  return (
    '<div class="sasi-pop-card">' +
    '<div class="sasi-pop-head">' +
    `<span class="sasi-pop-glyph" style="color:${pin.accent}" aria-hidden="true">${GLYPH_SVG_OPEN}${SERVICE_GLYPH[pin.service] ?? SERVICE_GLYPH.other}</svg></span>` +
    '<div class="sasi-pop-id">' +
    `<p class="sasi-pop-title">${esc(pin.title)}</p>` +
    `<p class="sasi-pop-ref">${esc(pin.ref)}</p>` +
    "</div>" +
    (pin.kind === "case" ? `<span class="sasi-pop-yours">${esc(yoursTag)}</span>` : "") +
    "</div>" +
    `<p class="sasi-pop-meta"><span style="color:${pin.accent}">${esc(serviceLabel)}</span> · ${esc(pin.statusLabel)}${pin.detail ? ` · ${priorityDot}${esc(pin.detail)}` : ""}${pin.kind === "incident" ? " · DEMO" : ""}</p>` +
    (pin.loc ? `<p class="sasi-pop-loc">${esc(pin.loc)}</p>` : "") +
    `<button type="button" class="sasi-pop-btn" data-sasi-open="${pin.kind}" data-ref="${esc(pin.kind === "case" ? pin.ref : pin.id)}">${esc(openLabel)}${GLYPH_SVG_OPEN}${OPEN_ARROW_GLYPH}</svg></button>` +
    "</div>"
  );
}

/* ---------- scoped styles for the Leaflet surface (globals.css is owned elsewhere) ---------- */

const SASI_MAP_CSS = `
.sasi-leaflet-root { background:#0a0b0d; }
.sasi-leaflet-root .leaflet-container { background:#0a0b0d; font-family:inherit; }
/* imagery style grading — keyed on data-style (Task 20):
   Midnight = the national dark invert, Satellite/Hybrid = true colour,
   gently graded toward the dark UI */
.sasi-leaflet-root[data-style="midnight"] .leaflet-tile-pane {
  filter: invert(0.9) hue-rotate(185deg) saturate(0.42) brightness(0.94) contrast(1.07);
}
.sasi-leaflet-root[data-style="satellite"] .leaflet-tile-pane {
  filter: saturate(0.9) contrast(1.06) brightness(0.88);
}
.sasi-leaflet-root[data-style="hybrid"] .leaflet-tile-pane {
  filter: saturate(0.95) contrast(1.05) brightness(0.9);
}
.sasi-leaflet-root .sasi-pin-wrap { background:transparent; border:none; }
.sasi-leaflet-root .leaflet-marker-icon { outline:none; }
.sasi-pin { position:relative; width:34px; height:34px; display:flex; align-items:center; justify-content:center; }
.sasi-pin-tile {
  width:28px; height:28px; border-radius:9px;
  display:flex; align-items:center; justify-content:center;
  color:var(--pin,#a1a1aa);
  background:linear-gradient(165deg, rgba(255,255,255,0.13), rgba(255,255,255,0.04) 55%, rgba(0,0,0,0.22));
  border:1px solid rgba(255,255,255,0.16);
  box-shadow:0 2px 5px rgba(0,0,0,0.55), 0 6px 14px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.1);
  -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px);
  transition:transform 0.18s cubic-bezier(0.23,1,0.32,1), border-color 0.18s, box-shadow 0.18s;
}
.sasi-pin-tile svg { width:15px; height:15px; display:block; filter:drop-shadow(0 1px 1px rgba(0,0,0,0.65)); }
.sasi-pin:hover .sasi-pin-tile { transform:scale(1.08); }
.sasi-pin-mine .sasi-pin-tile {
  border-color:rgba(227,197,103,0.6);
  box-shadow:0 0 0 1.5px rgba(227,197,103,0.28), 0 2px 7px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12);
}
.sasi-pin-mine-dot {
  position:absolute; top:-1px; right:-1px; width:9px; height:9px; border-radius:50%;
  background:#e3c567; border:1.5px solid #0a0b0d; box-shadow:0 0 6px rgba(227,197,103,0.6);
}
.sasi-pin-sel .sasi-pin-tile {
  transform:scale(1.16);
  border-color:rgba(255,255,255,0.55);
  box-shadow:0 0 0 2px rgba(255,255,255,0.22), 0 4px 12px rgba(0,0,0,0.6);
}
.sasi-pin-sel:hover .sasi-pin-tile { transform:scale(1.16); }
.sasi-pin-mine.sasi-pin-sel .sasi-pin-tile {
  border-color:rgba(240,224,168,0.9);
  box-shadow:0 0 0 2px rgba(227,197,103,0.4), 0 4px 14px rgba(0,0,0,0.6);
}
.sasi-leaflet-root .leaflet-marker-icon:focus-visible .sasi-pin-tile {
  border-color:rgba(255,255,255,0.75);
  box-shadow:0 0 0 2px rgba(255,255,255,0.45), 0 4px 12px rgba(0,0,0,0.6);
}
.sasi-pin-halo {
  position:absolute; inset:-1px; border-radius:11px; pointer-events:none;
  border:1.5px solid var(--pin,#e3c567);
  animation:sasi-pin-pulse 2.2s cubic-bezier(0.23,1,0.32,1) infinite;
}
@keyframes sasi-pin-pulse {
  0% { transform:scale(1); opacity:0.85; }
  70% { transform:scale(1.6); opacity:0; }
  100% { transform:scale(1.6); opacity:0; }
}
@media (prefers-reduced-motion: reduce) { .sasi-pin-halo { animation:none; opacity:0.5; } }
.sasi-home { position:relative; width:44px; height:44px; display:flex; align-items:center; justify-content:center; }
.sasi-home-dot {
  width:30px; height:30px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  color:#e3c567; background:rgba(227,197,103,0.08);
  border:1px dashed rgba(227,197,103,0.45);
  box-shadow:0 2px 8px rgba(0,0,0,0.5);
}
.sasi-home-dot svg { width:13px; height:13px; }
.sasi-home-label {
  position:absolute; bottom:calc(100% + 2px); left:50%; transform:translateX(-50%);
  font-family:ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size:9.5px; font-weight:500; letter-spacing:0.14em; text-transform:uppercase;
  color:rgba(227,197,103,0.9); white-space:nowrap; text-shadow:0 1px 3px rgba(0,0,0,0.9);
}
.sasi-leaflet-root .sasi-tip.leaflet-tooltip {
  background:rgba(12,13,15,0.92); border:1px solid rgba(255,255,255,0.12); color:#d4d4d8;
  font-family:ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size:10px; font-weight:500; letter-spacing:0.1em;
  border-radius:7px; padding:3px 7px; box-shadow:0 4px 14px rgba(0,0,0,0.45);
}
.sasi-leaflet-root .sasi-tip.leaflet-tooltip-top::before { border-top-color:rgba(12,13,15,0.92); }
/* ---------- pin clusters (Task 20) — numbered glass orbs with a
   slow dashed orbit ring; click flies out to the members ---------- */
.sasi-leaflet-root .sasi-cluster-wrap { background:transparent; border:none; }
.sasi-cluster {
  position:relative; width:38px; height:38px; border-radius:50%;
  display:flex; align-items:center; justify-content:center;
  cursor:pointer;
  background:linear-gradient(165deg, rgba(255,255,255,0.15), rgba(255,255,255,0.05) 55%, rgba(0,0,0,0.3));
  border:1px solid rgba(255,255,255,0.22);
  box-shadow:0 2px 6px rgba(0,0,0,0.55), 0 8px 18px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.14);
  -webkit-backdrop-filter:blur(6px); backdrop-filter:blur(6px);
  transition:transform 0.18s cubic-bezier(0.23,1,0.32,1), border-color 0.18s;
}
.sasi-cluster:hover { transform:scale(1.1); border-color:rgba(255,255,255,0.4); }
.sasi-cluster::before {
  content:""; position:absolute; inset:-5px; border-radius:50%;
  border:1px dashed rgba(255,255,255,0.16);
  animation:sasi-cluster-orbit 16s linear infinite; pointer-events:none;
}
@keyframes sasi-cluster-orbit { to { transform:rotate(360deg); } }
.sasi-cluster-count {
  font-family:ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size:12.5px; font-weight:600; color:#fff;
  text-shadow:0 1px 3px rgba(0,0,0,0.85); pointer-events:none;
}
@media (prefers-reduced-motion: reduce) { .sasi-cluster::before { animation:none; opacity:0.5; } }
/* priority dot inside popup meta (Task 20) */
.sasi-pop-pdot {
  display:inline-block; width:5px; height:5px; border-radius:50%;
  margin-right:3px; vertical-align:1.5px;
}
/* dead-end cluster member list (Task 20) */
.sasi-pop-clustertitle {
  margin:0 0 6px; font-family:ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size:9.5px; font-weight:600; letter-spacing:0.14em; text-transform:uppercase; color:#71717a;
}
.sasi-pop-row {
  display:flex; align-items:center; gap:8px; width:100%;
  padding:7px 8px; margin:0 -8px; width:calc(100% + 16px);
  background:transparent; border:none; border-radius:9px;
  cursor:pointer; text-align:left; font-family:inherit;
  transition:background 0.15s;
}
.sasi-pop-row:hover { background:rgba(255,255,255,0.06); }
.sasi-pop-row + .sasi-pop-row { margin-top:2px; }
.sasi-pop-row-dot { flex:0 0 auto; width:7px; height:7px; border-radius:50%; border:1px solid rgba(0,0,0,0.5); }
.sasi-pop-row-main { min-width:0; display:flex; flex-direction:column; gap:1px; }
.sasi-pop-row-title { font-size:12px; font-weight:600; color:#fff; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sasi-pop-row-ref {
  font-family:ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size:9px; letter-spacing:0.12em; color:#71717a;
}
.sasi-leaflet-root .sasi-leaflet-popup .leaflet-popup-content-wrapper {
  background:rgba(11,12,14,0.88);
  -webkit-backdrop-filter:blur(16px); backdrop-filter:blur(16px);
  border:1px solid rgba(255,255,255,0.11);
  border-radius:14px;
  box-shadow:0 14px 40px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06);
  color:#fff;
}
.sasi-leaflet-root .sasi-leaflet-popup .leaflet-popup-content { margin:10px 12px; width:auto !important; line-height:1.45; }
.sasi-leaflet-root .sasi-leaflet-popup .leaflet-popup-tip {
  background:rgba(11,12,14,0.92); border:1px solid rgba(255,255,255,0.1); box-shadow:none;
}
.sasi-leaflet-root .sasi-leaflet-popup a.leaflet-popup-close-button {
  color:#71717a; width:22px; height:22px; font-size:16px; line-height:22px; top:6px; right:6px;
}
.sasi-leaflet-root .sasi-leaflet-popup a.leaflet-popup-close-button:hover { color:#fff; background:transparent; border:none; }
.sasi-pop-card { width:238px; }
.sasi-pop-head { display:flex; align-items:flex-start; gap:8px; padding-right:16px; }
.sasi-pop-glyph {
  flex:0 0 auto; width:28px; height:28px; border-radius:9px;
  display:flex; align-items:center; justify-content:center;
  background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);
}
.sasi-pop-glyph svg { width:14px; height:14px; }
.sasi-pop-id { min-width:0; }
.sasi-pop-title { margin:0; font-size:12.5px; font-weight:600; color:#fff; line-height:1.3; overflow-wrap:anywhere; }
.sasi-pop-ref { margin:2px 0 0; font-family:ui-monospace, SFMono-Regular, Menlo, monospace; font-size:9.5px; letter-spacing:0.14em; color:#71717a; }
.sasi-pop-yours {
  flex:0 0 auto; margin-left:auto;
  font-family:ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size:8.5px; font-weight:600; letter-spacing:0.12em; text-transform:uppercase;
  color:#e3c567; border:1px solid rgba(227,197,103,0.35); background:rgba(227,197,103,0.08);
  border-radius:999px; padding:3px 6px;
}
.sasi-pop-meta { margin:8px 0 0; font-size:11px; color:#a1a1aa; }
.sasi-pop-loc { margin:2px 0 0; font-size:10.5px; color:#71717a; }
.sasi-pop-btn {
  margin-top:10px; width:100%; min-height:36px;
  display:inline-flex; align-items:center; justify-content:center; gap:6px;
  font-family:inherit; font-size:11.5px; font-weight:600; color:#fff;
  border-radius:9px; cursor:pointer;
  border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.07);
  transition:background 0.15s, border-color 0.15s;
}
.sasi-pop-btn:hover { background:rgba(255,255,255,0.13); border-color:rgba(255,255,255,0.38); }
.sasi-pop-btn svg { width:12px; height:12px; }
`;

/* ---------- scoped styles: real-device location dot + locate control
   states (Task 15-c). Injected here on purpose — globals.css is owned
   by another workstream, so zero conflict by design. ---------- */

const SASI_GEO_CSS = `
.sasi-leaflet-root .sasi-geo-marker { background:transparent; border:none; }
.sasi-geo-wrap { position:relative; width:14px; height:14px; }
.sasi-geo-core {
  position:absolute; inset:0; border-radius:50%;
  background:#ffffff;
  border:2.5px solid #64b5f6;
  box-shadow:0 0 0 2px rgba(10,11,13,0.55), 0 1px 6px rgba(0,0,0,0.6), 0 0 12px rgba(100,181,246,0.6);
}
.sasi-geo-pulse {
  position:absolute; inset:-3px; border-radius:50%;
  border:2px solid rgba(100,181,246,0.75);
  pointer-events:none;
  animation:sasi-geo-ping 2.1s cubic-bezier(0.23,1,0.32,1) infinite;
}
@keyframes sasi-geo-ping {
  0% { transform:scale(0.85); opacity:0.9; }
  75% { transform:scale(2.7); opacity:0; }
  100% { transform:scale(2.7); opacity:0; }
}
/* follow-mode highlight — the sasi-search-glow-live "live ring" read,
   tuned for a 44px round control (two-class specificity beats .sasi-btn-glass) */
.sasi-geo-btn.sasi-geo-following {
  border-color:rgba(100,181,246,0.55);
  color:#a8d4f8;
  background:linear-gradient(180deg, rgba(100,181,246,0.18), rgba(100,181,246,0.07) 55%, rgba(100,181,246,0.12));
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.18),
    0 0 0 1px rgba(100,181,246,0.22),
    0 0 18px rgba(100,181,246,0.38),
    0 8px 24px -14px rgba(0,0,0,0.8);
}
.sasi-geo-btn.sasi-geo-following:hover {
  border-color:rgba(100,181,246,0.78);
  background:linear-gradient(180deg, rgba(100,181,246,0.24), rgba(100,181,246,0.10) 55%, rgba(100,181,246,0.16));
}
.sasi-geo-btn.sasi-geo-locating svg { animation:sasi-geo-breathe 1.5s ease-in-out infinite; }
@keyframes sasi-geo-breathe {
  0%, 100% { opacity:1; }
  50% { opacity:0.3; }
}
@media (prefers-reduced-motion: reduce) {
  .sasi-geo-pulse { animation:none; opacity:0.45; transform:scale(1.5); }
  .sasi-geo-btn.sasi-geo-locating svg { animation:none; opacity:0.65; }
}
`;

/* ---------- real-device geolocation internals ("Locate me", Task 15-c) ---------- */

type GeoPhase = "idle" | "locating" | "fixed" | "following";
type GeoErrorKind = "denied" | "unavailable";

interface GeoFix {
  lat: number;
  lng: number;
  accuracy: number;
}

const GEO_POSITION_OPTS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 15000,
};

const GEO_ZOOM = 16;
/** while following, the camera only re-pans after the device moves this far */
const GEO_FOLLOW_PAN_M = 30;

function isGeoErrorDenied(err: GeolocationPositionError): boolean {
  return err.code === err.PERMISSION_DENIED;
}

/* ---------- filter internals ---------- */

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

/* ---------- unified plottable pin (incidents AND the user's own reports) ---------- */

interface PlotPin {
  id: string;
  kind: "case" | "incident";
  ref: string;
  title: string;
  service: ServiceKey;
  accent: string;
  latlng: [number, number];
  statusLabel: string;
  priorityKey: string;
  detail: string;
  loc: string;
}

/** a numbered glass orb standing in for pins that overlap at the current zoom */
interface PinCluster {
  id: string;
  latlng: [number, number];
  pins: PlotPin[];
}

/** great-circle distance in metres — powers the pin directory ordering */
function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const la = (a[0] * Math.PI) / 180;
  const lb = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "850 m" / "3.2 km" for the directory rows */
function fmtDistance(m: number): string {
  if (m >= 950) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 10) * 10} m`;
}

function incidentToPin(i: Incident): PlotPin {
  return {
    id: i.id,
    kind: "incident",
    ref: i.ref,
    title: i.title,
    service: i.service,
    accent: SERVICE_ACCENT[i.service] ?? "#a1a1aa",
    latlng: svgToLatLng(i.location.mapX ?? 50, i.location.mapY ?? 50),
    statusLabel: TRUST_STATUS_META[i.status]?.label ?? i.status,
    priorityKey: i.severity,
    detail: PRIORITY_META[i.severity]?.label ?? i.severity,
    loc: [i.location.suburb, i.location.city].filter(Boolean).join(", "),
  };
}

function caseToPin(c: SasiCase, fallbackCity: string): PlotPin {
  /* Task 21: GPS-backed reports carry REAL device coordinates —
     pin them exactly where the reporter stood. Everything else
     still falls back to the city-level placement. */
  const realLat = c.location.lat;
  const realLng = c.location.lng;
  const hasRealFix =
    typeof realLat === "number" &&
    typeof realLng === "number" &&
    Number.isFinite(realLat) &&
    Number.isFinite(realLng);
  const pos = hasRealFix
    ? null
    : placeAtCity(c.location.city || fallbackCity, c.ref);
  return {
    id: c.id,
    kind: "case",
    ref: c.ref.toUpperCase(),
    title: c.title,
    service: c.service,
    accent: SERVICE_ACCENT[c.service] ?? USER_GOLD,
    latlng: hasRealFix
      ? [realLat as number, realLng as number]
      : svgToLatLng(pos!.x, pos!.y),
    statusLabel: CASE_STATUS_META[c.status]?.label ?? c.status,
    priorityKey: c.priority,
    detail: PRIORITY_META[c.priority]?.label ?? c.priority,
    loc: [c.location.suburb, c.location.city].filter(Boolean).join(", "),
  };
}

/* ============================================================
   MAP VIEW — default export
   ============================================================ */

export default function MapView() {
  const openIncident = useSasiStore((s) => s.openIncident);
  const openCase = useSasiStore((s) => s.openCase);
  const navigate = useSasiStore((s) => s.navigate);
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
  const [tileState, setTileState] = useState<TileState>("loading");

  /* ---- Task 20: imagery style + pin clustering + live readout ---- */
  const [mapStyle, setMapStyle] = useState<MapStyleKey>("midnight");
  const [styleOpen, setStyleOpen] = useState(false);
  const [clusters, setClusters] = useState<PinCluster[]>([]);
  const [soloPins, setSoloPins] = useState<PlotPin[]>([]);
  const [viewInfo, setViewInfo] = useState<{ lat: number; lng: number; z: number } | null>(null);

  /* ---- Leaflet handles (populated in the one-shot mount effect) ---- */
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletTypes.Map | null>(null);
  const LRef = useRef<typeof LeafletTypes | null>(null);
  const tileRef = useRef<LeafletTypes.TileLayer | null>(null);
  const markersRef = useRef<Map<string, LeafletTypes.Marker>>(new Map());
  const markerSelRef = useRef<Map<string, boolean>>(new Map());
  const clusterMarkersRef = useRef<Map<string, LeafletTypes.Marker>>(new Map());
  const popupRef = useRef<LeafletTypes.Popup | null>(null);
  const homeMarkerRef = useRef<LeafletTypes.Marker | null>(null);
  const suppressCloseRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  /* ---- real-device geolocation ("Locate me", Task 15-c) ---- */
  const [geoPhase, setGeoPhase] = useState<GeoPhase>("idle");
  const [geoError, setGeoError] = useState<GeoErrorKind | null>(null);
  const geoFixRef = useRef<GeoFix | null>(null);
  const geoMarkerRef = useRef<LeafletTypes.Marker | null>(null);
  const geoCircleRef = useRef<LeafletTypes.Circle | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const geoDisposedRef = useRef(true);

  /* ---- the user's own reports — the map's honest core content ---- */
  const userCases = useMemo(
    () => cases.filter((c) => c.id.startsWith("case-new-")),
    [cases]
  );
  const hasIncidents = INCIDENTS.length > 0;
  const universeEmpty = !hasIncidents && userCases.length === 0;
  const home = useMemo(
    () => placeAtCity(savedLocation.city, "sasi-home"),
    [savedLocation.city]
  );
  const homeLatLng = useMemo(() => svgToLatLng(home.x, home.y), [home]);

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

  /* briefing watchlist → map click-through (incident OR the user's own case) */
  const focusCase = useMemo(() => {
    if (!mapFocusRef || !mapFocusRef.startsWith("CASE-")) return null;
    return cases.find((c) => c.ref.toUpperCase() === mapFocusRef) ?? null;
  }, [mapFocusRef, cases]);

  const focusIncident = useMemo(() => {
    if (!mapFocusRef || mapFocusRef.startsWith("CASE-")) return null;
    const ref = mapFocusRef.toLowerCase();
    return INCIDENTS.find((i) => i.ref.toLowerCase() === ref) ?? null;
  }, [mapFocusRef]);

  /* the focused pin is always visible, bypassing filters */
  const effectiveFiltered = useMemo(() => {
    if (!focusIncident || filtered.some((i) => i.id === focusIncident.id)) return filtered;
    return [focusIncident, ...filtered];
  }, [filtered, focusIncident]);

  const incidentPins = useMemo(() => effectiveFiltered.map(incidentToPin), [effectiveFiltered]);
  const casePins = useMemo(
    () => userCases.map((c) => caseToPin(c, savedLocation.city)),
    [userCases, savedLocation.city]
  );
  const plotPins = useMemo(() => [...casePins, ...incidentPins], [casePins, incidentPins]);

  const focusPin = useMemo<PlotPin | null>(() => {
    if (focusCase) return caseToPin(focusCase, savedLocation.city);
    if (focusIncident) return incidentToPin(focusIncident);
    return null;
  }, [focusCase, focusIncident, savedLocation.city]);
  const focusMissed = mapFocusRef !== null && focusPin === null;

  /* pin directory — everything plotted, nearest to the saved location first */
  const directoryPins = useMemo(() => {
    return [...plotPins].sort(
      (a, b) => haversineM(homeLatLng, a.latlng) - haversineM(homeLatLng, b.latlng)
    );
  }, [plotPins, homeLatLng]);

  /* keep the latest pins available to the mount effect (initial camera fit) */
  const pinsRef = useRef(plotPins);
  pinsRef.current = plotPins;
  const homeRef = useRef(homeLatLng);
  homeRef.current = homeLatLng;
  /* latest selection / focus / solo pins for clustering + keyboard cycling */
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const focusIdRef = useRef<string | null>(focusPin?.id ?? null);
  focusIdRef.current = focusPin?.id ?? null;
  const soloPinsRef = useRef<PlotPin[]>(soloPins);
  soloPinsRef.current = soloPins;

  const activeFilterCount = services.size + statuses.size + (query.trim() ? 1 : 0);

  const clearFilters = () => {
    setQuery("");
    setServices(new Set());
    setStatuses(new Set());
  };

  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;
    if (popupRef.current && map.hasLayer(popupRef.current)) {
      suppressCloseRef.current = true;
      map.closePopup();
    }
    setSelectedId(null);
    map.flyTo(homeRef.current, HOME_ZOOM, { duration: 0.9 });
  };

  /* ------------------------------------------------------
     Task 20 — PIN CLUSTERING. Greedy grouping in screen
     space: pins closer than CLUSTER_PX share one numbered
     glass orb. The selected pin and a briefing focus pin
     are always pulled out so they can never hide inside a
     cluster. Recomputed on zoom (distances change) and
     whenever the plotted set or selection changes.
     ------------------------------------------------------ */
  const recomputeClusters = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const pins = pinsRef.current;
    if (pins.length === 0) {
      setClusters([]);
      setSoloPins([]);
      return;
    }

    const forcedSolo = new Set<string>();
    if (selectedIdRef.current) forcedSolo.add(selectedIdRef.current);
    if (focusIdRef.current) forcedSolo.add(focusIdRef.current);

    const clusterable = pins.filter((p) => !forcedSolo.has(p.id));
    const projected = clusterable.map((pin) => ({
      pin,
      pt: map.latLngToContainerPoint(pin.latlng as [number, number]),
    }));

    const groups: { pts: { x: number; y: number }[]; pins: PlotPin[] }[] = [];
    for (const item of projected) {
      let best: (typeof groups)[number] | null = null;
      let bestD = Infinity;
      for (const g of groups) {
        let sx = 0;
        let sy = 0;
        for (const p of g.pts) {
          sx += p.x;
          sy += p.y;
        }
        const cx = sx / g.pts.length;
        const cy = sy / g.pts.length;
        const d = Math.hypot(cx - item.pt.x, cy - item.pt.y);
        if (d < bestD) {
          bestD = d;
          best = g;
        }
      }
      if (best && bestD <= CLUSTER_PX) {
        best.pts.push({ x: item.pt.x, y: item.pt.y });
        best.pins.push(item.pin);
      } else {
        groups.push({ pts: [{ x: item.pt.x, y: item.pt.y }], pins: [item.pin] });
      }
    }

    const nextClusters: PinCluster[] = [];
    const nextSolo: PlotPin[] = pins.filter((p) => forcedSolo.has(p.id));
    for (const g of groups) {
      if (g.pins.length < 2) {
        nextSolo.push(g.pins[0]);
        continue;
      }
      const lat = g.pins.reduce((s, p) => s + p.latlng[0], 0) / g.pins.length;
      const lng = g.pins.reduce((s, p) => s + p.latlng[1], 0) / g.pins.length;
      nextClusters.push({
        id: `cl:${g.pins[0].id}:${g.pins.length}`,
        latlng: [lat, lng],
        pins: g.pins,
      });
    }
    setClusters(nextClusters);
    setSoloPins(nextSolo);
  }, []);

  /* store actions are reachable from raw popup HTML via delegated clicks */
  const actionsRef = useRef({ openCase, openIncident });
  actionsRef.current = { openCase, openIncident };
  /* useT() returns a fresh closure per render — effects read the stable ref */
  const tRef = useRef(t);
  tRef.current = t;

  /* ------------------------------------------------------------
     Effect A — one-shot Leaflet lifecycle (create + full dispose).
     StrictMode-safe: the async import is guarded by a cancelled
     flag, every timer/listener is cleaned up, map.remove()
     disposes the instance and all layers.
     ------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false;
    let map: LeafletTypes.Map | null = null;
    let watchdog = 0;
    let settleRaf = 0;
    let settleTimer = 0;
    const counters = { google: 0, osm: 0, swapped: false };

    const onDomClick = (e: MouseEvent) => {
      /* a row inside a dead-end cluster list → select that pin (the
         recluster logic force-solos the selection and its popup opens) */
      const pinEl = (e.target as HTMLElement | null)?.closest?.("[data-sasi-pin]");
      if (pinEl) {
        const id = pinEl.getAttribute("data-sasi-pin");
        const pin = pinsRef.current.find((p) => p.id === id);
        if (pin) setSelectedId(pin.id);
        return;
      }
      const el = (e.target as HTMLElement | null)?.closest?.("[data-sasi-open]");
      if (!el) return;
      const kind = el.getAttribute("data-sasi-open");
      const ref = el.getAttribute("data-ref") ?? "";
      if (kind === "case" && ref) actionsRef.current.openCase(ref);
      else if (kind === "incident" && ref) actionsRef.current.openIncident(ref);
    };
    const onWinResize = () => map?.invalidateSize();
    const onPopupClose = () => {
      if (suppressCloseRef.current) {
        suppressCloseRef.current = false;
        return;
      }
      setSelectedId(null);
    };
    /* ArrowUp/ArrowDown walks the visible (solo) pins while the map
       is focused — the container is Leaflet's own keyboard target */
    const onContainerKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const pins = soloPinsRef.current;
      if (pins.length === 0 || !map) return;
      e.preventDefault();
      const idx = pins.findIndex((p) => p.id === selectedIdRef.current);
      const next =
        e.key === "ArrowDown"
          ? (idx + 1 + pins.length) % pins.length
          : (idx - 1 + pins.length) % pins.length;
      const pin = pins[next];
      setSelectedId(pin.id);
      map.panTo(pin.latlng, { animate: true, duration: 0.5 });
    };
    /* live centre readout — rAF-throttled so flyTo pans don't flood React */
    let viewRaf = 0;
    const onViewMove = () => {
      if (viewRaf || cancelled) return;
      viewRaf = requestAnimationFrame(() => {
        viewRaf = 0;
        if (cancelled || !map) return;
        const c = map.getCenter();
        setViewInfo({ lat: c.lat, lng: c.lng, z: map.getZoom() });
      });
    };

    containerRef.current?.addEventListener("click", onDomClick);
    containerRef.current?.addEventListener("keydown", onContainerKey);
    window.addEventListener("resize", onWinResize);

    void (async () => {
      let mod: { default?: typeof LeafletTypes } & typeof LeafletTypes;
      try {
        mod = (await import("leaflet")) as { default?: typeof LeafletTypes } & typeof LeafletTypes;
      } catch {
        if (!cancelled) setTileState("offline");
        return;
      }
      const L = mod.default ?? (mod as unknown as typeof LeafletTypes);
      if (cancelled || !containerRef.current) return;
      LRef.current = L;

      map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        minZoom: 7,
        maxZoom: 18,
        zoomSnap: 0.5,
        maxBounds: L.latLngBounds(CANVAS_BOUNDS).pad(0.35),
        maxBoundsViscosity: 0.8,
      });
      mapRef.current = map;

      /* initial camera: fit the user's content if any, else the province canvas */
      const initialPins = pinsRef.current;
      if (initialPins.length > 0) {
        const lats = [...initialPins.map((p) => p.latlng[0]), homeRef.current[0]];
        const lngs = [...initialPins.map((p) => p.latlng[1]), homeRef.current[1]];
        map.fitBounds(
          L.latLngBounds(
            [Math.min(...lats), Math.min(...lngs)],
            [Math.max(...lats), Math.max(...lngs)]
          ),
          { animate: false, padding: [48, 48], maxZoom: HOME_ZOOM }
        );
      } else {
        map.setView(svgToLatLng(53, 41), 10.5, { animate: false });
      }

      /* tiles — Google first, OSM fallback after repeated errors,
         honest offline note when nothing loads (watchdog). The
         imagery STYLE (Task 20) swaps the URL via setUrl later. */
      const tile = L.tileLayer(TILE_URLS["midnight"], {
        subdomains: "0123",
        minZoom: 7,
        maxZoom: 19,
      }).addTo(map);
      tileRef.current = tile;

      const onGoogleLoad = () => {
        counters.google = 0;
        window.clearTimeout(watchdog);
        setTileState("google");
      };
      const onOsmLoad = () => {
        counters.osm = 0;
        window.clearTimeout(watchdog);
        setTileState("osm");
      };
      const onOsmError = () => {
        counters.osm += 1;
        if (counters.osm >= 6) setTileState("offline");
      };
      const onGoogleError = () => {
        counters.google += 1;
        if (!counters.swapped && counters.google >= 4 && tileRef.current) {
          counters.swapped = true;
          tileRef.current.off("tileerror");
          tileRef.current.off("tileload");
          tileRef.current.setUrl(OSM_TILES);
          tileRef.current.on("tileerror", onOsmError);
          tileRef.current.on("tileload", onOsmLoad);
          setTileState("osm");
        }
      };

      tile.on("tileerror", onGoogleError);
      tile.on("tileload", onGoogleLoad);
      watchdog = window.setTimeout(() => {
        setTileState((s) => (s === "loading" ? "offline" : s));
      }, 9000);

      map.on("popupclose", onPopupClose);
      map.on("move", onViewMove);
      map.on("zoomend", recomputeClusters);
      onViewMove(); // seed the readout with the initial camera
      setMapReady(true);

      settleRaf = requestAnimationFrame(() => {
        map?.invalidateSize();
        recomputeClusters();
        settleTimer = window.setTimeout(() => {
          map?.invalidateSize();
          recomputeClusters();
        }, 280);
      });
    })().catch(() => {
      if (!cancelled) setTileState("offline");
    });

    return () => {
      cancelled = true;
      window.clearTimeout(watchdog);
      window.clearTimeout(settleTimer);
      if (settleRaf) cancelAnimationFrame(settleRaf);
      if (viewRaf) cancelAnimationFrame(viewRaf);
      window.removeEventListener("resize", onWinResize);
      containerRef.current?.removeEventListener("click", onDomClick);
      containerRef.current?.removeEventListener("keydown", onContainerKey);
      markersRef.current.clear();
      markerSelRef.current.clear();
      clusterMarkersRef.current.clear();
      popupRef.current = null;
      homeMarkerRef.current = null;
      tileRef.current = null;
      mapRef.current = null;
      LRef.current = null;
      setMapReady(false);
      map?.remove();
    };
  }, [recomputeClusters]);

  /* ------------------------------------------------------------
     Effect B — marker diff (add / move / restyle / remove) for
     the SOLO pins (those not absorbed into a cluster). Icons
     depend only on (kind, service, selected) so selection
     changes restyle just the affected markers.
     ------------------------------------------------------------ */
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!mapReady || !L || !map) return;

    const makeIcon = (pin: PlotPin, selected: boolean) =>
      L.divIcon({
        html: pinInnerHtml(SERVICE_GLYPH[pin.service] ?? SERVICE_GLYPH.other, pin.accent, {
          selected,
          mine: pin.kind === "case",
        }),
        className: "sasi-pin-wrap",
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -20],
      });

    const byId = new Map(soloPins.map((p) => [p.id, p]));

    for (const [id, marker] of markersRef.current) {
      if (!byId.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
        markerSelRef.current.delete(id);
      }
    }

    for (const pin of soloPins) {
      const selected = pin.id === selectedId;
      const existing = markersRef.current.get(pin.id);
      if (existing) {
        existing.setLatLng(pin.latlng);
        if ((markerSelRef.current.get(pin.id) ?? false) !== selected) {
          existing.setIcon(makeIcon(pin, selected));
          markerSelRef.current.set(pin.id, selected);
        }
        existing.setZIndexOffset(selected ? 1000 : 0);
      } else {
        const marker = L.marker(pin.latlng, { icon: makeIcon(pin, selected), riseOnHover: true, keyboard: true });
        marker.bindTooltip(pin.ref, {
          className: "sasi-tip",
          direction: "top",
          offset: [0, -18],
          opacity: 1,
        });
        marker.on("click", () => setSelectedId(pin.id));
        marker.addTo(map);
        const el = marker.getElement();
        if (el) {
          el.setAttribute("role", "button");
          el.setAttribute(
            "aria-label",
            `${pin.kind === "case" ? "Your report marker" : "Incident marker"} ${pin.ref} — ${pin.title}`
          );
        }
        markersRef.current.set(pin.id, marker);
        markerSelRef.current.set(pin.id, selected);
      }
    }
  }, [mapReady, soloPins, selectedId]);

  /* ------------------------------------------------------------
     Effect B2 — recluster whenever the plotted set, selection or
     a briefing focus target changes (zoom changes flow through
     the zoomend listener wired in Effect A).
     ------------------------------------------------------------ */
  useEffect(() => {
    if (!mapReady) return;
    recomputeClusters();
  }, [mapReady, recomputeClusters, plotPins, selectedId, focusPin]);

  /* ------------------------------------------------------------
     Effect B3 — cluster marker diff (add / move / remove the
     numbered glass orbs; a click flies out to the members).
     ------------------------------------------------------------ */
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!mapReady || !L || !map) return;

    const byId = new Map(clusters.map((c) => [c.id, c]));
    for (const [id, marker] of clusterMarkersRef.current) {
      if (!byId.has(id)) {
        marker.remove();
        clusterMarkersRef.current.delete(id);
      }
    }

    for (const c of clusters) {
      const existing = clusterMarkersRef.current.get(c.id);
      if (existing) {
        existing.setLatLng(c.latlng);
        continue;
      }
      const marker = L.marker(c.latlng, {
        icon: L.divIcon({
          html: clusterInnerHtml(c.pins.length),
          className: "sasi-cluster-wrap",
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        }),
        riseOnHover: true,
        keyboard: true,
      });
      marker.on("click", () => {
        const bounds = L.latLngBounds(c.pins.map((p) => p.latlng));
        const fitZoom = map.getBoundsZoom(bounds.pad(0.4));
        if (fitZoom <= 16) {
          /* zooming separates the members — fly out and let them breathe */
          map.flyToBounds(bounds.pad(0.4), { duration: 0.8, maxZoom: 16 });
          return;
        }
        /* dead end: members would never leave the same pixels (jitter
           collisions) — list them instead; a row click force-solos that pin */
        const popup =
          popupRef.current ??
          (popupRef.current = L.popup({
            className: "sasi-leaflet-popup",
            closeButton: true,
            maxWidth: 278,
            minWidth: 240,
            autoPanPadding: [18, 18],
            offset: [0, -4],
          }));
        popup.setContent(clusterListHtml(c.pins));
        popup.setLatLng(c.latlng);
        if (!map.hasLayer(popup)) popup.openOn(map);
      });
      marker.addTo(map);
      const el = marker.getElement();
      if (el) {
        el.setAttribute("role", "button");
        el.setAttribute(
          "aria-label",
          `Cluster of ${c.pins.length} nearby pins — zoom in to expand`
        );
      }
      clusterMarkersRef.current.set(c.id, marker);
    }
  }, [mapReady, clusters]);

  /* ------------------------------------------------------------
     Effect B4 — imagery style: swap the tile URL, keep the same
     layer (and its error/fallback listeners) alive.
     ------------------------------------------------------------ */
  useEffect(() => {
    const tile = tileRef.current;
    if (!mapReady || !tile) return;
    tile.setUrl(TILE_URLS[mapStyle]);
  }, [mapReady, mapStyle]);

  /* close the style popover on any outside click */
  useEffect(() => {
    if (!styleOpen) return;
    const close = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("[data-sasi-style-pop]")) return;
      setStyleOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [styleOpen]);

  /* ------------------------------------------------------------
     Effect C — selection popup (one reused glass popup).
     ------------------------------------------------------------ */
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!mapReady || !L || !map) return;

    const closeQuietly = () => {
      if (popupRef.current && map.hasLayer(popupRef.current)) {
        suppressCloseRef.current = true;
        map.closePopup();
      }
    };

    const pin = selectedId ? plotPins.find((p) => p.id === selectedId) : null;
    if (!pin) {
      closeQuietly();
      return;
    }

    const popup =
      popupRef.current ??
      (popupRef.current = L.popup({
        className: "sasi-leaflet-popup",
        closeButton: true,
        maxWidth: 278,
        minWidth: 240,
        autoPanPadding: [18, 18],
        offset: [0, -4],
      }));
    const html = popupHtml(
      pin,
      tRef.current("map.your-report-tag"),
      pin.kind === "case" ? tRef.current("map.open-case") : tRef.current("map.open-incident")
    );
    if (popup.getContent() !== html) popup.setContent(html);
    popup.setLatLng(pin.latlng);
    if (!map.hasLayer(popup)) popup.openOn(map);
  }, [mapReady, selectedId, plotPins]);

  /* ------------------------------------------------------------
     Effect D — focus deep-link (CASE-/INC-): smooth flyTo at a
     useful zoom, then highlight + open the popup on arrival.
     ------------------------------------------------------------ */
  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || !mapFocusRef) return;
    const pin = focusPin;
    if (!pin) return;

    let cancelled = false;
    let fallback = 0;
    const arrive = () => {
      if (!cancelled) setSelectedId(pin.id);
    };

    if (popupRef.current && map.hasLayer(popupRef.current)) {
      suppressCloseRef.current = true;
      map.closePopup();
    }
    setSelectedId(null);
    if (map.getCenter().distanceTo(pin.latlng) > 60) {
      map.flyTo(pin.latlng, FOCUS_ZOOM, { duration: 1.15 });
      map.once("moveend", arrive);
      fallback = window.setTimeout(arrive, 1700);
    } else {
      map.setView(pin.latlng, FOCUS_ZOOM, { animate: true });
      arrive();
    }

    return () => {
      cancelled = true;
      window.clearTimeout(fallback);
    };
  }, [mapReady, mapFocusRef, focusPin]);

  /* ------------------------------------------------------------
     Effect E — "you are here" home marker (non-interactive).
     ------------------------------------------------------------ */
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!mapReady || !L || !map) return;
    if (!homeMarkerRef.current) {
      homeMarkerRef.current = L.marker(homeRef.current, {
        icon: L.divIcon({
          html: homeInnerHtml(tRef.current("map.you-are-here")),
          className: "sasi-home-wrap",
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
        interactive: false,
        zIndexOffset: -1000,
      }).addTo(map);
    } else {
      homeMarkerRef.current.setLatLng(homeRef.current);
      const label = homeMarkerRef.current.getElement()?.querySelector(".sasi-home-label");
      if (label) label.textContent = tRef.current("map.you-are-here");
    }
  }, [mapReady, homeLatLng]);

  /* ------------------------------------------------------------
     Effect F — geolocation lifecycle guard. Geolocation callbacks
     can outlive this component, so every one of them checks
     geoDisposedRef (same pattern as Effect A's cancelled flag) —
     StrictMode's double-mount can never touch a dead map.
     ------------------------------------------------------------ */
  useEffect(() => {
    geoDisposedRef.current = false;
    return () => {
      geoDisposedRef.current = true;
      if (watchIdRef.current !== null && "geolocation" in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
      /* the layers die with the map instance (map.remove()); drop the refs */
      geoMarkerRef.current = null;
      geoCircleRef.current = null;
    };
  }, []);

  /* ------------------------------------------------------------
     Effect G — place / sync / remove the real-location pulsing
     dot + honest accuracy ring. Re-runs on mapReady so a
     StrictMode remount (fresh map instance) re-anchors the last
     real fix — it never invents one.
     ------------------------------------------------------------ */
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!mapReady || !L || !map) return;

    if (geoPhase === "idle") {
      geoMarkerRef.current?.remove();
      geoMarkerRef.current = null;
      geoCircleRef.current?.remove();
      geoCircleRef.current = null;
      return;
    }

    const fix = geoFixRef.current;
    if (!fix) return;

    if (!geoCircleRef.current) {
      geoCircleRef.current = L.circle([fix.lat, fix.lng], {
        radius: Math.max(fix.accuracy, 8),
        color: "#64b5f6",
        weight: 1,
        opacity: 0.35,
        fillColor: "#64b5f6",
        fillOpacity: 0.08,
      }).addTo(map);
    } else {
      geoCircleRef.current.setLatLng([fix.lat, fix.lng]);
      geoCircleRef.current.setRadius(Math.max(fix.accuracy, 8));
    }

    if (!geoMarkerRef.current) {
      geoMarkerRef.current = L.marker([fix.lat, fix.lng], {
        icon: L.divIcon({
          html:
            '<div class="sasi-geo-wrap" aria-hidden="true">' +
            '<span class="sasi-geo-pulse"></span>' +
            '<span class="sasi-geo-core"></span>' +
            "</div>",
          className: "sasi-geo-marker",
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
        interactive: false,
        zIndexOffset: 500,
      }).addTo(map);
    } else {
      geoMarkerRef.current.setLatLng([fix.lat, fix.lng]);
    }
  }, [mapReady, geoPhase]);

  /* ------------------------------------------------------------
     Effect H — follow mode: continuous watchPosition. Cleanup
     ALWAYS clears the watch (toggle-off, error, unmount,
     StrictMode re-run). Position updates are imperative, in the
     same style as Effect B's marker diff.
     ------------------------------------------------------------ */
  useEffect(() => {
    if (geoPhase !== "following") return;
    if (!("geolocation" in navigator)) {
      setGeoPhase(geoFixRef.current ? "fixed" : "idle");
      setGeoError("unavailable");
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (geoDisposedRef.current) return;
        const fix: GeoFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        geoFixRef.current = fix;
        geoMarkerRef.current?.setLatLng([fix.lat, fix.lng]);
        geoCircleRef.current?.setLatLng([fix.lat, fix.lng]);
        geoCircleRef.current?.setRadius(Math.max(fix.accuracy, 8));
        const map = mapRef.current;
        if (map && map.getCenter().distanceTo([fix.lat, fix.lng]) > GEO_FOLLOW_PAN_M) {
          map.panTo([fix.lat, fix.lng], { animate: true, duration: 0.75 });
        }
      },
      (err) => {
        if (geoDisposedRef.current) return;
        /* honest stop: the last real fix may stay, but SASI stops claiming to follow */
        setGeoPhase(geoFixRef.current ? "fixed" : "idle");
        setGeoError(isGeoErrorDenied(err) ? "denied" : "unavailable");
      },
      GEO_POSITION_OPTS
    );
    watchIdRef.current = watchId;
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    };
  }, [geoPhase]);

  /* ---- "Locate me" — one honest device fix, then optional follow ---- */
  const handleLocate = () => {
    if (geoPhase === "following") {
      /* follow OFF: the watch is cleared by Effect H's cleanup and the
         dot + accuracy ring are removed by Effect G */
      setGeoPhase("idle");
      return;
    }
    if (geoPhase === "fixed") {
      /* follow ON: switch to continuous watchPosition from the existing fix */
      setGeoError(null);
      setGeoPhase("following");
      return;
    }
    if (geoPhase === "locating") return;

    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError("unavailable");
      return;
    }
    setGeoPhase("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (geoDisposedRef.current) return;
        const fix: GeoFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        geoFixRef.current = fix; // the only position SASI ever shows — the real one
        setGeoPhase("fixed");
        mapRef.current?.flyTo([fix.lat, fix.lng], GEO_ZOOM, { duration: 1.2 });
      },
      (err) => {
        if (geoDisposedRef.current) return;
        setGeoPhase(geoFixRef.current ? "fixed" : "idle");
        setGeoError(isGeoErrorDenied(err) ? "denied" : "unavailable");
      },
      GEO_POSITION_OPTS
    );
  };

  const locateAria =
    geoPhase === "following"
      ? "Following my location — click to stop"
      : geoPhase === "locating"
        ? "Finding your location"
        : "Center map on my location";
  const locateTitle =
    geoPhase === "following"
      ? "Following — click to stop"
      : geoPhase === "fixed"
        ? "Follow my location"
        : "Center map on my location";

  /* pin directory row click — fly to the pin and open its popup */
  const focusPinFromList = (pin: PlotPin) => {
    const map = mapRef.current;
    if (!map) return;
    setSelectedId(pin.id);
    map.flyTo(pin.latlng, FOCUS_ZOOM, { duration: 0.9 });
  };

  /* live readout formatting: 26.1075° S · 28.0567° E · Z12.5 */
  const fmtHemi = (v: number, pos: string, neg: string) =>
    `${Math.abs(v).toFixed(4)}° ${v >= 0 ? pos : neg}`;

  const STYLE_ICON: Record<MapStyleKey, typeof Moon> = {
    midnight: Moon,
    satellite: Satellite,
    hybrid: MapIcon,
  };

  /* honest legend — only entries that can actually appear */
  const legendServices = useMemo(() => {
    const order: ServiceKey[] = [];
    const seen = new Set<string>();
    const push = (s: ServiceKey) => {
      if (!seen.has(s)) {
        seen.add(s);
        order.push(s);
      }
    };
    INCIDENTS.forEach((i) => push(i.service));
    userCases.forEach((c) => push(c.service));
    return order;
  }, [userCases]);
  const LEGEND_MAX = 6;
  const legendOverflow = Math.max(0, legendServices.length - LEGEND_MAX);
  const legendShown = legendServices.slice(0, LEGEND_MAX);

  const filtersNode = hasIncidents ? (
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
  ) : null;

  const legendChips = (
    <>
      {legendShown.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
          <span
            className="h-2 w-2 rounded-full border border-white/20"
            style={{ backgroundColor: SERVICE_ACCENT[s] }}
            aria-hidden
          />
          {SERVICES[s].label}
        </span>
      ))}
      {legendOverflow > 0 && (
        <span className="font-mono text-[10px] text-zinc-600">+{legendOverflow}</span>
      )}
      <span className="inline-flex items-center gap-1.5 text-[11px] text-[#e3c567]">
        <span
          className="h-2 w-2 rounded-full border border-[#e3c567]/60"
          style={{ backgroundColor: "transparent" }}
          aria-hidden
        />
        {t("map.your-reports")}
      </span>
    </>
  );

  return (
    <div className="relative -mb-24 h-[calc(100dvh-3.5rem)] w-full overflow-hidden bg-[#0a0b0d] lg:-mb-8">
      <style>{SASI_MAP_CSS}</style>
      <style>{SASI_GEO_CSS}</style>

      {/* Leaflet root — tiles below, markers/popup above, all chrome custom */}
      <div
        ref={containerRef}
        data-tiles={tileState}
        data-style={mapStyle}
        className="sasi-leaflet-root absolute inset-0 z-0"
        role="application"
        aria-label="Service intelligence map of Gauteng with your reports and service incidents"
      />

      {/* edge vignette (above tiles, below chrome) */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{ background: "radial-gradient(ellipse at 50% 42%, transparent 45%, rgba(0,0,0,0.5) 100%)" }}
        aria-hidden
      />
      {/* stylised grid only while real imagery is absent (offline/loading) */}
      {(tileState === "offline" || tileState === "loading") && (
        <div className="sasi-grid-bg pointer-events-none absolute inset-0 z-[1] opacity-40" aria-hidden />
      )}

      {/* briefing focus banner — honest origin, one-click clear, miss state */}
      {mapFocusRef && (focusPin || focusMissed) && (
        <div className="sasi-pop absolute left-1/2 top-4 z-20 -translate-x-1/2">
          <div className="sasi-map-focus flex items-center gap-2 rounded-full border py-1.5 pl-3 pr-1.5">
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                focusPin ? "bg-[#e3c567] sasi-breathe" : "bg-zinc-500"
              )}
              aria-hidden
            />
            <p className="whitespace-nowrap text-[11.5px] text-[#efe0a8]">
              <span className="font-medium">{focusPin?.ref ?? mapFocusRef}</span>
              <span className="hidden sm:inline">
                {" "}
                ·{" "}
                {focusCase
                  ? t("map.your-report-tag")
                  : focusIncident
                    ? t("map.from-briefing")
                    : "no longer on the map"}
              </span>
            </p>
            <button
              onClick={clearMapFocus}
              className="flex h-6 items-center gap-1 rounded-full border border-[#e3c567]/25 px-2 text-[10.5px] font-medium text-[#efe0a8] transition-colors hover:border-[#e3c567]/50 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e3c567]/60"
              aria-label="Clear map focus"
            >
              <X className="h-3 w-3" aria-hidden />
              {t("map.clear")}
            </button>
          </div>
        </div>
      )}

      {/* desktop — floating filter panel (only when incidents exist to filter) */}
      {hasIncidents && (
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
      )}

      {/* desktop — live pin directory (replaces the old static hint;
          hidden while a popup is open so autopan owns the room) */}
      {!universeEmpty && (
        <div
          className={cn(
            "absolute right-4 top-4 z-10 hidden w-72 lg:block",
            selectedId && "lg:hidden"
          )}
        >
          <div className="sasi-card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 px-3.5 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                Plotted pins
              </p>
              <span className="font-mono text-[10px] tracking-[0.12em] text-zinc-600">
                {plotPins.length}
              </span>
            </div>
            <div className="sasi-scroll max-h-[42vh] overflow-y-auto p-1.5" role="list">
              {directoryPins.map((pin) => {
                return (
                  <button
                    key={pin.id}
                    type="button"
                    role="listitem"
                    onClick={() => focusPinFromList(pin)}
                    className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/30"
                    aria-label={`${pin.kind === "case" ? "Your report" : "Incident"} ${pin.ref} — ${pin.title}. Fly to pin.`}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] transition-colors group-hover:border-white/25"
                      style={{ color: pin.accent }}
                      aria-hidden
                    >
                      <ServiceIcon service={pin.service} className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-medium text-zinc-200 group-hover:text-white">
                        {pin.title}
                      </span>
                      <span className="block font-mono text-[9.5px] tracking-[0.12em] text-zinc-600">
                        {pin.ref} · {fmtDistance(haversineM(homeLatLng, pin.latlng))}
                      </span>
                    </span>
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: pin.accent }}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
            <p className="border-t border-white/5 px-3.5 py-2 font-mono text-[9px] tracking-[0.12em] text-zinc-700">
              Nearest to your saved location · ↑↓ cycles pins
            </p>
          </div>
        </div>
      )}

      {/* live centre readout lives INSIDE the legend strip (Task 20):
          bottom-left is the map's console line, so telemetry joins it
          instead of fighting it for bottom-centre space */}

      {/* desktop — honest legend + attribution */}
      {!universeEmpty && (
        <div className="absolute bottom-4 left-4 z-10 hidden max-w-[calc(100%-26rem)] lg:block">
          <div className="sasi-card flex flex-wrap items-center gap-x-3.5 gap-y-1.5 px-3.5 py-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
              {t("map.service")}
            </span>
            {legendChips}
            <span className="border-l border-white/8 pl-3 font-mono text-[9px] tracking-[0.12em] text-zinc-700">
              {attributionLine(tileState)}
            </span>
            {hasIncidents && (
              <span className="border-l border-white/8 pl-3 font-mono text-[9px] tracking-[0.14em] text-zinc-700">
                DEMO DATA
              </span>
            )}
            {viewInfo && (
              <span
                className="border-l border-white/8 pl-3 font-mono text-[9px] tabular-nums tracking-[0.12em] text-zinc-500"
                aria-hidden
              >
                {fmtHemi(viewInfo.lat, "N", "S")} · {fmtHemi(viewInfo.lng, "E", "W")} · Z
                {viewInfo.z.toFixed(1)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* map control cluster — glass pill (zoom · saved-location recenter ·
          real-device "Locate me"), 44px touch targets, tucked under the
          mobile filter chip / bottom-right on desktop */}
      <div className="absolute right-4 top-16 z-20 flex flex-col items-end gap-2 lg:bottom-4 lg:right-4 lg:top-auto">
        {/* follow-mode live tag */}
        {geoPhase === "following" && (
          <div
            role="status"
            className="flex items-center gap-1.5 rounded-full border border-[#64b5f6]/30 bg-black/70 px-2.5 py-1 backdrop-blur"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#64b5f6] sasi-breathe" aria-hidden />
            <span className="font-mono text-[9.5px] font-medium uppercase tracking-[0.14em] text-[#a8d4f8]">
              Following
            </span>
          </div>
        )}

        {/* honest geolocation notice — SASI never fakes a position */}
        {geoError && (
          <div
            role="status"
            className="w-60 rounded-xl border border-white/12 bg-black/80 p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur"
          >
            <div className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                  geoError === "denied" ? "bg-[#ef5350]" : "bg-[#e3c567]"
                )}
                aria-hidden
              />
              <p className="text-[11px] leading-relaxed text-zinc-300">
                {geoError === "denied"
                  ? "Location permission was denied — SASI can't center on you until it's allowed in the browser."
                  : "Your location is unavailable right now."}
              </p>
              <button
                type="button"
                onClick={() => setGeoError(null)}
                aria-label="Dismiss location notice"
                className="-m-1 ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-zinc-500 transition-colors hover:text-white"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* permanent honesty microcopy for the locate control */}
          <p
            className="max-w-[9rem] text-right text-[10px] leading-tight text-zinc-500"
            style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
          >
            Location is used only on this device.
          </p>

          <div
            role="group"
            aria-label="Map view controls"
            className="flex flex-col items-center gap-1 rounded-full border border-white/12 bg-gradient-to-b from-white/[0.06] to-white/[0.02] px-1 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.45)] backdrop-blur-md"
          >
            <button
              type="button"
              onClick={() => mapRef.current?.zoomIn()}
              aria-label="Zoom in"
              className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/40"
            >
              <Plus className="h-4.5 w-4.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => mapRef.current?.zoomOut()}
              aria-label="Zoom out"
              className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/40"
            >
              <Minus className="h-4.5 w-4.5" aria-hidden />
            </button>
            <div className="h-px w-6 bg-white/10" aria-hidden />
            <button
              type="button"
              onClick={recenter}
              aria-label="Recenter on your saved location"
              className="flex h-11 w-11 items-center justify-center rounded-full text-zinc-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/40"
            >
              <Crosshair className="h-4.5 w-4.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={handleLocate}
              aria-label={locateAria}
              aria-pressed={geoPhase === "following"}
              title={locateTitle}
              className={cn(
                "sasi-btn-glass sasi-geo-btn mt-0.5 flex h-11 w-11 items-center justify-center rounded-full text-zinc-100",
                geoPhase === "following" && "sasi-geo-following",
                geoPhase === "locating" && "sasi-geo-locating"
              )}
            >
              <LocateFixed className="h-4.5 w-4.5" aria-hidden />
            </button>
            <div className="h-px w-6 bg-white/10" aria-hidden />
            {/* imagery style — layers button + glass popover (Task 20) */}
            <div className="relative" data-sasi-style-pop>
              <button
                type="button"
                onClick={() => setStyleOpen((o) => !o)}
                aria-expanded={styleOpen}
                aria-haspopup="menu"
                aria-label={`Map imagery style — currently ${MAP_STYLE_LABEL[mapStyle]}`}
                title="Map imagery style"
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-white/40",
                  styleOpen ? "bg-white/10 text-white" : "text-zinc-200"
                )}
              >
                <Layers className="h-4.5 w-4.5" aria-hidden />
              </button>
              {styleOpen && (
                <div
                  role="menu"
                  aria-label="Map imagery style"
                  className="absolute bottom-0 right-[calc(100%+10px)] w-44 rounded-xl border border-white/12 bg-[#0b0c0e]/95 p-1.5 shadow-[0_16px_44px_rgba(0,0,0,0.6)] backdrop-blur-md"
                >
                  {(Object.keys(TILE_URLS) as MapStyleKey[]).map((k) => {
                    const Icon = STYLE_ICON[k];
                    const active = mapStyle === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        role="menuitemradio"
                        aria-checked={active}
                        onClick={() => {
                          setMapStyle(k);
                          setStyleOpen(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium transition-colors",
                          active
                            ? "bg-white/10 text-white"
                            : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="flex-1">{MAP_STYLE_LABEL[k]}</span>
                        {active && <Check className="h-3.5 w-3.5 text-[#e3c567]" aria-hidden />}
                      </button>
                    );
                  })}
                  <p className="border-t border-white/8 px-2.5 pb-1 pt-1.5 font-mono text-[8.5px] tracking-[0.12em] text-zinc-600">
                    IMAGERY © GOOGLE
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* empty state — the honest overlay when there is nothing to plot */}
      {universeEmpty && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="sasi-card pointer-events-auto w-full max-w-sm p-6 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03]">
              <MapPinned className="h-5 w-5 text-zinc-400" aria-hidden />
            </span>
            <h2 className="sasi-serif mt-3 text-[22px] leading-snug text-white">
              Nothing plotted yet
            </h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-zinc-400">
              Your reports appear here once you create them — SASI never invents map data.
            </p>
            <button
              type="button"
              onClick={() => navigate("report")}
              className="sasi-btn-glass mt-4 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-[13px] font-medium text-white"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Report an issue
            </button>
            <p className="mt-4 font-mono text-[9px] tracking-[0.12em] text-zinc-700">
              {attributionLine(tileState)}
            </p>
          </div>
        </div>
      )}

      {/* offline note — honest imagery status; markers keep working */}
      {tileState === "offline" && !universeEmpty && (
        <div className="pointer-events-none absolute inset-x-0 bottom-20 z-10 flex justify-center px-4 lg:bottom-16">
          <div className="sasi-card flex items-center gap-2 px-3 py-2">
            <WifiOff className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
            <p className="text-[11px] text-zinc-400">
              Live map imagery unavailable — markers and coordinates still work.
            </p>
          </div>
        </div>
      )}

      {/* filtered-to-nothing hint (only possible while demo incidents exist) */}
      {hasIncidents && filtered.length === 0 && (
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

      {/* mobile — filter button (44px touch target; only when incidents exist) */}
      {hasIncidents && (
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
      )}

      {/* mobile — filters drawer */}
      {hasIncidents && (
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
              <div className="flex flex-wrap items-center gap-3">
                {legendChips}
                <span className="font-mono text-[9px] tracking-[0.12em] text-zinc-700">
                  {attributionLine(tileState)}
                  {hasIncidents ? " · DEMO DATA" : ""}
                </span>
              </div>
            </div>
            <DrawerFooter className="pt-1">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="sasi-btn-white-glass flex h-11 w-full items-center justify-center rounded-xl text-[13px] font-medium text-white"
                aria-label="Show filtered incidents on map"
              >
                {filtered.length === 1
                  ? t("map.show-one")
                  : t("map.show-many").replace("{n}", String(filtered.length))}
              </button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}
