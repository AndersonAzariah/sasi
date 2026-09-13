import { NextRequest, NextResponse } from "next/server";

import {
  clientIp,
  rateLimitService,
  tooManyRequests,
} from "@/lib/sasi/api-auth";
import { getAIProvider } from "@/lib/ai";
import { ADDRESS_REFINEMENT_PROMPT as SYSTEM_PROMPT } from "@/lib/ai/prompts";

/* ============================================================
   SASI GEO ENRICH (Task 21)
   Super-accurate report locations = device GPS + two free
   intelligence layers:
     1. OpenStreetMap Nominatim reverse geocode (keyless, free)
        → structured address at the exact coordinates.
     2. OpenRouter FREE model refinement → corrects/normalises
        the address for South African localities (suburbs,
        townships, province sanity-check), adds a landmark and
        an honest confidence grade. The AI is NEVER allowed to
        invent a street that OSM did not report.
   Graceful degradation: AI down → OSM only. Both down →
   formatted coordinates so the flow never dies.
   ============================================================ */

export const dynamic = "force-dynamic";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";

/** tiny TTL cache keyed by ~11 m grid cells (4 decimals) */
const CACHE = new Map<string, { at: number; payload: unknown }>();
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 200;

interface GeoBody {
  lat?: number;
  lng?: number;
  accuracyM?: number;
  hint?: string;
}

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- layer 1: Nominatim ---------- */

interface NominatimResult {
  display_name?: string;
  address?: Record<string, string>;
  error?: string;
}

async function nominatimReverse(lat: number, lng: number) {
  const url = `${NOMINATIM_URL}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
  const data = (await fetchJson(
    url,
    {
      headers: {
        "User-Agent": "SASI/1.0 (civic service intelligence; demo)",
        Accept: "application/json",
      },
    },
    7000
  )) as NominatimResult;
  if (!data || data.error) throw new Error(data?.error ?? "nominatim empty");
  return data;
}

/* ---------- layer 2: OpenRouter free models ---------- */

interface AiAddress {
  streetAddress?: string;
  suburb?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  oneLine?: string;
  landmark?: string;
  confidence?: string;
  notes?: string;
}

function buildUserPrompt(
  lat: number,
  lng: number,
  accuracyM: number | undefined,
  osm: NominatimResult,
  hint?: string
): string {
  return [
    `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}${
      accuracyM ? ` (device accuracy ±${Math.round(accuracyM)} m)` : ""
    }`,
    hint ? `Reporter hint typed by the user: "${hint}"` : "",
    `OpenStreetMap reverse geocode: ${JSON.stringify({
      display_name: osm.display_name,
      address: osm.address,
    })}`,
    hint
      ? "\nUse the hint only to disambiguate between plausible addresses; never let it override the coordinates."
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function extractJson(text: string): AiAddress | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return typeof parsed === "object" && parsed ? (parsed as AiAddress) : null;
  } catch {
    return null;
  }
}

async function openRouterRefine(
  lat: number,
  lng: number,
  accuracyM: number | undefined,
  osm: NominatimResult,
  hint?: string
): Promise<AiAddress | null> {
  const provider = getAIProvider();
  if (!provider.isConfigured()) return null;

  try {
    const completion = await provider.complete({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(lat, lng, accuracyM, osm, hint) },
      ],
      temperature: 0.1,
      maxTokens: 500,
      timeoutMs: 14_000,
    });
    return extractJson(completion.text);
  } catch {
    /* AI refinement unavailable — the route degrades to OSM-only honestly */
    return null;
  }
}

/* ---------- layer 3: coords-only fallback ---------- */

function dms(value: number, pos: string, neg: string): string {
  const hemi = value >= 0 ? pos : neg;
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const min = Math.floor((abs - deg) * 60);
  const sec = Math.round(((abs - deg) * 60 - min) * 60);
  return `${deg}°${min}'${sec}"${hemi}`;
}

/* ---------- route ---------- */

