"use client";

import { useMemo } from "react";
import { Bell, ChevronRight, Inbox, NotebookPen, Sparkles } from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { useT } from "@/lib/sasi/i18n";
import { timeAgo } from "@/lib/sasi/utils";
import type { SasiCase } from "@/lib/sasi/types";
import { cn } from "@/lib/utils";
import { NotificationRow } from "@/components/sasi/domain";
import { CityBriefingCard } from "@/components/sasi/briefing-card";
import {
  CaseStatusBadge,
  SectionLabel,
  ServiceIcon,
  SERVICE_TINT,
} from "@/components/sasi/primitives";

/* ============================================================
   DASHBOARD — a calm home that only ever shows what the user
   actually created. No demo dataset, no stat tiles, no sample
   incidents: greeting + two actions, then at most three quiet
   sections gated on real data (cases / briefing / unread
   notifications). Everything else is one honest empty state.
   ============================================================ */

type GreetingKey = "dash.greeting.morning" | "dash.greeting.afternoon" | "dash.greeting.evening";

/* greeting follows the user's real clock — not a demo timestamp */
function greetingKeyForNow(): GreetingKey {
  const h = new Date().getHours();
  if (h < 12) return "dash.greeting.morning";
  if (h < 17) return "dash.greeting.afternoon";
  return "dash.greeting.evening";
}

/* one honest status line, derived ONLY from the user's own cases */
function statusLine(cases: SasiCase[]): string {
  if (cases.length === 0) return "Nothing on your plate yet.";
  const active = cases.filter((c) => c.status !== "RESOLVED" && c.status !== "CLOSED");
  const waiting = cases.filter((c) => c.status === "ACTION_REQUIRED").length;
  if (active.length === 0) return "All caught up — no open reports.";
  const base =
    active.length === 1 ? "1 report is open" : `${active.length} reports are open`;
  if (waiting === 0) return `${base}.`;
  return waiting === 1
    ? `${base}, 1 is waiting for your approval.`
    : `${base}, ${waiting} are waiting for your approval.`;
}

/* ---------- quiet case row (no cards, no demo chrome) ---------- */

function CaseRow({ c, onOpen }: { c: SasiCase; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
      aria-label={`Open case ${c.ref}: ${c.title}`}
    >
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]",
          SERVICE_TINT[c.service]
        )}
      >
        <ServiceIcon service={c.service} className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium text-zinc-100">
          {c.title}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[10px] tracking-wider text-zinc-600">
          {c.ref} · updated {timeAgo(c.updatedAt)}
        </span>
      </span>
      <CaseStatusBadge status={c.status} />
      <ChevronRight
        className="h-3.5 w-3.5 shrink-0 text-zinc-700 transition-colors group-hover:text-zinc-400"
        aria-hidden
      />
    </button>
  );
}

/* ---------- the one premium empty state ---------- */

function NothingHereYet({ onReport }: { onReport: () => void }) {
  return (
    <section
      aria-label="Nothing here yet"
      className="sasi-card mt-10 flex flex-col items-center px-6 py-14 text-center"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03]">
        <Inbox className="h-5 w-5 text-zinc-400" aria-hidden />
      </div>
      <p className="sasi-serif mt-5 text-[16.5px] text-white">Nothing here yet</p>
      <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-zinc-500">
        Your reports, briefings and answers appear here once you create them —
        nothing is pre-filled.
      </p>
      <button
        onClick={onReport}
        className="sasi-btn-glass mt-6 flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-medium text-zinc-100"
      >
        <NotebookPen className="h-3.5 w-3.5" aria-hidden />
        Report an issue
      </button>
    </section>
  );
}

