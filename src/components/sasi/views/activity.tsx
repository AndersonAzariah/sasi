"use client";

/* MY SASI — the resident's personal workspace (Task 28-c, Phase 11;
   this view keeps the "activity" route). One aggregate fetch on mount
   feeds every section: continue-journeys, saved items, SASI reminders,
   recent conversations and notifications. Every list is REAL — empty
   sections show honest empty states, never fabricated rows.

   Reminders are SASI-side only and are labelled as such: they are not
   from government and no official body is contacted through them. */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlarmClock,
  ArrowRight,
  Bell,
  BellOff,
  Bookmark,
  BookmarkX,
  CalendarDays,
  Check,
  FileText,
  MessageCircle,
  Plus,
  Radio,
  Route,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { INCIDENTS } from "@/lib/sasi/data";
import { useSasiStore } from "@/lib/sasi/store";
import { getSessionId } from "@/lib/sasi/utils";
import {
  journeyStepsFor,
  registryEntryByJourneyId,
  type ConversationDayDTO,
  type MySasiResponse,
  type ReminderDTO,
  type SavedItemDTO,
} from "@/lib/sasi/services-registry";
import type { NotificationKind, View } from "@/lib/sasi/types";
import { cn } from "@/lib/utils";
import { NotificationRow } from "@/components/sasi/domain";
import { EmptyState, GhostButton, SectionLabel, TrustNotice } from "@/components/sasi/primitives";

type LoadState = "loading" | "ready" | "error";

/** shape returned by GET /api/sasi/documents (metadata + analysis only) */
interface MyDocumentLite {
  id: string;
  name: string;
  createdAt: string;
  summary: string | null;
  analysisError: string | null;
}

const EMPTY: MySasiResponse = {
  activeJourneys: [],
  savedItems: [],
  reminders: [],
  recentConversations: [],
  recentNotifications: [],
};

function dayLabel(day: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

function dueLabel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  const formatted = d.toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  if (diffDays < 0) return `${formatted} · overdue`;
  if (diffDays === 0) return `${formatted} · today`;
  return formatted;
}

