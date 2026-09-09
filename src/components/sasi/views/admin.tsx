"use client";

import { useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  BarChart3,
  Check,
  Database,
  Flag,
  Link2,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  Users as UsersIcon,
} from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { ACTIVITY, DEMO_USER, EVIDENCE, INCIDENTS, SOURCES } from "@/lib/sasi/data";
import { SOURCE_TYPE_LABEL, SERVICES, timeAgo } from "@/lib/sasi/utils";
import type { ServiceKey } from "@/lib/sasi/types";
import {
  AIStateChip,
  CaseStatusBadge,
  DemoBadge,
  SectionLabel,
  ServiceIcon,
  SERVICE_TINT,
  StatTile,
  StatusBadge,
} from "@/components/sasi/primitives";
import { ActivityRow } from "@/components/sasi/domain";
import { cn } from "@/lib/utils";

/* ============================================================
   ADMIN — foundation. Honest labels everywhere, no live metrics.
   ============================================================ */

type ModerationState = "none" | "approved" | "flagged";

const DEMO_USERS = [
  {
    name: DEMO_USER.name,
    email: DEMO_USER.email,
    role: "resident" as const,
    initials: "TM",
  },
  {
    name: "Lerato Dlamini",
    email: "lerato.dlamini@demo.sasi.org.za",
    role: "resident" as const,
    initials: "LD",
  },
  {
    name: "Naledi Petersen",
    email: "naledi.petersen@demo.sasi.org.za",
    role: "operator" as const,
    initials: "NP",
  },
];

function Panel({
  title,
  label,
  badge,
  children,
  className,
}: {
  title: string;
  label: string;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section aria-labelledby={label} className={cn("sasi-card p-5", className)}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <SectionLabel>{label}</SectionLabel>
          <h2 id={label} className="mt-1 text-[14px] font-semibold text-white">
            {title}
          </h2>
        </div>
        {badge && <DemoBadge label={badge} />}
      </div>
      {children}
    </section>
  );
}

