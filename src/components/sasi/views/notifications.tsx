"use client";

import { useMemo, useState } from "react";
import { BellOff, CheckCheck } from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import type { NotificationKind } from "@/lib/sasi/types";
import { cn } from "@/lib/utils";
import { NotificationRow } from "@/components/sasi/domain";
import { DemoBadge, EmptyState, GhostButton } from "@/components/sasi/primitives";

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
