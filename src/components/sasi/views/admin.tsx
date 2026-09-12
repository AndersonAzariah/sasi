"use client";

import { useMemo } from "react";
import {
  Activity as ActivityIcon,
  BarChart3,
  Inbox,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { SERVICES, timeAgo } from "@/lib/sasi/utils";
import type { ServiceKey } from "@/lib/sasi/types";
import {
  AIStateChip,
  CaseStatusBadge,
  SectionLabel,
  ServiceIcon,
  SERVICE_TINT,
  StatTile,
} from "@/components/sasi/primitives";
import { cn } from "@/lib/utils";

/* ============================================================
   ADMIN — real-data console.

   Every panel reads the resident's live session store. There is
   no demo dataset anywhere: users, moderation queues, audit logs,
   analytics and health panels that cannot be backed by real data
   were removed rather than faked.
   ============================================================ */

function Panel({
  title,
  label,
  children,
  className,
}: {
  title: string;
  label: string;
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
      </div>
      {children}
    </section>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-white/8 bg-white/[0.02] p-3.5">
      <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
      <p className="text-[12.5px] leading-relaxed text-zinc-500">{children}</p>
    </div>
  );
}

export default function AdminView() {
  const cases = useSasiStore((s) => s.cases);
  const evidence = useSasiStore((s) => s.evidence);
  const notifications = useSasiStore((s) => s.notifications);
  const openCase = useSasiStore((s) => s.openCase);
  const navigate = useSasiStore((s) => s.navigate);

  /* real per-service distribution, computed from the resident's own cases */
  const serviceRows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of cases) {
      counts.set(c.service, (counts.get(c.service) ?? 0) + 1);
    }
    const max = Math.max(1, ...counts.values());
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([service, count]) => ({ service, count, max }));
  }, [cases]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ---------- Header ---------- */}
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight text-white">Admin</h1>
        </div>
        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-[#e3c567]/20 bg-[#e3c567]/5 p-3.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#e3c567]" aria-hidden />
          <p className="text-[12.5px] leading-relaxed text-[#efe0a8]">
            This console reflects only real data from your session — no demo
            dataset exists. In production this area is role-protected.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* ---------- Case overview (real cases) ---------- */}
        <Panel title="Case overview" label="admin-cases">
          {cases.length === 0 ? (
            <EmptyHint>
              No cases yet. Every case here comes from a resident report —{" "}
              <button
                onClick={() => navigate("report")}
                className="font-medium text-[#efe0a8] underline-offset-2 hover:underline"
              >
                file the first report
              </button>
              .
            </EmptyHint>
          ) : (
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
          )}
        </Panel>

        {/* ---------- Session analytics (real counts only) ---------- */}
        <Panel title="Session analytics" label="admin-analytics">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Cases" value={cases.length} className="p-3" />
            <StatTile label="Evidence" value={evidence.length} className="p-3" />
            <StatTile label="Notifications" value={notifications.length} className="p-3" />
            <StatTile
              label="Unread"
              value={notifications.filter((n) => !n.read).length}
              className="p-3"
            />
          </div>
          {serviceRows.length > 0 && (
            <div className="mt-4">
              <p className="mb-3 flex items-center gap-1.5 text-[11px] text-zinc-500">
                <BarChart3 className="h-3 w-3" aria-hidden />
                Your cases per service
              </p>
              <ul className="space-y-2">
                {serviceRows.map(({ service, count, max }) => (
                  <li key={service} className="flex items-center gap-3">
                    <span className="flex w-24 shrink-0 items-center gap-1.5 text-[11.5px] text-zinc-400">
                      <ServiceIcon service={service as ServiceKey} className="h-3 w-3" />
                      <span className="truncate">{SERVICES[service as ServiceKey]?.label ?? service}</span>
                    </span>
                    <span className="h-3 flex-1 overflow-hidden rounded-sm bg-white/5">
                      <span
                        className="block h-full rounded-sm bg-white/25"
                        style={{ width: `${Math.max(8, (count / max) * 100)}%` }}
                      />
                    </span>
                    <span className="w-6 text-right font-mono text-[11px] text-zinc-500">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        {/* ---------- AI run monitoring (real aiState per case) ---------- */}
        <Panel title="AI run monitoring" label="admin-ai-runs" className="lg:col-span-2">
          {cases.length === 0 ? (
            <EmptyHint>
              No AI runs yet — investigations start when one of your cases is
              sent for investigation.
            </EmptyHint>
          ) : (
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
          )}
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-zinc-600">
            <ActivityIcon className="h-3 w-3" aria-hidden />
            Runs listed here belong to cases created in this session.
          </p>
        </Panel>
      </div>

      <p className="mt-6 flex items-center gap-2 pb-4 text-[12px] text-zinc-600">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Real data only — panels populate as residents report, upload and investigate.
      </p>
    </div>
  );
}