export default function DashboardView() {
  const navigate = useSasiStore((s) => s.navigate);
  const openCase = useSasiStore((s) => s.openCase);
  const markNotificationRead = useSasiStore((s) => s.markNotificationRead);
  const cases = useSasiStore((s) => s.cases);
  const briefing = useSasiStore((s) => s.briefing);
  const notifications = useSasiStore((s) => s.notifications);
  const accountName = useSasiStore((s) => s.accountName);
  const t = useT();

  const sortedCases = useMemo(
    () => [...cases].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [cases]
  );
  const unread = useMemo(() => notifications.filter((n) => !n.read), [notifications]);

  const hasData = cases.length > 0 || briefing !== null || unread.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      {/* ---------- greeting + the two primary actions ---------- */}
      <header>
        <h1 className="sasi-serif text-[24px] tracking-tight text-white sm:text-[27px]">
          {t(greetingKeyForNow())}, {accountName?.trim() ? accountName.trim() : "You"}.
        </h1>
        <p className="mt-1.5 text-[13.5px] text-zinc-500">{statusLine(cases)}</p>
        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => navigate("report")}
            className="sasi-btn-white-glass flex h-11 items-center gap-2 rounded-xl px-5 text-[13.5px] font-semibold"
          >
            <NotebookPen className="h-4 w-4" aria-hidden />
            Report an issue
          </button>
          <button
            onClick={() => navigate("ask-sasi")}
            className="sasi-btn-glass flex h-11 items-center gap-2 rounded-xl px-5 text-[13.5px] font-medium text-zinc-100"
          >
            <Sparkles className="h-4 w-4 text-[#e3c567]" aria-hidden />
            Ask SASI
          </button>
        </div>
      </header>

      {hasData ? (
        <div className="mt-10 space-y-8">
          {/* pinned briefing — only when one actually exists */}
          {briefing && <CityBriefingCard />}

          {/* recent cases — the user's own service intelligence */}
          {cases.length > 0 && (
            <section aria-label={t("dash.service-intelligence")}>
              <div className="flex items-center justify-between gap-2">
                <SectionLabel>{t("dash.service-intelligence")}</SectionLabel>
                <span className="font-mono text-[10px] tracking-wider text-zinc-600">
                  {cases.length} {t("dash.on-record")}
                </span>
              </div>
              <div className="sasi-card mt-3 overflow-hidden">
                <div className="sasi-scroll max-h-96 divide-y divide-white/[0.04] overflow-y-auto">
                  {sortedCases.slice(0, 8).map((c) => (
                    <CaseRow key={c.id} c={c} onOpen={() => openCase(c.ref)} />
                  ))}
                </div>
                <button
                  onClick={() => navigate("cases")}
                  className="block w-full border-t border-white/[0.05] py-2.5 text-center text-[12px] text-zinc-500 transition-colors hover:text-white"
                >
                  {t("dash.view-all-cases")}
                </button>
              </div>
            </section>
          )}

          {/* recent notifications — only when something is actually unread */}
          {unread.length > 0 && (
            <section aria-label={t("shell.notifications")}>
              <div className="flex items-center justify-between gap-2">
                <SectionLabel>{t("shell.notifications")}</SectionLabel>
                <span className="font-mono text-[10px] tracking-wider text-zinc-600">
                  {unread.length} UNREAD
                </span>
              </div>
              <div className="sasi-card mt-3 overflow-hidden">
                <div className="sasi-scroll max-h-80 divide-y divide-white/[0.04] overflow-y-auto">
                  {unread.slice(0, 6).map((n) => (
                    <NotificationRow
                      key={n.id}
                      n={n}
                      onOpen={() => {
                        markNotificationRead(n.id);
                        navigate("notifications");
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={() => navigate("notifications")}
                  className="block w-full border-t border-white/[0.05] py-2.5 text-center text-[12px] text-zinc-500 transition-colors hover:text-white"
                >
                  {t("shell.view-all-notifications")}
                </button>
              </div>
            </section>
          )}
        </div>
      ) : (
        <NothingHereYet onReport={() => navigate("report")} />
      )}
    </div>
  );
}
