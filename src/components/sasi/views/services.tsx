"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  MessageSquarePlus,
  Search,
  X,
} from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { INCIDENTS, POPULAR_SERVICES } from "@/lib/sasi/data";
import { SERVICES } from "@/lib/sasi/utils";
import type { ServiceKey } from "@/lib/sasi/types";
import {
  EmptyState,
  PrimaryButton,
  SectionLabel,
  ServiceIcon,
  SERVICE_TINT,
} from "@/components/sasi/primitives";
import { cn } from "@/lib/utils";

/* Extra search keywords per service (label + blurb are always searched) */
const SERVICE_KEYWORDS: Record<ServiceKey, string> = {
  water: "water outage leak pressure tap reservoir burst pipe dry",
  electricity: "power outage streetlight prepaid meter connection cable load shedding",
  roads: "pothole road damage signage traffic street sinkhole",
  waste: "rubbish garbage refuse collection dumping bin litter cleaning",
  healthcare: "clinic hospital medicine appointment ambulance health",
  education: "school placement transport teacher fees learner",
  housing: "rdp house settlement tenure application eviction",
  documents: "id identity licence license certificate home affairs passport birth",
  safety: "crime emergency police safety neighbourhood neighborhood",
  "local-government": "councillor ward billing rates municipal account tender",
  other: "other anything else general",
};

const SERVICE_KEYS = Object.keys(SERVICES) as ServiceKey[];

export default function ServicesView() {
  const navigate = useSasiStore((s) => s.navigate);
  const openService = useSasiStore((s) => s.openService);
  const [query, setQuery] = useState("");

  const incidentCounts = useMemo(() => {
    const counts: Partial<Record<ServiceKey, number>> = {};
    for (const inc of INCIDENTS) {
      counts[inc.service] = (counts[inc.service] ?? 0) + 1;
    }
    return counts;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SERVICE_KEYS;
    return SERVICE_KEYS.filter((key) => {
      const meta = SERVICES[key];
      const haystack = `${meta.label} ${meta.blurb} ${SERVICE_KEYWORDS[key]}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      {/* ---------- Hero ---------- */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        aria-labelledby="services-hero-heading"
      >
        <h1
          id="services-hero-heading"
          className="text-2xl font-semibold tracking-tight text-white sm:text-3xl"
        >
          Find the service you need.
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-zinc-400">
          SASI organizes South African public services around problems — not departments.
        </p>

        {/* Search */}
        <div
          className={cn(
            "sasi-command-focus mt-6 flex h-12 w-full max-w-2xl items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 transition-colors focus-within:border-white/20"
          )}
        >
          <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search services — water, potholes, clinic, ID…"
            aria-label="Search services"
            className="h-full w-full bg-transparent text-[14px] text-white outline-none placeholder:text-zinc-600"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="rounded p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Popular chips */}
        <nav aria-label="Popular services" className="mt-5">
          <SectionLabel className="mb-2">Popular</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {POPULAR_SERVICES.map((key) => (
              <button
                key={key}
                onClick={() => openService(key)}
                className={cn(
                  "inline-flex h-8 items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-3.5 text-[12.5px] font-medium text-zinc-300 transition-all hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
                )}
                aria-label={`Open ${SERVICES[key].label} services`}
              >
                <ServiceIcon service={key} className={cn("h-3.5 w-3.5", SERVICE_TINT[key])} />
                {SERVICES[key].label}
              </button>
            ))}
          </div>
        </nav>
      </motion.section>

      {/* ---------- All services ---------- */}
      <motion.section
        className="mt-12"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        aria-labelledby="all-services-heading"
      >
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 id="all-services-heading" className="text-[15px] font-semibold tracking-tight text-white">
            All services
          </h2>
          <p className="text-[12px] text-zinc-600">
            {filtered.length} of {SERVICE_KEYS.length}
          </p>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No services match your search"
            description="Try a different word — for example “water”, “pothole” or “clinic”. You can also report a problem directly."
            action={
              <PrimaryButton onClick={() => navigate("report")}>
                Tell SASI what is happening
              </PrimaryButton>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((key) => {
              const meta = SERVICES[key];
              const count = incidentCounts[key] ?? 0;
              return (
                <li key={key}>
                  <button
                    onClick={() => openService(key)}
                    aria-label={`Open ${meta.label} services`}
                    className="sasi-card sasi-card-interactive group flex h-full w-full flex-col p-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]",
                          SERVICE_TINT[key]
                        )}
                      >
                        <ServiceIcon service={key} className="h-4 w-4" />
                      </span>
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-zinc-700 transition-colors group-hover:text-zinc-300" />
                    </div>
                    <p className="mt-3 text-[14px] font-medium text-white">{meta.label}</p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">{meta.blurb}</p>
                    <p className="mt-3 border-t border-white/5 pt-2.5 text-[11px] text-zinc-600">
                      {count > 0 ? (
                        <span>
                          {count} demo {count === 1 ? "incident" : "incidents"} tracked
                        </span>
                      ) : (
                        <span>No demo incidents tracked</span>
                      )}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </motion.section>

      {/* ---------- Recommended ---------- */}
      <motion.section
        className="mt-10"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        aria-labelledby="start-here-heading"
      >
        <div className="sasi-card flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 id="start-here-heading" className="text-[14px] font-medium text-white">
              Not sure where to start?
            </h2>
            <p className="mt-1 max-w-lg text-[12.5px] leading-relaxed text-zinc-500">
              Describe the problem in your own words. SASI works out which service and pathway
              apply, and prepares everything for your review.
            </p>
          </div>
          <PrimaryButton onClick={() => navigate("report")} className="shrink-0">
            <MessageSquarePlus className="h-4 w-4" aria-hidden />
            Tell SASI what is happening
          </PrimaryButton>
        </div>
      </motion.section>
    </div>
  );
}