export async function POST(req: NextRequest) {
  /* Nominatim's usage policy requires lightweight clients — 30/min per
     caller protects that relationship and the OSM/OpenRouter spend. */
  const limit = await rateLimitService.limit(
    `geo-enrich:${clientIp(req)}`,
    30,
    60_000
  );
  if (!limit.allowed) {
    return tooManyRequests(
      limit.retryAfterMs,
      "Too many location lookups in a minute. Please wait a moment."
    );
  }

  let body: GeoBody;
  try {
    body = (await req.json()) as GeoBody;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid-json" }, { status: 400 });
  }

  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return NextResponse.json({ ok: false, reason: "invalid-coords" }, { status: 400 });
  }
  const accuracyM = Number.isFinite(Number(body.accuracyM))
    ? Number(body.accuracyM)
    : undefined;
  const hint = typeof body.hint === "string" ? body.hint.slice(0, 120) : undefined;

  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json({ ...(cached.payload as object), cached: true });
  }

  /* ---- layer 1: OSM ---- */
  let osm: NominatimResult | null = null;
  try {
    osm = await nominatimReverse(lat, lng);
  } catch {
    osm = null;
  }

  /* ---- layer 2: AI refinement (only if OSM gave us something) ---- */
  let ai: AiAddress | null = null;
  if (osm) {
    ai = await openRouterRefine(lat, lng, accuracyM, osm, hint);
  }

  /* ---- compose ---- */
  const coordLine = `${lat.toFixed(6)}°, ${lng.toFixed(6)}° (${dms(
    lat,
    "N",
    "S"
  )}, ${dms(lng, "E", "W")})`;

  let payload;
  if (ai) {
    const oneLine =
      ai.oneLine?.trim() ||
      [ai.streetAddress, ai.suburb, ai.city, ai.postalCode, ai.province]
        .filter(Boolean)
        .join(", ") ||
      coordLine;
    payload = {
      ok: true,
      source: "ai",
      location: oneLine,
      parts: {
        street: ai.streetAddress ?? "",
        suburb: ai.suburb ?? "",
        city: ai.city ?? "",
        province: ai.province ?? "",
        postalCode: ai.postalCode ?? "",
        landmark: ai.landmark ?? "",
      },
      confidence: ai.confidence ?? "medium",
      notes: ai.notes ?? "",
      osmDisplayName: osm?.display_name ?? "",
      precision: {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        accuracyM: accuracyM ? Math.round(accuracyM) : null,
        coordLine,
      },
    };
  } else if (osm) {
    payload = {
      ok: true,
      source: "osm",
      location: osm.display_name ?? coordLine,
      parts: {
        street: osm.address?.road ?? "",
        suburb:
          osm.address?.suburb ??
          osm.address?.neighbourhood ??
          osm.address?.township ??
          "",
        city: osm.address?.city ?? osm.address?.town ?? "",
        province: osm.address?.state ?? "",
        postalCode: osm.address?.postcode ?? "",
        landmark: "",
      },
      confidence: osm.address?.road ? "medium" : "low",
      notes: "Verified against OpenStreetMap at your exact coordinates. AI refinement unavailable right now.",
      precision: {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        accuracyM: accuracyM ? Math.round(accuracyM) : null,
        coordLine,
      },
    };
  } else {
    payload = {
      ok: true,
      source: "coords",
      location: coordLine,
      parts: {
        street: "",
        suburb: "",
        city: "",
        province: "",
        postalCode: "",
        landmark: "",
      },
      confidence: "low",
      notes:
        "Address lookup is unavailable right now — the exact GPS coordinates have been recorded instead.",
      precision: {
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
        accuracyM: accuracyM ? Math.round(accuracyM) : null,
        coordLine,
      },
    };
  }

  CACHE.set(cacheKey, { at: Date.now(), payload });
  if (CACHE.size > CACHE_MAX) {
    const oldest = CACHE.keys().next().value;
    if (oldest) CACHE.delete(oldest);
  }

  return NextResponse.json(payload);
}
