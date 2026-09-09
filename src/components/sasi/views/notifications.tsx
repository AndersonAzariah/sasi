"use client";

import { useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  ArrowRight,
  BellOff,
  CheckCheck,
  Newspaper,
  Radio,
} from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import type { NotificationKind } from "@/lib/sasi/types";
import { cn } from "@/lib/utils";
import { NotificationRow } from "@/components/sasi/domain";
import { DemoBadge, EmptyState, GhostButton } from "@/components/sasi/primitives";
import { timeAgo } from "@/lib/sasi/utils";

type NtfFilter = "ALL" | "CASE" | "INVESTIGATION" | "ACTION" | "UPDATE";

const FILTERS: { key: NtfFilter; label: string; kinds: NotificationKind[] }[] = [
  {
    key: "ALL",
    label: "All",
    kinds: ["CASE", "INVESTIGATION", "ACTION", "UPDATE", "SYSTEM"],
  },
  { key: "CASE", label: "Cases", kinds: ["CASE"] },
  { key: "INVESTIGATION", label: "Investigations", kinds: ["INVESTIGATION"] },
  { key: "ACTION", label: "Actions", kinds: ["ACTION"] },
  { key: "UPDATE", label: "Updates", kinds: ["UPDATE", "SYSTEM"] },
];

