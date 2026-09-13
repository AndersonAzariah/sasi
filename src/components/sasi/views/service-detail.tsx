"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Camera,
  CheckCircle2,
  Clock3,
  FileText,
  Landmark,
  Map,
  MapPin,
  MessageSquarePlus,
  Route,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useSasiStore } from "@/lib/sasi/store";
import { getSessionId } from "@/lib/sasi/utils";
import { INCIDENTS } from "@/lib/sasi/data";
import { SERVICES } from "@/lib/sasi/utils";
import {
  LOCATION_CATEGORY_LABELS,
  registryEntryBySlug,
  type ServiceRegistryEntry,
} from "@/lib/sasi/services-registry";
import type { ServiceKey } from "@/lib/sasi/types";
import {
  EmptyState,
  GhostButton,
  OfficialSource,
  SectionLabel,
  ServiceIcon,
  SERVICE_TINT,
  StatTile,
  TrustNotice,
} from "@/components/sasi/primitives";
import { CaseCard, IncidentCard } from "@/components/sasi/domain";
import { ORGANISATIONS } from "@/lib/sasi/explore-data";
import { cn } from "@/lib/utils";

const OFFICIAL_PATHWAY_STEPS = [
  {
    title: "Identify your municipality",
    detail: "Service delivery is handled by your local municipality or the relevant utility.",
  },
  {
    title: "Use official reporting channels",
    detail: "Municipal call centres, websites and offices are the official routes for service requests.",
  },
  {
    title: "Keep your reference",
    detail: "Always record the reference number you are given. It is your proof of report.",
  },
  {
    title: "Follow up in writing",
    detail: "Written follow-ups create a record and are harder to ignore than calls alone.",
  },
];

