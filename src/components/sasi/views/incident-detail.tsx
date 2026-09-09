"use client";

import { useMemo } from "react";
import { ArrowLeft, MapPin, Sparkles } from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { INCIDENTS, sourcesByIds } from "@/lib/sasi/data";
import type { TimelineEvent } from "@/lib/sasi/types";
import {
  PRIORITY_META,
  SERVICES,
  TRUST_STATUS_META,
  formatDateTime,
  locationLabel,
  timeAgo,
} from "@/lib/sasi/utils";
import {
  DemoBadge,
  EmptyState,
  GhostButton,
  PrimaryButton,
  PriorityBadge,
  SectionLabel,
  ServiceIcon,
  SERVICE_TINT,
  StatusBadge,
} from "../primitives";
import { CaseCard, SourceCard, TimelineRail } from "../domain";
import { GautengMiniMap, MARKER_COLOR } from "./map";

/* ============================================================
   INCIDENT DETAIL — trust-first incident record (demo data)
   ============================================================ */

export default function IncidentDetailView() {
  const activeIncidentId = useSasiStore((s) => s.activeIncidentId);
  const param = useSasiStore((s) => s.param);
  const cases = useSasiStore((s) => s.cases);
  const navigate = useSasiStore((s) => s.navigate);
  const openCase = useSasiStore((s) => s.openCase);

  const ref = activeIncidentId ?? param ?? "";
  const incident = useMemo(
    () => INCIDENTS.find((i) => i.id === ref || i.ref === ref),
    [ref]
  );

  const sources = useMemo(
    () => (incident ? sourcesByIds(incident.sourceIds) : []),
    [incident]
  );

  const timeline = useMemo<TimelineEvent[]>(() => {
    if (!incident) return [];
    const events: TimelineEvent[] = [
      {
        id: `${incident.id}-tl-1`,
        at: incident.reportedAt,
        label: "Incident reported",
        detail: `First reports received for ${locationLabel(incident.location, "suburb")}. (Demo data.)`,
        kind: "system",
      },
    ];
    if (sources.length > 0) {
      events.push({
        id: `${incident.id}-tl-2`,
        at: sources[0].retrievedAt,
        label: `${sources.length} public source${sources.length === 1 ? "" : "s"} attached`,
        detail: sources
          .slice(0, 2)
          .map((s) => s.title)
          .join(" · "),
        kind: "source",
      });
    } else {
      events.push({
        id: `${incident.id}-tl-2b`,
        at: incident.reportedAt,
        label: "Awaiting public sources",
        detail:
          "No official publication matched yet — resident reports keep this incident flagged. (Demo data.)",
        kind: "system",
      });
    }
    if (incident.status === "RESOLVED") {
      events.push({
        id: `${incident.id}-tl-3`,
        at: incident.updatedAt,
        label: "Marked resolved",
        detail:
          "Latest update indicates the issue is closed or service restored. (Demo data.)",
        kind: "system",
      });
    } else {
      events.push({
        id: `${incident.id}-tl-3b`,
        at: incident.updatedAt,
        label: "Status updated",
        detail: `Currently ${TRUST_STATUS_META[incident.status].label.toLowerCase()} · severity ${PRIORITY_META[incident.severity].label.toLowerCase()}. (Demo data.)`,
        kind: "system",
      });
    }
    return events;
  }, [incident, sources]);

  const relatedCases = useMemo(() => {
    if (!incident) return [];
    return cases
      .filter(
        (c) => c.service === incident.service && c.location.city === incident.location.city
      )
      .slice(0, 2);
  }, [cases, incident]);

  /* ---------- missing incident ---------- */
  if (!incident) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <GhostButton
          onClick={() => navigate("incidents")}
          className="-ml-2 h-8 px-2.5 text-[12px]"
          aria-label="Back to incidents explorer"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to incidents
        </GhostButton>
        <div className="mt-4">
          <EmptyState
            icon={Sparkles}
            title="Incident not found"
            description="This incident reference does not exist in the demo dataset. It may have been opened from an outdated link."
            action={
              <GhostButton onClick={() => navigate("incidents")}>
                Browse all incidents
              </GhostButton>
            }
          />
        </div>
      </div>
    );
  }

  const serviceMeta = SERVICES[incident.service];

  const detailRows: { label: string; value: string }[] = [
    { label: "Service", value: serviceMeta.label },
    { label: "Province", value: incident.location.province },
    { label: "Municipality", value: incident.location.municipality },
    {
      label: "City / suburb",
      value: incident.location.suburb
        ? `${incident.location.city} — ${incident.location.suburb}`
        : incident.location.city,
    },
    ...(incident.affectedArea
      ? [{ label: "Affected area", value: incident.affectedArea }]
      : []),
    { label: "Reported", value: formatDateTime(incident.reportedAt) },
    { label: "Last update", value: `${timeAgo(incident.updatedAt)}` },
    {
      label: "Sources",
      value:
        incident.sourceIds.length > 0
          ? `${incident.sourceIds.length} public source${incident.sourceIds.length === 1 ? "" : "s"}`
          : "None attached yet",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ---------- header ---------- */}
      <GhostButton
        onClick={() => navigate("incidents")}
        className="-ml-2 h-8 px-2.5 text-[12px]"
        aria-label="Back to incidents explorer"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to incidents
      </GhostButton>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03] ${SERVICE_TINT[incident.service]}`}
          >
            <ServiceIcon service={incident.service} className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.16em] text-zinc-500">
              {incident.ref}
            </p>
            <h1 className="mt-0.5 text-[19px] font-semibold leading-snug tracking-tight text-white sm:text-[21px]">
              {incident.title}
            </h1>
            <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-zinc-400">
              <ServiceIcon service={incident.service} className="h-3.5 w-3.5" aria-hidden />
              {serviceMeta.label}
              <span className="text-zinc-700" aria-hidden>·</span>
              <MapPin className="h-3 w-3 text-zinc-600" aria-hidden />
              {locationLabel(incident.location, "suburb")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={incident.status} />
          <PriorityBadge priority={incident.severity} />
          <DemoBadge label="DEMO DATA" />
        </div>
      </div>

      {/* ---------- body ---------- */}
      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-5">
        {/* LEFT */}
        <div className="min-w-0 space-y-4">
          {/* summary */}
          <section className="sasi-card p-4" aria-label="Incident summary">
            <SectionLabel>Summary</SectionLabel>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-300">
              {incident.description}
            </p>
          </section>

          {/* details */}
          <section className="sasi-card p-4" aria-label="Incident details">
            <SectionLabel>Details</SectionLabel>
            <dl className="mt-2">
              {detailRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-baseline justify-between gap-4 border-b border-white/5 py-2 last:border-b-0 last:pb-0 first:pt-0"
                >
                  <dt className="shrink-0 text-[11px] font-medium uppercase tracking-[0.1em] text-zinc-600">
                    {row.label}
                  </dt>
                  <dd className="min-w-0 text-right text-[12.5px] text-zinc-300">{row.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* timeline */}
          <section className="sasi-card p-4" aria-label="Incident timeline">
            <SectionLabel>Recent updates</SectionLabel>
            <div className="mt-3">
              <TimelineRail events={timeline} />
            </div>
            <p className="mt-1 border-t border-white/5 pt-2.5 text-[11px] text-zinc-600">
              Reconstructed from demo incident data — not a live event feed.
            </p>
          </section>

          {/* sources */}
          <section aria-label="Public sources">
            <div className="mb-2.5 flex items-center justify-between">
              <SectionLabel>Public sources</SectionLabel>
              <span className="font-mono text-[10px] tracking-wider text-zinc-600">
                {sources.length} attached
              </span>
            </div>
            {sources.length > 0 ? (
              <div className="space-y-2.5">
                {sources.map((s) => (
                  <SourceCard key={s.id} source={s} />
                ))}
              </div>
            ) : (
              <div className="sasi-card p-4">
                <p className="text-[12.5px] leading-relaxed text-zinc-500">
                  No public sources attached yet — reports from residents keep this incident
                  flagged. When an official notice or news report matches, it will appear here with
                  its own trust status.
                </p>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT — sticky */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-20">
          {/* location */}
          <section className="sasi-card p-4" aria-label="Location on map">
            <SectionLabel>Location</SectionLabel>
            <GautengMiniMap
              className="mt-2.5 aspect-square w-full"
              markers={[
                {
                  id: incident.id,
                  x: incident.location.mapX ?? 50,
                  y: incident.location.mapY ?? 50,
                  color: MARKER_COLOR[incident.status] ?? "#a1a1aa",
                  label: incident.ref,
                  size: 3.2,
                },
              ]}
              selectedId={incident.id}
            />
            <div className="mt-3 space-y-1 text-[12.5px] text-zinc-300">
              <p className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                {locationLabel(incident.location, "suburb")}
              </p>
              <p className="pl-5 text-[11.5px] text-zinc-500">
                {incident.location.municipality} · {incident.location.province}
              </p>
            </div>
            <p className="mt-2.5 border-t border-white/5 pt-2 font-mono text-[9px] tracking-[0.14em] text-zinc-700">
              STYLISED POSITION · DEMO COORDINATES
            </p>
          </section>

          {/* related actions */}
          <section className="sasi-card p-4" aria-label="Related actions">
            <SectionLabel>Related actions</SectionLabel>
            <div className="mt-3 space-y-2">
              <PrimaryButton
                className="w-full"
                onClick={() => navigate("start-investigation")}
                aria-label="Investigate this incident"
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Investigate this incident
              </PrimaryButton>
              <GhostButton
                className="w-full"
                onClick={() => navigate("report")}
                aria-label="Report a similar issue"
              >
                Report a similar issue
              </GhostButton>
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-600">
              SASI prepares everything for your review first — nothing is submitted to government
              without your approval.
            </p>
          </section>

          {/* related cases */}
          {relatedCases.length > 0 && (
            <section aria-label="Related cases">
              <div className="mb-2.5">
                <SectionLabel>Related cases</SectionLabel>
              </div>
              <div className="space-y-2.5">
                {relatedCases.map((c) => (
                  <CaseCard key={c.id} c={c} compact onOpen={() => openCase(c.id)} />
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