export default function ActivityView() {
  const navigate = useSasiStore((s) => s.navigate);
  const markNotificationRead = useSasiStore((s) => s.markNotificationRead);
  const openCase = useSasiStore((s) => s.openCase);
  const setPendingAsk = useSasiStore((s) => s.setPendingAsk);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [data, setData] = useState<MySasiResponse>(EMPTY);
  /* Documents section (Task 30 P6) — metadata + analysis only, never
     raw file contents; owned rows only via the session/account scope */
  const [documents, setDocuments] = useState<MyDocumentLite[]>([]);

  /* ---------- reminder create form ---------- */
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoadState("loading");
    try {
      const res = await fetch(`/api/sasi/mysasi?sessionId=${encodeURIComponent(getSessionId())}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as MySasiResponse;
      setData({
        activeJourneys: body.activeJourneys ?? [],
        savedItems: body.savedItems ?? [],
        reminders: body.reminders ?? [],
        recentConversations: body.recentConversations ?? [],
        recentNotifications: body.recentNotifications ?? [],
      });
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* documents load — best-effort alongside the aggregate; a failure
     keeps the section honestly empty (it never blocks the page) */
  useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(
          `/api/sasi/documents?sessionId=${encodeURIComponent(getSessionId())}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const body = (await res.json()) as { documents?: MyDocumentLite[] };
        setDocuments((body.documents ?? []).slice(0, 4));
      } catch {
        /* offline — leave the section empty */
      }
    };
    void run();
  }, []);

  /* ---------- saved: open / unsave ---------- */
  const openSaved = (item: SavedItemDTO) => {
    const p = item.payload;
    if (item.kind === "service" && (p?.slug || item.itemId)) {
      navigate("service-detail", p?.slug ?? item.itemId);
    } else if (item.kind === "journey" && (p?.journeyId || item.itemId)) {
      navigate("journey", p?.journeyId ?? item.itemId);
    } else if (item.kind === "answer" && p?.question) {
      setPendingAsk(p.question);
      navigate("ask-sasi");
    } else if (item.kind === "info" && p?.view) {
      navigate(p.view as View);
    }
  };

  const savedTarget = (item: SavedItemDTO): boolean => {
    const p = item.payload;
    if (item.kind === "service") return Boolean(p?.slug || item.itemId);
    if (item.kind === "journey") return Boolean(p?.journeyId || item.itemId);
    if (item.kind === "answer") return Boolean(p?.question);
    if (item.kind === "info") return Boolean(p?.view);
    return false;
  };

  const unsave = async (item: SavedItemDTO) => {
    const before = data.savedItems;
    setData((d) => ({ ...d, savedItems: d.savedItems.filter((i) => i.id !== item.id) }));
    try {
      const res = await fetch(
        `/api/sasi/save?sessionId=${encodeURIComponent(getSessionId())}&kind=${encodeURIComponent(
          item.kind
        )}&itemId=${encodeURIComponent(item.itemId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setData((d) => ({ ...d, savedItems: before }));
      toastHonest("SASI could not remove that just now. Please try again.");
    }
  };

  /* ---------- reminders ---------- */
  const createReminder = async () => {
    const title = reminderTitle.trim();
    if (!title) return;
    setCreating(true);
    try {
      const res = await fetch("/api/sasi/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: getSessionId(),
          title,
          dueAt: reminderDate ? new Date(`${reminderDate}T09:00:00`).toISOString() : undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { reminder?: ReminderDTO };
      if (body.reminder) {
        setData((d) => ({
          ...d,
          reminders: [body.reminder as ReminderDTO, ...d.reminders],
        }));
      }
      setReminderTitle("");
      setReminderDate("");
    } catch {
      toastHonest("SASI could not create that reminder just now. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const toggleReminder = async (r: ReminderDTO) => {
    const nextDone = !r.done;
    setData((d) => ({
      ...d,
      reminders: d.reminders
        .map((x) => (x.id === r.id ? { ...x, done: nextDone } : x))
        .sort((a, b) => Number(a.done) - Number(b.done)),
    }));
    try {
      const res = await fetch("/api/sasi/reminders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: getSessionId(), id: r.id, done: nextDone }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setData((d) => ({
        ...d,
        reminders: d.reminders
          .map((x) => (x.id === r.id ? { ...x, done: r.done } : x))
          .sort((a, b) => Number(a.done) - Number(b.done)),
      }));
      toastHonest("SASI could not update that reminder just now. Please try again.");
    }
  };

  const deleteReminder = async (r: ReminderDTO) => {
    const before = data.reminders;
    setData((d) => ({ ...d, reminders: d.reminders.filter((x) => x.id !== r.id) }));
    try {
      const res = await fetch(
        `/api/sasi/reminders?sessionId=${encodeURIComponent(getSessionId())}&id=${encodeURIComponent(r.id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      setData((d) => ({ ...d, reminders: before }));
      toastHonest("SASI could not delete that reminder just now. Please try again.");
    }
  };

  const pendingReminders = useMemo(() => data.reminders.filter((r) => !r.done), [data.reminders]);
  const doneReminders = useMemo(() => data.reminders.filter((r) => r.done), [data.reminders]);

  /* ---------- notifications: same ref logic the notifications view uses ---------- */
  const knownMapRef = (caseRef?: string, body?: string): string | undefined => {
    const ref = caseRef ?? /INC-\d{4,6}/.exec(body ?? "")?.[0] ?? null;
    if (!ref) return undefined;
    if (!caseRef) {
      return INCIDENTS.some(
        (i) => i.ref.toLowerCase() === ref.toLowerCase() || i.id === ref.toLowerCase()
      )
        ? ref
        : undefined;
    }
    return ref;
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ---------- Header ---------- */}
      <header>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-white">My SASI</h1>
          <span className="font-mono text-[10.5px] tracking-wider text-zinc-600">
            YOUR WORKSPACE · SAVED IN SASI ONLY
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-zinc-500">
          Everything you have started, saved and asked — journeys in progress, saved services,
          your own reminders, recent conversations and notifications about your own data.
        </p>
      </header>

      {/* ---------- Global load state ---------- */}
      {loadState === "error" ? (
        <div className="mt-6">
          <EmptyState
            icon={ShieldAlert}
            title="My SASI could not be loaded"
            description="SASI could not reach your workspace just now. Nothing was lost — your journeys, saves and reminders live in your session on the server."
            action={<GhostButton onClick={() => void load()}>Try again</GhostButton>}
          />
        </div>
      ) : (
        <>
          {/* ============================================================ CONTINUE */}
          <section className="mt-8" aria-labelledby="mysasi-continue-heading">
            <SectionLabel className="sasi-eyebrow mb-3">Continue</SectionLabel>
            <h2 id="mysasi-continue-heading" className="sr-only">
              Journeys in progress
            </h2>
            {loadState === "loading" ? (
              <SkeletonList rows={2} />
            ) : data.activeJourneys.length === 0 ? (
              <EmptyState
                icon={Route}
                title="Nothing in progress"
                description="No journeys have been started yet. Guided checklists for passports, IDs, grants and more live in Service journeys."
                action={<GhostButton onClick={() => navigate("journeys")}>Browse journeys</GhostButton>}
              />
            ) : (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {data.activeJourneys.map((run) => {
                  const entry = registryEntryByJourneyId(run.journeyId);
                  const title = run.payload?.title ?? entry?.title ?? run.journeyId;
                  const totalSteps = journeyStepsFor(run.journeyId)?.length ?? 0;
                  return (
                    <li key={run.journeyId}>
                      <button
                        onClick={() => navigate("journey", run.journeyId)}
                        className="sasi-card sasi-card-interactive group flex w-full items-center gap-3.5 p-4 text-left"
                        aria-label={`Resume the ${title} journey`}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03]">
                          <Route className="h-5 w-5 text-zinc-300" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium text-white">
                            {title}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-zinc-500">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1",
                                run.status === "PAUSED" ? "text-zinc-500" : "text-[#efe0a8]"
                              )}
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full",
                                  run.status === "PAUSED" ? "bg-zinc-500" : "sasi-breathe bg-[#e3c567]"
                                )}
                                aria-hidden
                              />
                              {run.status === "PAUSED" ? "Paused" : "In progress"}
                            </span>
                            {totalSteps > 0 ? (
                              <span>
                                · {run.stepsDone.length}/{totalSteps} steps done
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <ArrowRight
                          className="h-4 w-4 shrink-0 text-zinc-700 transition-all group-hover:translate-x-0.5 group-hover:text-[#e3c567]"
                          aria-hidden
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ============================================================ SAVED */}
          <section className="mt-10" aria-labelledby="mysasi-saved-heading">
            <SectionLabel className="sasi-eyebrow mb-3">Saved</SectionLabel>
            <h2 id="mysasi-saved-heading" className="sr-only">
              Saved services and answers
            </h2>
            {loadState === "loading" ? (
              <SkeletonList rows={2} />
            ) : data.savedItems.length === 0 ? (
              <EmptyState
                icon={Bookmark}
                title="Nothing saved yet"
                description="Save a service from its page and it will be waiting here — a SASI bookmark only, never a link to any government account."
              />
            ) : (
              <ul
                role="list"
                className="sasi-card sasi-scroll max-h-96 divide-y divide-white/[0.04] overflow-y-auto"
              >
                {data.savedItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]">
                      <Bookmark className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-zinc-100">
                        {item.payload?.title ?? item.itemId}
                      </span>
                      <span className="text-[11px] capitalize text-zinc-600">
                        Saved {item.kind} · in SASI only
                      </span>
                    </span>
                    {savedTarget(item) ? (
                      <button
                        onClick={() => openSaved(item)}
                        className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2.5 text-[12px] font-medium text-zinc-300 transition-colors hover:text-white"
                        aria-label={`Open saved ${item.kind} ${item.payload?.title ?? item.itemId}`}
                      >
                        Open
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    ) : null}
                    <button
                      onClick={() => void unsave(item)}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-2.5 text-zinc-600 transition-colors hover:text-[#ef5350]"
                      aria-label={`Remove ${item.payload?.title ?? item.itemId} from saved`}
                    >
                      <BookmarkX className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ============================================================ REMINDERS */}
          <section className="mt-10" aria-labelledby="mysasi-reminders-heading">
            <SectionLabel className="sasi-eyebrow mb-3">Reminders</SectionLabel>
            <h2 id="mysasi-reminders-heading" className="sr-only">
              SASI reminders
            </h2>
            <TrustNotice className="mb-3">
              SASI reminders are created and stored in SASI only — they are not from government and
              nobody is contacted through them.
            </TrustNotice>

            {/* inline create */}
            <form
              className="sasi-card flex flex-col gap-2 p-4 sm:flex-row sm:items-center"
              onSubmit={(e) => {
                e.preventDefault();
                void createReminder();
              }}
            >
              <label className="sr-only" htmlFor="mysasi-reminder-title">
                Reminder title
              </label>
              <input
                id="mysasi-reminder-title"
                value={reminderTitle}
                onChange={(e) => setReminderTitle(e.target.value)}
                placeholder="e.g. Collect Smart ID receipt"
                maxLength={200}
                className="h-11 min-h-[44px] flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[13px] text-white placeholder:text-zinc-600 focus:border-white/25 focus:outline-none"
              />
              <label className="sr-only" htmlFor="mysasi-reminder-date">
                Reminder date (optional)
              </label>
              <input
                id="mysasi-reminder-date"
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className="h-11 min-h-[44px] rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[13px] text-zinc-300 focus:border-white/25 focus:outline-none [color-scheme:dark]"
              />
              <button
                type="submit"
                disabled={creating || reminderTitle.trim().length === 0}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-4 text-[12.5px] font-medium text-white transition-colors hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {creating ? "Adding…" : "Add reminder"}
              </button>
            </form>

            {loadState === "loading" ? (
              <div className="mt-3">
                <SkeletonList rows={2} />
              </div>
            ) : data.reminders.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  icon={AlarmClock}
                  title="No reminders yet"
                  description="Add a reminder above — for example the date you plan to visit a Home Affairs office. It lives in SASI only."
                />
              </div>
            ) : (
              <ul
                role="list"
                className="sasi-card sasi-scroll mt-3 max-h-96 divide-y divide-white/[0.04] overflow-y-auto"
              >
                {[...pendingReminders, ...doneReminders].map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => void toggleReminder(r)}
                      aria-pressed={r.done}
                      aria-label={r.done ? `Mark "${r.title}" not done` : `Mark "${r.title}" done`}
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors",
                        r.done
                          ? "border-[#66bb6a]/40 bg-[#66bb6a]/15 text-[#66bb6a]"
                          : "border-white/15 text-transparent hover:border-white/35"
                      )}
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate text-[13px] font-medium",
                          r.done ? "text-zinc-500 line-through" : "text-zinc-100"
                        )}
                      >
                        {r.title}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-600">
                        <span className="font-mono uppercase tracking-wider">SASI reminder</span>
                        {r.dueAt ? (
                          <span className={cn(!r.done && r.dueAt && isOverdue(r.dueAt) && "text-[#fda4a0]")}>
                            · <CalendarDays className="inline h-3 w-3" aria-hidden /> {dueLabel(r.dueAt)}
                          </span>
                        ) : null}
                        <span>· not from government</span>
                      </span>
                    </span>
                    <button
                      onClick={() => void deleteReminder(r)}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-lg px-2.5 text-zinc-600 transition-colors hover:text-[#ef5350]"
                      aria-label={`Delete reminder "${r.title}"`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ============================================================ DOCUMENTS */}
          <section className="mt-10" aria-labelledby="mysasi-documents-heading">
            <SectionLabel className="sasi-eyebrow mb-3">Documents</SectionLabel>
            <h2 id="mysasi-documents-heading" className="sr-only">
              Recent document analyses
            </h2>
            {loadState === "loading" ? (
              <SkeletonList rows={2} />
            ) : documents.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No document analyses yet"
                description="Upload a municipal bill, letter or notice and SASI explains what it says — analysis happens on your document only."
                action={
                  <GhostButton onClick={() => navigate("documents")}>
                    Open Documents
                  </GhostButton>
                }
              />
            ) : (
              <ul className="sasi-card divide-y divide-white/[0.04]">
                {documents.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]">
                      <FileText className="h-4 w-4 text-zinc-400" aria-hidden />
                    </span>
                    <button
                      onClick={() => navigate("documents")}
                      className="min-w-0 flex-1 text-left"
                      aria-label={`Open ${d.name} in Documents`}
                    >
                      <span className="block truncate text-[13px] font-medium text-zinc-100">
                        {d.name}
                      </span>
                      <span className="mt-0.5 block truncate text-[11.5px] text-zinc-600">
                        {d.analysisError
                          ? d.analysisError
                          : d.summary
                            ? d.summary
                            : "Analysis unavailable — details in Documents."}
                      </span>
                    </button>
                    <ArrowRight
                      className="h-3.5 w-3.5 shrink-0 text-zinc-700"
                      aria-hidden
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ============================================================ RECENT CONVERSATIONS */}
          <section className="mt-10" aria-labelledby="mysasi-chat-heading">
            <SectionLabel className="sasi-eyebrow mb-3">Recent conversations</SectionLabel>
            <h2 id="mysasi-chat-heading" className="sr-only">
              Recent Ask SASI conversations
            </h2>
            {loadState === "loading" ? (
              <SkeletonList rows={2} />
            ) : data.recentConversations.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="No conversations yet"
                description="Your Ask SASI conversations about your own cases and services will be listed here."
                action={
                  <GhostButton
                    onClick={() => {
                      setPendingAsk(null);
                      navigate("ask-sasi");
                    }}
                  >
                    Open Ask SASI
                  </GhostButton>
                }
              />
            ) : (
              <ul
                role="list"
                className="sasi-card sasi-scroll max-h-96 divide-y divide-white/[0.04] overflow-y-auto"
              >
                {data.recentConversations.map((day: ConversationDayDTO) => {
                  const first = day.messages[0];
                  return (
                    <li key={day.day}>
                      <button
                        onClick={() => {
                          setPendingAsk(null);
                          navigate("ask-sasi");
                        }}
                        className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#e3c567]/40"
                        aria-label={`Open your Ask SASI conversation from ${dayLabel(day.day)} in Ask SASI`}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]">
                          <MessageCircle className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium text-zinc-100">
                            {dayLabel(day.day)}
                            <span className="ml-2 font-mono text-[10px] text-zinc-600">
                              {day.messages.length} MESSAGE{day.messages.length === 1 ? "" : "S"}
                            </span>
                          </span>
                          {first ? (
                            <span className="mt-0.5 block truncate text-[12px] text-zinc-500">
                              {first.content}
                            </span>
                          ) : null}
                        </span>
                        <span className="hidden shrink-0 items-center gap-1 text-[11.5px] text-zinc-600 transition-colors group-hover:text-zinc-300 sm:inline-flex">
                          Continue
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* ============================================================ NOTIFICATIONS */}
          <section className="mt-10 pb-8" aria-labelledby="mysasi-ntf-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <SectionLabel className="sasi-eyebrow">Notifications</SectionLabel>
              <button
                onClick={() => navigate("notifications")}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-zinc-400 transition-colors hover:text-white"
              >
                <Bell className="h-3.5 w-3.5" aria-hidden />
                See all
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
            <h2 id="mysasi-ntf-heading" className="sr-only">
              Recent notifications about your own data
            </h2>
            {loadState === "loading" ? (
              <SkeletonList rows={2} />
            ) : data.recentNotifications.length === 0 ? (
              <EmptyState
                icon={BellOff}
                title="No notifications yet"
                description="Notifications appear only when something happens on your own data — a report received, an investigation finished, a briefing ready. Nothing is invented."
              />
            ) : (
              <div
                role="list"
                aria-label="Recent notifications"
                className="sasi-card sasi-scroll max-h-96 divide-y divide-white/[0.04] overflow-y-auto"
              >
                {data.recentNotifications.map((n) => {
                  const mapRef = knownMapRef(n.caseRef, n.body);
                  return (
                    <NotificationRow
                      key={n.id}
                      n={{
                        id: n.id,
                        kind: n.kind as NotificationKind,
                        title: n.title,
                        body: n.body,
                        at: n.at,
                        read: n.read,
                        caseRef: n.caseRef,
                      }}
                      mapRef={mapRef}
                      onOpen={() => {
                        markNotificationRead(n.id);
                        if (n.caseRef) openCase(n.caseRef);
                      }}
                      onViewOnMap={
                        mapRef
                          ? () => {
                              markNotificationRead(n.id);
                              navigate("map", mapRef);
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            )}
            <p className="mt-3 flex items-center gap-1.5 px-1 text-[11.5px] text-zinc-600">
              <Radio className="h-3.5 w-3.5" aria-hidden />
              Live events on your own reports and investigations only — SASI never sends official
              government notices.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

/* ---------- small local helpers ---------- */

function isOverdue(iso: string): boolean {
  const due = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(due);
  target.setHours(0, 0, 0, 0);
  return target.getTime() < today.getTime();
}

/** Honest toast — sonner is already mounted by the app shell. */
function toastHonest(message: string): void {
  toast.error(message);
}

function SkeletonList({ rows }: { rows: number }) {
  return (
    <div className="space-y-2" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="sasi-card h-[64px] animate-pulse p-4" />
      ))}
    </div>
  );
}