export default function AdminView() {
  const cases = useSasiStore((s) => s.cases);
  const openCase = useSasiStore((s) => s.openCase);

  const [moderation, setModeration] = useState<Record<string, ModerationState>>({});

  const setIncidentState = (id: string, state: ModerationState) =>
    setModeration((m) => ({ ...m, [id]: m[id] === state ? "none" : state }));

  const analytics = useMemo(() => {
    const counts = new Map<string, number>();
    for (const inc of INCIDENTS) {
      counts.set(inc.service, (counts.get(inc.service) ?? 0) + 1);
    }
    const max = Math.max(1, ...counts.values());
    return { rows: [...counts.entries()], max };
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ---------- Header ---------- */}
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight text-white">Admin</h1>
          <DemoBadge label="FOUNDATION — DEMO" />
        </div>
        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-[#e3c567]/20 bg-[#e3c567]/5 p-3.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#e3c567]" aria-hidden />
          <p className="text-[12.5px] leading-relaxed text-[#efe0a8]">
            Admin surfaces are for platform operators. In production this area is role-protected.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ---------- Incident moderation ---------- */}
        <Panel title="Incident moderation" label="admin-moderation" badge="LOCAL DEMO STATE">
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1 sasi-scroll">
            {INCIDENTS.map((inc) => {
              const state = moderation[inc.id] ?? "none";
              return (
                <li
                  key={inc.id}
                  className="rounded-lg border border-white/5 bg-white/[0.015] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-zinc-100">{inc.title}</p>
                      <p className="mt-0.5 font-mono text-[10px] tracking-wider text-zinc-600">
                        {inc.ref} · {inc.location.city} · {timeAgo(inc.updatedAt)}
                      </p>
                    </div>
                    <StatusBadge status={inc.status} size="sm" />
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      onClick={() => setIncidentState(inc.id, "approved")}
                      aria-pressed={state === "approved"}
                      aria-label={`Approve ${inc.ref}`}
                      className={cn(
                        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11.5px] font-medium transition-colors",
                        state === "approved"
                          ? "border-[#66bb6a]/30 bg-[#66bb6a]/10 text-[#8ee09a]"
                          : "border-white/10 text-zinc-400 hover:border-[#66bb6a]/30 hover:text-[#8ee09a]"
                      )}
                    >
                      <Check className="h-3 w-3" aria-hidden />
                      Approve
                    </button>
                    <button
                      onClick={() => setIncidentState(inc.id, "flagged")}
                      aria-pressed={state === "flagged"}
                      aria-label={`Flag ${inc.ref}`}
                      className={cn(
                        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11.5px] font-medium transition-colors",
                        state === "flagged"
                          ? "border-[#ef5350]/30 bg-[#ef5350]/10 text-[#fda4a0]"
                          : "border-white/10 text-zinc-400 hover:border-[#ef5350]/30 hover:text-[#fda4a0]"
                      )}
                    >
                      <Flag className="h-3 w-3" aria-hidden />
                      Flag
                    </button>
                    {state !== "none" && (
                      <span className="text-[11px] text-zinc-600">
                        {state === "approved" ? "Approved locally" : "Flagged locally"}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] text-zinc-600">
            Approve / Flag writes local demo state only — nothing is published.
          </p>
        </Panel>

        {/* ---------- Case overview ---------- */}
        <Panel title="Case overview" label="admin-cases" badge="DEMO DATA">
          <div className="max-h-80 overflow-y-auto sasi-scroll">
            <table className="w-full text-left text-[12.5px]">
              <caption className="sr-only">All cases with status and last update</caption>
              <thead>
                <tr className="border-b border-white/8 text-[10px] uppercase tracking-[0.12em] text-zinc-500">
                  <th scope="col" className="py-2 pr-3 font-semibold">Ref</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Title</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Status</th>
                  <th scope="col" className="py-2 text-right font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5 pr-3">
                      <button
                        onClick={() => openCase(c.ref)}
                        className="font-mono text-[11px] tracking-wider text-zinc-300 underline-offset-2 hover:text-white hover:underline"
                        aria-label={`Open case ${c.ref}`}
                      >
                        {c.ref}
                      </button>
                    </td>
                    <td className="max-w-40 py-2.5 pr-3">
                      <span className="block truncate text-zinc-200">{c.title}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <CaseStatusBadge status={c.status} />
                    </td>
                    <td className="py-2.5 text-right text-[11px] text-zinc-500">
                      {timeAgo(c.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* ---------- Users ---------- */}
        <Panel title="Users" label="admin-users" badge="DEMO">
          <ul className="space-y-2.5">
            {DEMO_USERS.map((u) => (
              <li
                key={u.email}
                className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/[0.015] p-3"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[11px] font-semibold text-zinc-200"
                  aria-hidden
                >
                  {u.initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-zinc-100">{u.name}</p>
                  <p className="truncate text-[11.5px] text-zinc-500">{u.email}</p>
                </div>
                <span
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-[0.1em]",
                    u.role === "operator"
                      ? "border-[#e3c567]/25 bg-[#e3c567]/8 text-[#efe0a8]"
                      : "border-white/8 bg-white/[0.03] text-zinc-400"
                  )}
                >
                  {u.role.toUpperCase()}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-600">
            <UsersIcon className="h-3 w-3" aria-hidden />
            Role management is part of a later phase.
          </p>
        </Panel>

        {/* ---------- Analytics ---------- */}
        <Panel title="Analytics" label="admin-analytics" badge="DEMO DATA — NO LIVE METRICS">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Cases" value={cases.length} className="p-3" />
            <StatTile label="Incidents" value={INCIDENTS.length} className="p-3" />
            <StatTile label="Sources" value={SOURCES.length} className="p-3" />
            <StatTile label="Evidence" value={EVIDENCE.length} className="p-3" />
          </div>
          <div className="mt-4">
            <p className="mb-3 flex items-center gap-1.5 text-[11px] text-zinc-500">
              <BarChart3 className="h-3 w-3" aria-hidden />
              Demo incidents per service
            </p>
            <ul className="space-y-2">
              {analytics.rows.map(([service, count]) => (
                <li key={service} className="flex items-center gap-3">
                  <span className="flex w-24 shrink-0 items-center gap-1.5 text-[11.5px] text-zinc-400">
                    <ServiceIcon service={service as ServiceKey} className="h-3 w-3" />
                    <span className="truncate">{SERVICES[service as ServiceKey]?.label ?? service}</span>
                  </span>
                  <span className="h-3 flex-1 overflow-hidden rounded-sm bg-white/5">
                    <span
                      className="block h-full rounded-sm bg-white/25"
                      style={{ width: `${Math.max(8, (count / analytics.max) * 100)}%` }}
                    />
                  </span>
                  <span className="w-6 text-right font-mono text-[11px] text-zinc-500">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        {/* ---------- Source management ---------- */}
        <Panel title="Source management" label="admin-sources" badge="DEMO DATA">
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1 sasi-scroll">
            {SOURCES.map((src) => (
              <li
                key={src.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.015] p-3"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium text-zinc-100">{src.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-zinc-500">{src.publisher}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[0.12em]",
                      src.sourceType === "OFFICIAL"
                        ? "bg-[#66bb6a]/10 text-[#8ee09a]"
                        : src.sourceType === "NEWS"
                          ? "bg-[#64b5f6]/10 text-[#a7d3f9]"
                          : "bg-white/6 text-zinc-400"
                    )}
                  >
                    {SOURCE_TYPE_LABEL[src.sourceType].toUpperCase()}
                  </span>
                  <StatusBadge status={src.verification} size="sm" />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        {/* ---------- System health ---------- */}
        <Panel title="System health" label="admin-health" badge="NO LIVE METRICS IN DEMO">
          <ul className="space-y-2.5">
            {[
              { label: "API latency", value: "—" },
              { label: "Ingestion", value: "paused (demo)" },
              { label: "Source crawlers", value: "—" },
              { label: "AI agent queue", value: "—" },
            ].map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.015] px-3.5 py-2.5"
              >
                <span className="flex items-center gap-2 text-[12.5px] text-zinc-300">
                  <ServerCog className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
                  {row.label}
                </span>
                <span className="font-mono text-[11.5px] text-zinc-500">{row.value}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-600">
            <Database className="h-3 w-3" aria-hidden />
            No live metrics in demo.
          </p>
        </Panel>

        {/* ---------- AI run monitoring ---------- */}
        <Panel title="AI run monitoring" label="admin-ai-runs" badge="DEMO">
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1 sasi-scroll">
            {cases.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.015] p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium text-zinc-100">{c.title}</p>
                  <p className="mt-0.5 font-mono text-[10px] tracking-wider text-zinc-600">
                    {c.ref} · updated {timeAgo(c.updatedAt)}
                  </p>
                </div>
                <AIStateChip state={c.aiState} className="shrink-0" />
              </li>
            ))}
          </ul>
        </Panel>

        {/* ---------- Audit logs ---------- */}
        <Panel title="Audit logs" label="admin-audit" badge="DEMO DATA" className="lg:col-span-2">
          <div className="max-h-96 overflow-y-auto pr-1 sasi-scroll" aria-label="Platform audit log">
            <div className="divide-y divide-white/5">
              {ACTIVITY.map((event) => (
                <ActivityRow key={event.id} event={event} />
              ))}
            </div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-600">
            <ActivityIcon className="h-3 w-3" aria-hidden />
            In production every AI and operator action is written to an append-only audit log.
          </p>
        </Panel>
      </div>

      <p className="mt-6 flex items-center gap-2 pb-4 text-[12px] text-zinc-600">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Admin foundation — panels are visual and local-state only in this demo.
      </p>
    </div>
  );
}
