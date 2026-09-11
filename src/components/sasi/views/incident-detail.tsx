"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Check,
  ClipboardCopy,
  MapPin,
  Printer,
  Share2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useSasiStore } from "@/lib/sasi/store";
import { useT } from "@/lib/sasi/i18n";
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
   INCIDENT DETAIL — trust-first incident record
   ============================================================ */

export default function IncidentDetailView() {
  const activeIncidentId = useSasiStore((s) => s.activeIncidentId);
  const param = useSasiStore((s) => s.param);
  const cases = useSasiStore((s) => s.cases);
  const navigate = useSasiStore((s) => s.navigate);
  const openCase = useSasiStore((s) => s.openCase);
  const t = useT();

  /* share popover state (copy + print, same pattern as case brief) */
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  /* Escape closes the share popover (keyboard a11y) */
  useEffect(() => {
    if (!shareOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShareOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shareOpen]);

  const ref = activeIncidentId ?? param ?? "";

  /* reset popover when switching incidents (render-time adjustment) */
  const [prevRef, setPrevRef] = useState(ref);
  if (prevRef !== ref) {
    setPrevRef(ref);
    setShareOpen(false);
    setCopied(false);
  }

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
        detail: `First reports received for ${locationLabel(incident.location, "suburb")}.`,
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
          "No official publication matched yet — resident reports keep this incident flagged.",
        kind: "system",
      });
    }
    if (incident.status === "RESOLVED") {
      events.push({
        id: `${incident.id}-tl-3`,
        at: incident.updatedAt,
        label: "Marked resolved",
        detail:
          "Latest update indicates the issue is closed or service restored.",
        kind: "system",
      });
    } else {
      events.push({
        id: `${incident.id}-tl-3b`,
        at: incident.updatedAt,
        label: "Status updated",
        detail: `Currently ${TRUST_STATUS_META[incident.status].label.toLowerCase()} · severity ${PRIORITY_META[incident.severity].label.toLowerCase()}.`,
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

  /* plain-text incident brief for the clipboard (kept above any early return) */
  const incidentSummaryText = useMemo(() => {
    if (!incident) return "";
    const lines = [
      `SASI INCIDENT BRIEF — ${incident.ref}`,
      incident.title,
      `Status: ${incident.status} · Severity: ${incident.severity} · Service: ${SERVICES[incident.service].label}`,
      `Location: ${locationLabel(incident.location, "full")}`,
      `Reported: ${formatDateTime(incident.reportedAt)} · Last update: ${formatDateTime(incident.updatedAt)}`,
      "",
      "Summary",
      incident.description,
    ];
    if (incident.affectedArea) lines.push("", "Affected area", incident.affectedArea);
    lines.push(
      "",
      `Public sources: ${incident.sourceIds.length}`,
      "",
      "Generated by SASI — South African Service Intelligence (not a government submission)."
    );
    return lines.join("\n");
  }, [incident]);

  /* ---------- missing incident ---------- */
  if (!incident) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <GhostButton
          onClick={() => navigate("incidents")}
          className="-ml-2 h-8 px-2.5 text-[12px]"
          aria-label={t("id.back-aria")}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> {t("id.back")}
        </GhostButton>
        <div className="mt-4">
          <EmptyState
            icon={Sparkles}
            title={t("id.notfound.title")}
            description={
              "No incident with this reference is currently tracked. It may have been opened from an outdated link."
            }
            action={
              <GhostButton onClick={() => navigate("incidents")}>
                {t("id.browse-all")}
              </GhostButton>
            }
          />
        </div>
      </div>
    );
  }

  const serviceMeta = SERVICES[incident.service];

  const detailRows: { label: string; value: string }[] = [
    { label: t("id.facts.service"), value: serviceMeta.label },
    { label: t("id.facts.province"), value: incident.location.province },
    { label: t("id.facts.municipality"), value: incident.location.municipality },
    {
      label: t("id.facts.city"),
      value: incident.location.suburb
        ? `${incident.location.city} — ${incident.location.suburb}`
        : incident.location.city,
    },
    ...(incident.affectedArea
      ? [{ label: t("id.facts.area"), value: incident.affectedArea }]
      : []),
    { label: t("id.facts.reported"), value: formatDateTime(incident.reportedAt) },
    { label: t("id.facts.last-update"), value: `${timeAgo(incident.updatedAt)}` },
    {
      label: t("id.facts.sources"),
      value:
        incident.sourceIds.length > 0
          ? `${incident.sourceIds.length} public source${incident.sourceIds.length === 1 ? "" : "s"}`
          : t("id.sources-none"),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ---------- header ---------- */}
      <GhostButton
        onClick={() => navigate("incidents")}
        className="-ml-2 h-8 px-2.5 text-[12px]"
        aria-label={t("id.back-aria")}
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> {t("id.back")}
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
        </div>
      </div>

      {/* ---------- share row (copy + print) ---------- */}
      <div className="mt-3 flex items-center gap-2">
        <div className="relative">
          <GhostButton
            onClick={() => setShareOpen((o) => !o)}
            aria-expanded={shareOpen}
            aria-haspopup="dialog"
            className="h-8 px-2.5 text-[12px]"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden />
            {t("id.share")}
          </GhostButton>
          {shareOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShareOpen(false)}
                aria-hidden
              />
              <div
                role="dialog"
                aria-label={t("id.share-dialog")}
                className="sasi-card sasi-pop absolute left-0 top-10 z-50 w-64 bg-[#0d0e10] p-2 shadow-xl shadow-black/50"
              >
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(incidentSummaryText);
                    } catch {
                      /* clipboard blocked — the state still shows below */
                    }
                    setCopied(true);
                    toast("Incident summary copied", {
                      description: `${incident.ref} · plain text, ready to paste.`,
                    });
                    setTimeout(() => setCopied(false), 2400);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-zinc-200 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  {copied ? (
                    <Check className="h-4 w-4 shrink-0 text-[#66bb6a]" aria-hidden />
                  ) : (
                    <ClipboardCopy className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                  )}
                  {copied ? t("id.share.copied") : t("id.share.copy")}
                </button>
                <button
                  onClick={() => {
                    setShareOpen(false);
                    window.print();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-zinc-200 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  <Printer className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                  {t("id.share.print")}
                </button>
                <p className="mt-1 border-t border-white/5 px-2.5 pb-1 pt-2 text-[11px] leading-relaxed text-zinc-600">
                  Direct link sharing is not available yet.
                </p>
              </div>
            </>
          )}
        </div>
        <p className="text-[11px] text-zinc-600">
          {t("id.share.hint")}
        </p>
      </div>

      {/* ---------- body ---------- */}
      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-5">
        {/* LEFT */}
        <div className="min-w-0 space-y-4">
          {/* summary */}
          <section className="sasi-card p-4" aria-label={t("id.summary")}>
            <SectionLabel className="sasi-eyebrow">{t("id.summary")}</SectionLabel>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-300">
              {incident.description}
            </p>
          </section>

          {/* details */}
          <section className="sasi-card p-4" aria-label={t("id.details")}>
            <SectionLabel className="sasi-eyebrow">{t("id.details")}</SectionLabel>
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
          <section className="sasi-card p-4" aria-label={t("id.updates")}>
            <SectionLabel className="sasi-eyebrow">{t("id.updates")}</SectionLabel>
            <div className="mt-3">
              <TimelineRail events={timeline} />
            </div>
            <p className="mt-1 border-t border-white/5 pt-2.5 text-[11px] text-zinc-600">
              Status history as tracked by SASI — not a live event feed.
            </p>
          </section>

          {/* sources */}
          <section aria-label={t("id.sources")}>
            <div className="mb-2.5 flex items-center justify-between">
              <SectionLabel className="sasi-eyebrow">{t("id.sources")}</SectionLabel>
              <span className="font-mono text-[10px] tracking-wider text-zinc-600">
                {t("id.attached").replace("{n}", String(sources.length))}
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
                  {t("id.sources.empty")}
                </p>
              </div>
            )}
          </section>
        </div>

        {/* RIGHT — sticky */}
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-20">
          {/* location */}
          <section className="sasi-card p-4" aria-label={t("id.location")}>
            <SectionLabel className="sasi-eyebrow">{t("id.location")}</SectionLabel>
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
              STYLISED POSITION · INDICATIVE COORDINATES
            </p>
          </section>

          {/* related actions */}
          <section className="sasi-card p-4" aria-label={t("id.actions.title")}>
            <SectionLabel className="sasi-eyebrow">{t("id.actions.title")}</SectionLabel>
            <div className="mt-3 space-y-2">
              <PrimaryButton
                className="w-full"
                onClick={() => navigate("start-investigation")}
                aria-label={t("id.investigate")}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {t("id.investigate")}
              </PrimaryButton>
              <GhostButton
                className="w-full"
                onClick={() => navigate("report")}
                aria-label={t("id.report-similar")}
              >
                {t("id.report-similar")}
              </GhostButton>
            </div>
            <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-600">
              {t("id.actions.note")}
            </p>
          </section>

          {/* related cases */}
          {relatedCases.length > 0 && (
            <section aria-label={t("id.related")}>
              <div className="mb-2.5">
                <SectionLabel className="sasi-eyebrow">{t("id.related")}</SectionLabel>
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

      {/* ---------- PRINT SHEET (visible only in print / PDF) ----------
          Same portal pattern as the case brief: portalled to <body> so
          the print stylesheet hides every other top-level element. */}
      {createPortal(
        <div className="sasi-print-sheet hidden">
          <div className="sasi-print-header">
            <div className="sasi-print-brand">
              <img src="/sasi-logo.png" alt="" height={22} width={22} />
              <span>SASI</span>
            </div>
            <div className="sasi-print-doc">
              INCIDENT BRIEF · {incident.ref} — NOT AN OFFICIAL DOCUMENT
            </div>
          </div>

          <h1 className="sasi-print-title">{incident.title}</h1>

          <table className="sasi-print-meta">
            <tbody>
              <tr>
                <th>Reference</th>
                <td>{incident.ref}</td>
                <th>Status</th>
                <td>
                  {incident.status} · severity {incident.severity}
                </td>
              </tr>
              <tr>
                <th>Service</th>
                <td>{serviceMeta.label}</td>
                <th>Location</th>
                <td>{locationLabel(incident.location, "full")}</td>
              </tr>
              <tr>
                <th>Reported</th>
                <td>{formatDateTime(incident.reportedAt)}</td>
                <th>Last update</th>
                <td>{formatDateTime(incident.updatedAt)}</td>
              </tr>
              {incident.affectedArea && (
                <tr>
                  <th>Affected area</th>
                  <td colSpan={3}>{incident.affectedArea}</td>
                </tr>
              )}
            </tbody>
          </table>

          <h2 className="sasi-print-h2">Summary</h2>
          <p className="sasi-print-p">{incident.description}</p>

          <h2 className="sasi-print-h2">Recent updates</h2>
          <ul className="sasi-print-list">
            {timeline.map((e) => (
              <li key={e.id}>
                <strong>{e.label}</strong> — {formatDateTime(e.at)}
                {e.detail ? ` · ${e.detail}` : ""}
              </li>
            ))}
          </ul>

          <h2 className="sasi-print-h2">Public sources ({sources.length})</h2>
          {sources.length > 0 ? (
            <ul className="sasi-print-list">
              {sources.map((s) => (
                <li key={s.id}>
                  <strong>{s.title}</strong> — {s.publisher} · {s.sourceType} ·{" "}
                  {s.verification}
                  {s.publishedAt ? ` · ${formatDateTime(s.publishedAt)}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="sasi-print-p">
              No public sources attached yet — resident reports keep this incident flagged.
            </p>
          )}

          <div className="sasi-print-footer">
            Generated by SASI — South African Service Intelligence (not a government
            submission). This sheet was produced from SASI&apos;s incident tracking and
            public-source matching. It is not a government document and nothing has been
            submitted to any authority. SASI never contacts an authority without explicit
            approval.
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
