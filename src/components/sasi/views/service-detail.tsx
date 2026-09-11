"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Camera,
  CheckCircle2,
  Clock3,
  FileText,
  Landmark,
  Map,
  MessageSquarePlus,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { INCIDENTS } from "@/lib/sasi/data";
import { SERVICES } from "@/lib/sasi/utils";
import type { ServiceKey } from "@/lib/sasi/types";
import {
  DemoBadge,
  EmptyState,
  GhostButton,
  SectionLabel,
  ServiceIcon,
  SERVICE_TINT,
  StatTile,
} from "@/components/sasi/primitives";
import { CaseCard, IncidentCard } from "@/components/sasi/domain";
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
                <DemoBadge label={`DEMO · ${serviceIncidents.length} INCIDENT${serviceIncidents.length === 1 ? "" : "S"} TRACKED`} />
              )}
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
        <SectionLabel className="mb-3">Common tasks</SectionLabel>
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
            <SectionLabel className="mb-3">Service information</SectionLabel>
            <h2 id="civic-info-heading" className="sr-only">
              Current water incidents
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <StatTile
                label="Active incidents"
                value={activeIncidents.length}
                hint="Demo incidents not yet marked resolved"
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
              <div className="mb-3 flex items-center gap-2">
                <p className="text-[12.5px] font-medium text-zinc-300">Current incidents</p>
                <DemoBadge />
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {featuredIncidents.map((incident) => (
                  <IncidentCard key={incident.id} incident={incident} onOpen={() => openIncident(incident.ref)} />
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <SectionLabel className="mb-3">Incidents</SectionLabel>
            <h2 id="civic-info-heading" className="sr-only">
              Current {meta.label.toLowerCase()} incidents
            </h2>
            {serviceIncidents.length === 0 ? (
              <div className="sasi-card px-6 py-10 text-center">
                <p className="text-[13.5px] font-medium text-white">No {meta.label.toLowerCase()} incidents in the demo dataset yet.</p>
                <p className="mx-auto mt-1.5 max-w-md text-[12.5px] leading-relaxed text-zinc-500">
                  The demo dataset focuses on water, electricity, roads and waste. Anything you
                  report in this service will appear here.
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
          <SectionLabel className="mb-3">Evidence that helps</SectionLabel>
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
        <SectionLabel className="mb-3">Your cases</SectionLabel>
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
      <motion.section
        className="mt-10 pb-4"
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        aria-labelledby="official-pathways-heading"
      >
        <SectionLabel className="mb-3">Official pathways</SectionLabel>
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