export default function ServiceDetailView() {
  const param = useSasiStore((s) => s.param);
  const activeService = useSasiStore((s) => s.activeService);
  const cases = useSasiStore((s) => s.cases);
  const navigate = useSasiStore((s) => s.navigate);
  const openCase = useSasiStore((s) => s.openCase);
  const openIncident = useSasiStore((s) => s.openIncident);
  const setCommandOpen = useSasiStore((s) => s.setCommandOpen);

  const key = (param ?? activeService ?? "") as ServiceKey;
  const meta = SERVICES[key];
  /* Registry data (Task 28-c) — matches when the slug exists in the
     service registry, including slugs outside the reporting categories
     (passport, smart-id, …). */
  const entry = useMemo(() => registryEntryBySlug(key), [key]);

  const serviceIncidents = useMemo(
    () => INCIDENTS.filter((i) => i.service === key),
    [key]
  );
  const activeIncidents = useMemo(
    () => serviceIncidents.filter((i) => i.status !== "RESOLVED"),
    [serviceIncidents]
  );
  const serviceCases = useMemo(
    () => cases.filter((c) => c.service === key),
    [cases, key]
  );

  /* ---------- Missing service ---------- */
  if (!meta) {
    /* Registry-backed page for named services (passport, smart-id, …) */
    if (entry) {
      return <RegistryServiceDetail entry={entry} />;
    }
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <EmptyState
          icon={FileText}
          title="Service not found"
          description="The service you are looking for is not in the directory. Browse all services instead."
          action={<GhostButton onClick={() => navigate("services")}>Back to all services</GhostButton>}
        />
      </div>
    );
  }

  const isWater = key === "water";
  const confirmedCount = serviceIncidents.filter((i) => i.status === "CONFIRMED").length;
  const featuredIncidents = (isWater ? activeIncidents : serviceIncidents).slice(0, 3);

  const commonTasks = [
    {
      icon: MessageSquarePlus,
      label: "Report a problem",
      detail: "Start a case with SASI",
      onClick: () => navigate("report"),
    },
    {
      icon: AlertTriangle,
      label: "Check incidents",
      detail: "What is being tracked now",
      onClick: () => navigate("incidents"),
    },
    {
      icon: Map,
      label: "View the map",
      detail: "Incidents near you",
      onClick: () => navigate("map"),
    },
    {
      icon: Sparkles,
      label: "Ask SASI about this service",
      detail: "Opens the command palette",
      onClick: () => setCommandOpen(true),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      {/* ---------- Header ---------- */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        aria-labelledby="service-detail-heading"
      >
        <GhostButton
          onClick={() => navigate("services")}
          className="mb-6 h-8 px-3 text-[12.5px]"
          aria-label="Back to all services"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          All services
        </GhostButton>

        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]",
              SERVICE_TINT[key]
            )}
          >
            <ServiceIcon service={key} className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                id="service-detail-heading"
                className="text-xl font-semibold tracking-tight text-white sm:text-2xl"
              >
                {meta.label} services
              </h1>
              {serviceIncidents.length > 0 && (
                <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
                  {serviceIncidents.length} {serviceIncidents.length === 1 ? "incident" : "incidents"} tracked
                </span>
              )}
              {entry && <SaveServiceButton slug={entry.slug} title={entry.title} className="ml-auto" />}
            </div>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-zinc-400">{meta.blurb}</p>
          </div>
        </div>
      </motion.section>

      {/* ---------- Common tasks ---------- */}
      <motion.section
        className="mt-10"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        aria-labelledby="common-tasks-heading"
      >
        <SectionLabel className="sasi-eyebrow mb-3">Common tasks</SectionLabel>
        <h2 id="common-tasks-heading" className="sr-only">
          Common tasks for {meta.label.toLowerCase()} services
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {commonTasks.map((task) => (
            <li key={task.label}>
              <button
                onClick={task.onClick}
                className="sasi-card sasi-card-interactive group flex w-full items-center gap-3 p-4 text-left"
                aria-label={task.label}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]">
                  <task.icon className="h-4 w-4 text-zinc-300" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-white">{task.label}</span>
                  <span className="block truncate text-[11.5px] text-zinc-500">{task.detail}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-zinc-700 transition-colors group-hover:text-zinc-300" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </motion.section>

      {/* ---------- Service registry (Task 28-c) ---------- */}
      {entry ? (
        <motion.section
          className="mt-10"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          aria-labelledby="registry-heading"
        >
          <SectionLabel className="sasi-eyebrow mb-3">Service guide</SectionLabel>
          <h2 id="registry-heading" className="sr-only">
            Registry information for {meta.label} services
          </h2>
          <RegistrySections entry={entry} />
        </motion.section>
      ) : null}

      {/* ---------- Service information (water flagship) / incidents for other services ---------- */}
      <motion.section
        className="mt-10"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        aria-labelledby="civic-info-heading"
      >
        {isWater ? (
          <>
            <SectionLabel className="sasi-eyebrow mb-3">Service information</SectionLabel>
            <h2 id="civic-info-heading" className="sr-only">
              Current water incidents
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatTile
                label="Active incidents"
                value={activeIncidents.length}
                hint="Incidents not yet marked resolved"
                tone={activeIncidents.length > 0 ? "blue" : "default"}
              />
              <StatTile
                label="Confirmed by sources"
                value={confirmedCount}
                hint="Corroborated by official or news sources"
                tone={confirmedCount > 0 ? "green" : "default"}
              />
            </div>
            <div className="mt-4">
              <p className="mb-3 text-[12.5px] font-medium text-zinc-300">Current incidents</p>
              {featuredIncidents.length === 0 ? (
                <div className="sasi-card px-6 py-10 text-center">
                  <p className="text-[13.5px] font-medium text-white">No water incidents tracked right now</p>
                  <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-zinc-500">
                    SASI tracks only what it can verify — nothing is invented. Your own
                    water cases appear below.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                  {featuredIncidents.map((incident) => (
                    <IncidentCard key={incident.id} incident={incident} onOpen={() => openIncident(incident.ref)} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <SectionLabel className="sasi-eyebrow mb-3">Incidents</SectionLabel>
            <h2 id="civic-info-heading" className="sr-only">
              Current {meta.label.toLowerCase()} incidents
            </h2>
            {serviceIncidents.length === 0 ? (
              <div className="sasi-card px-6 py-10 text-center">
                <p className="text-[13.5px] font-medium text-white">No {meta.label.toLowerCase()} incidents tracked yet.</p>
                <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-zinc-500">
                  Incidents appear here only once they are tracked — SASI never invents
                  data. Your own {meta.label.toLowerCase()} cases appear below.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {featuredIncidents.map((incident) => (
                  <IncidentCard key={incident.id} incident={incident} onOpen={() => openIncident(incident.ref)} />
                ))}
              </div>
            )}
          </>
        )}
      </motion.section>

      {/* ---------- Water extra: evidence that helps ---------- */}
      {isWater && (
        <motion.section
          className="mt-10"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          aria-labelledby="evidence-helps-heading"
        >
          <SectionLabel className="sasi-eyebrow mb-3">Evidence that helps</SectionLabel>
          <h2 id="evidence-helps-heading" className="sr-only">
            Evidence that helps water investigations
          </h2>
          <div className="sasi-card p-5">
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  icon: Camera,
                  title: "Photos of the meter or tap",
                  detail: "A clear photo of a dry tap or the water meter helps verify the report.",
                },
                {
                  icon: Clock3,
                  title: "Timestamps",
                  detail: "Note when the water stopped and whether it has returned at any point.",
                },
                {
                  icon: Users,
                  title: "Neighbour confirmations",
                  detail: "If neighbours are affected too, it points to a network problem, not one property.",
                },
              ].map((item) => (
                <li key={item.title} className="flex gap-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#66bb6a]" aria-hidden />
                  <div>
                    <p className="text-[13px] font-medium text-zinc-100">{item.title}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </motion.section>
      )}

      {/* ---------- Your cases ---------- */}
      <motion.section
        className="mt-10"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        aria-labelledby="your-cases-heading"
      >
        <SectionLabel className="sasi-eyebrow mb-3">Your cases</SectionLabel>
        <h2 id="your-cases-heading" className="sr-only">
          Your {meta.label.toLowerCase()} cases
        </h2>
        {serviceCases.length === 0 ? (
          <div className="sasi-card flex flex-col items-center px-6 py-10 text-center">
            <p className="text-[13.5px] font-medium text-white">No {meta.label.toLowerCase()} cases yet</p>
            <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-zinc-500">
              When you report a {meta.label.toLowerCase()} problem, SASI opens a case, investigates it and
              prepares next steps for your approval.
            </p>
            <GhostButton
              onClick={() => navigate("report")}
              className="mt-5"
              aria-label={`Report a ${meta.label.toLowerCase()} problem`}
            >
              Report a {meta.label.toLowerCase()} problem
            </GhostButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {serviceCases.map((c) => (
              <CaseCard key={c.id} c={c} onOpen={() => openCase(c.ref)} compact />
            ))}
          </div>
        )}
      </motion.section>

      {/* ---------- Official pathways ---------- */}
      <div className="sasi-line mt-12" aria-hidden />
      <motion.section
        className="mt-8 pb-4"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        aria-labelledby="official-pathways-heading"
      >
        <SectionLabel className="sasi-eyebrow mb-3">Official pathways</SectionLabel>
        <h2 id="official-pathways-heading" className="sr-only">
          Official pathways
        </h2>
        <div className="sasi-card p-5">
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {OFFICIAL_PATHWAY_STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] font-mono text-[11px] font-semibold text-zinc-300"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div>
                  <p className="text-[13px] font-medium text-zinc-100">{step.title}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-white/8 bg-white/[0.02] p-3.5">
            <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
            <p className="text-[12px] leading-relaxed text-zinc-400">
              SASI is independent and not an official channel. We help you prepare and track.
              <ArrowUpRight className="ml-1 inline h-3 w-3 text-zinc-600" aria-hidden />
            </p>
            <ShieldCheck className="ml-auto hidden h-4 w-4 shrink-0 text-zinc-600 sm:block" aria-hidden />
          </div>
        </div>
      </motion.section>
    </div>
  );
}

/* ============================================================
   REGISTRY-DRIVEN PIECES (Task 28-c · Phase 8)
   Shared by the category page (slug is a ServiceKey) and the
   registry-only page (named services like passport / smart-id).
   ============================================================ */

/** Prominent "Start journey" card shown when the registry entry has a
    SASI checklist journey. Navigates to the runner — it never submits
    anything anywhere. */
function JourneyCta({ entry }: { entry: ServiceRegistryEntry }) {
  const navigate = useSasiStore((s) => s.navigate);
  if (!entry.journeyId) return null;
  return (
    <div className="sasi-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-[13.5px] font-medium text-white">
          <Route className="h-4 w-4 shrink-0 text-[#e3c567]" aria-hidden />
          Guided journey available
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
          Step through the preparation checklist — what to bring, where to go, what to expect.
          SASI saves your progress; it never submits anything for you.
        </p>
      </div>
      <GhostButton
        onClick={() => navigate("journey", entry.journeyId ?? undefined)}
        className="min-h-[44px] shrink-0"
        aria-label={`Start the ${entry.title} journey`}
      >
        Start journey
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </GhostButton>
    </div>
  );
}

/** Requirements + documents + official source + related + nearby. */
function RegistrySections({ entry }: { entry: ServiceRegistryEntry }) {
  const navigate = useSasiStore((s) => s.navigate);

  const nearbyLabel =
    (entry.locationCategory && LOCATION_CATEGORY_LABELS[entry.locationCategory]) ||
    entry.locationCategory?.replace(/-/g, " ") ||
    null;

  return (
    <div className="space-y-5">
      <JourneyCta entry={entry} />

      {entry.requirements.length > 0 ? (
        <div className="sasi-card p-5">
          <p className="text-[12.5px] font-medium text-zinc-300">Requirements</p>
          <ul className="mt-3 space-y-2.5">
            {entry.requirements.map((req) => (
              <li key={req} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#66bb6a]" aria-hidden />
                <span className="text-[12.5px] leading-relaxed text-zinc-300">{req}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {entry.requiredDocuments.length > 0 ? (
        <div className="sasi-card p-5">
          <p className="text-[12.5px] font-medium text-zinc-300">Documents to bring</p>
          <ul className="mt-3 space-y-2.5">
            {entry.requiredDocuments.map((doc) => (
              <li key={doc} className="flex items-start gap-2.5">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                <span className="text-[12.5px] leading-relaxed text-zinc-300">{doc}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-white/[0.06] pt-3 text-[11.5px] leading-relaxed text-zinc-600">
            Commonly documented requirements — individual offices can ask for more. Confirm with
            the official source before you travel.
          </p>
        </div>
      ) : null}

      {/* official source trust block */}
      <div>
        <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
          Official source
        </p>
        {entry.officialSource ? (
          <OfficialSource
            title={entry.title}
            organisation={entry.officialSource.org}
            href={entry.officialSource.verified ? entry.officialSource.url : undefined}
            note={
              entry.officialSource.verified
                ? "Verified by SASI as an official government site."
                : "SASI has not verified this link — confirm details through the organisation directly."
            }
          />
        ) : (
          <TrustNotice>
            No single official page is verified for this service — confirm details through{" "}
            {entry.department} directly. SASI is independent and never a submission channel.
          </TrustNotice>
        )}
      </div>

      {/* organisation page — the knowledge network edge: Service → Organisation
          (derived purely from the organisation registry's serviceSlugs) */}
      {(() => {
        const org = ORGANISATIONS.find((o) => o.serviceSlugs.includes(entry.slug));
        if (!org) return null;
        return (
          <button
            onClick={() => navigate("explore", `org:${org.id}`)}
            className="sasi-card sasi-card-interactive group flex w-full items-center gap-3.5 p-4 text-left"
            aria-label={`About ${org.name}`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03]">
              <Landmark className="h-5 w-5 text-zinc-300" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-medium text-white">{org.name}</span>
              <span className="mt-0.5 block truncate text-[12px] text-zinc-500">
                Responsibilities, verified website and related services
              </span>
            </span>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-zinc-700 transition-all group-hover:translate-x-0.5 group-hover:text-[#e3c567]"
              aria-hidden
            />
          </button>
        );
      })()}

      {entry.relatedServices.length > 0 ? (
        <div className="sasi-card p-5">
          <p className="text-[12.5px] font-medium text-zinc-300">Related services</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {entry.relatedServices.map((slug) => {
              const related = registryEntryBySlug(slug);
              if (!related) return null;
              return (
                <button
                  key={slug}
                  onClick={() => navigate("service-detail", slug)}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 text-[12.5px] text-zinc-300 transition-colors hover:border-white/25 hover:text-white"
                  aria-label={`Open ${related.title}`}
                >
                  {related.title}
                  <ArrowUpRight className="h-3.5 w-3.5 text-zinc-600" aria-hidden />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {nearbyLabel ? (
        <button
          onClick={() => navigate("map", entry.locationCategory ?? undefined)}
          className="sasi-card sasi-card-interactive group flex w-full items-center gap-3.5 p-4 text-left"
          aria-label={`Find ${nearbyLabel} near you on the map`}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03]">
            <MapPin className="h-5 w-5 text-zinc-300" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium text-white">Nearby</span>
            <span className="mt-0.5 block truncate text-[12px] text-zinc-500">
              Find {nearbyLabel} near you on the map
            </span>
          </span>
          <ArrowRight
            className="h-4 w-4 shrink-0 text-zinc-700 transition-all group-hover:translate-x-0.5 group-hover:text-[#e3c567]"
            aria-hidden
          />
        </button>
      ) : null}
    </div>
  );
}

/** Full page for registry-only slugs (passport, smart-id, sassa-grants, …)
    — these are real services, not reporting categories. */
function RegistryServiceDetail({ entry }: { entry: ServiceRegistryEntry }) {
  const navigate = useSasiStore((s) => s.navigate);
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <GhostButton
        onClick={() => navigate("services")}
        className="mb-6 h-8 px-3 text-[12.5px]"
        aria-label="Back to all services"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        All services
      </GhostButton>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        aria-labelledby="registry-service-heading"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]",
              SERVICE_TINT[entry.category as ServiceKey]
            )}
          >
            <ServiceIcon service={entry.category as ServiceKey} className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                id="registry-service-heading"
                className="text-xl font-semibold tracking-tight text-white sm:text-2xl"
              >
                {entry.title}
              </h1>
              <SaveServiceButton slug={entry.slug} title={entry.title} className="ml-auto" />
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-zinc-500">
              <Landmark className="h-3.5 w-3.5 shrink-0 text-zinc-600" aria-hidden />
              {entry.department}
            </p>
            <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-zinc-400">
              {entry.summary}
            </p>
          </div>
        </div>
      </motion.section>

      <section className="mt-8" aria-label="Registry guide">
        <RegistrySections entry={entry} />
      </section>

      <TrustNotice className="mt-8">
        SASI is independent and informational — it prepares you for the official process and never
        replaces it. Requirements shown are commonly documented; confirm details with{" "}
        {entry.officialSource?.org ?? entry.department} before you travel.
      </TrustNotice>
    </div>
  );
}

/** Save-to-My-SASI toggle. A SASI bookmark only — never a government
    account or subscription. Idempotent via the SavedItem table. */
function SaveServiceButton({
  slug,
  title,
  className,
}: {
  slug: string;
  title: string;
  className?: string;
}) {
  const [saved, setSaved] = useState<boolean | null>(null); /* null = checking */

  useEffect(() => {
    let alive = true;
    setSaved(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/sasi/save?sessionId=${encodeURIComponent(getSessionId())}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          items?: { kind: string; itemId: string }[];
        };
        if (alive) {
          setSaved(
            (data.items ?? []).some((i) => i.kind === "service" && i.itemId === slug)
          );
        }
      } catch {
        if (alive) setSaved(false); /* honest default: not saved */
      }
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  const toggle = useCallback(async () => {
    if (saved === null) return;
    const next = !saved;
    setSaved(next);
    try {
      const res = next
        ? await fetch("/api/sasi/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: getSessionId(),
              kind: "service",
              itemId: slug,
              payload: { title, slug },
            }),
          })
        : await fetch(
            `/api/sasi/save?sessionId=${encodeURIComponent(getSessionId())}&kind=service&itemId=${encodeURIComponent(slug)}`,
            { method: "DELETE" }
          );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(
        next ? `Saved ${title} to My SASI.` : `Removed ${title} from My SASI.`
      );
    } catch {
      setSaved(!next);
      toast.error("SASI could not update your saved items just now. Please try again.");
    }
  }, [saved, slug, title]);

  return (
    <GhostButton
      onClick={() => void toggle()}
      disabled={saved === null}
      className={cn("min-h-[44px] shrink-0 text-[12px]", className)}
      aria-label={saved ? `Remove ${title} from My SASI` : `Save ${title} to My SASI`}
      aria-pressed={saved === true}
    >
      {saved ? (
        <BookmarkCheck className="h-3.5 w-3.5 text-[#e3c567]" aria-hidden />
      ) : (
        <Bookmark className="h-3.5 w-3.5" aria-hidden />
      )}
      {saved === null ? "…" : saved ? "Saved" : "Save"}
    </GhostButton>
  );
}