export default function NotificationsView() {
  const notifications = useSasiStore((s) => s.notifications);
  const markNotificationRead = useSasiStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useSasiStore((s) => s.markAllNotificationsRead);
  const openCase = useSasiStore((s) => s.openCase);
  const navigate = useSasiStore((s) => s.navigate);
  const cases = useSasiStore((s) => s.cases);
  const briefing = useSasiStore((s) => s.briefing);
  const setPendingAsk = useSasiStore((s) => s.setPendingAsk);

  const [filter, setFilter] = useState<NtfFilter>("ALL");

  const unread = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const counts = useMemo(() => {
    const c: Record<NtfFilter, number> = {
      ALL: notifications.length,
      CASE: 0,
      INVESTIGATION: 0,
      ACTION: 0,
      UPDATE: 0,
    };
    for (const n of notifications) {
      if (n.kind === "CASE") c.CASE += 1;
      else if (n.kind === "INVESTIGATION") c.INVESTIGATION += 1;
      else if (n.kind === "ACTION") c.ACTION += 1;
      else c.UPDATE += 1; /* UPDATE + SYSTEM */
    }
    return c;
  }, [notifications]);

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter);
    return f ? notifications.filter((n) => f.kinds.includes(n.kind)) : notifications;
  }, [notifications, filter]);

  /* ---------- live digest numbers (real app state, not seed data) ---------- */
  const liveCount = useMemo(
    () => notifications.filter((n) => n.live).length,
    [notifications]
  );
  const userCaseCount = useMemo(
    () => cases.filter((c) => c.id.startsWith("case-new")).length,
    [cases]
  );
  const lastLive = useMemo(
    () => notifications.find((n) => n.live) ?? null,
    [notifications]
  );

  const RISK_PILL: Record<string, string> = {
    CALM: "border-[#66bb6a]/25 bg-[#66bb6a]/[0.08] text-[#a5d6a7]",
    ELEVATED: "border-[#e3c567]/25 bg-[#e3c567]/[0.08] text-[#efe0a8]",
    STRAINED: "border-[#ffa726]/25 bg-[#ffa726]/[0.08] text-[#ffcc80]",
    CRITICAL: "border-[#ef5350]/30 bg-[#ef5350]/[0.1] text-[#fda4a0]",
  };

  const askAboutDigest = () => {
    setPendingAsk(
      "Summarise what changed for me today: my reports, investigations and city briefing. What needs my attention first?"
    );
    navigate("ask-sasi");
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ---------- Header ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Notifications
            </h1>
            <DemoBadge />
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
                unread > 0
                  ? "border-[#e3c567]/25 bg-[#e3c567]/8 text-[#efe0a8]"
                  : "border-white/8 bg-white/[0.03] text-zinc-500"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  unread > 0 ? "sasi-breathe bg-[#e3c567]" : "bg-zinc-600"
                )}
                aria-hidden
              />
              {unread} unread
            </span>
          </div>
          <p className="mt-1 text-[13px] text-zinc-500">
            Approvals, findings and updates about your cases.
          </p>
        </div>
        <GhostButton onClick={markAllNotificationsRead} disabled={unread === 0}>
          <CheckCheck className="h-3.5 w-3.5" aria-hidden />
          Mark all read
        </GhostButton>
      </div>

      {/* ---------- live digest strip (real state, not demo copy) ---------- */}
      <div className="sasi-card mt-5 overflow-hidden">
        <div className="flex flex-wrap items-stretch gap-px bg-white/[0.04]">
          <div className="flex min-w-[150px] flex-1 flex-col gap-0.5 bg-[#0b0c0e] px-4 py-3">
            <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
              <Radio className="h-3 w-3 text-[#e3c567]" aria-hidden />
              Live events
            </p>
            <p className="font-mono text-lg tabular-nums text-white">{liveCount}</p>
            <p className="truncate text-[11px] text-zinc-600">
              {lastLive ? `Latest: ${timeAgo(lastLive.at)}` : "Nothing yet this session"}
            </p>
          </div>
          <div className="flex min-w-[150px] flex-1 flex-col gap-0.5 bg-[#0b0c0e] px-4 py-3">
            <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
              <ActivityIcon className="h-3 w-3 text-[#64b5f6]" aria-hidden />
              Your reports
            </p>
            <p className="font-mono text-lg tabular-nums text-white">{userCaseCount}</p>
            <p className="truncate text-[11px] text-zinc-600">Created through this browser</p>
          </div>
          <div className="flex min-w-[170px] flex-1 flex-col gap-0.5 bg-[#0b0c0e] px-4 py-3">
            <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
              <Newspaper className="h-3 w-3 text-[#66bb6a]" aria-hidden />
              City briefing
            </p>
            {briefing ? (
              <p
                className={cn(
                  "inline-flex w-fit items-center rounded-md border px-1.5 py-0.5 text-[10.5px] font-medium",
                  RISK_PILL[briefing.risk] ?? RISK_PILL.ELEVATED
                )}
              >
                {briefing.risk.charAt(0) + briefing.risk.slice(1).toLowerCase()}
              </p>
            ) : (
              <p className="text-[12px] text-zinc-500">Not written yet</p>
            )}
            <p className="truncate text-[11px] text-zinc-600">
              {briefing ? timeAgo(briefing.generatedAt) : "Opens on the dashboard"}
            </p>
          </div>
          <button
            onClick={askAboutDigest}
            className="group flex min-w-[190px] flex-1 items-center justify-between gap-2 bg-[#0b0c0e] px-4 py-3 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e3c567]/50"
            aria-label="Ask SASI what changed today and what needs attention"
          >
            <span className="min-w-0">
              <span className="block text-[9.5px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                Ask SASI
              </span>
              <span className="mt-1 block text-[12.5px] font-medium leading-snug text-zinc-200 transition-colors group-hover:text-white">
                What changed today?
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-zinc-600">
                Digest of your reports and briefings
              </span>
            </span>
            <ArrowRight
              className="h-4 w-4 shrink-0 text-zinc-700 transition-all group-hover:translate-x-0.5 group-hover:text-[#e3c567]"
              aria-hidden
            />
          </button>
        </div>
      </div>

      {/* ---------- Segmented filter ---------- */}
      <div
        role="group"
        aria-label="Filter notifications"
        className="mt-5 flex flex-wrap items-center gap-1 rounded-xl border border-white/8 bg-white/[0.02] p-1"
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={active}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                active
                  ? "bg-white/8 text-white"
                  : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300"
              )}
            >
              {f.label}
              <span
                className={cn(
                  "ml-1.5 font-mono text-[10px]",
                  active ? "text-zinc-400" : "text-zinc-600"
                )}
              >
                {counts[f.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* ---------- List ---------- */}
      {filtered.length === 0 ? (
        <EmptyState
          className="mt-5"
          icon={BellOff}
          title="You're all caught up."
          description="No notifications in this category. New signals about your cases will appear here."
        />
      ) : (
        <>
          <div
            role="list"
            aria-label="Notifications"
            className="sasi-card mt-5 divide-y divide-white/[0.04] overflow-hidden"
          >
            {filtered.map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onOpen={() => {
                  markNotificationRead(n.id);
                  if (n.caseRef) openCase(n.caseRef);
                }}
              />
            ))}
          </div>
          {unread === 0 && (
            <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-zinc-600">
              <CheckCheck className="h-3.5 w-3.5" aria-hidden />
              All caught up — every notification has been read.
            </p>
          )}
        </>
      )}
    </div>
  );
}
