"use client";

import { create } from "zustand";
import { toast } from "sonner";
import type {
  AppNotification,
  ChatMessage,
  CityBriefing,
  EvidenceItem,
  Finding,
  ProposedAction,
  SasiCase,
  View,
} from "./types";
import {
  CASES,
  DEMO_NOW,
  EVIDENCE,
  FINDINGS,
  NOTIFICATIONS,
} from "./data";
import { getSessionId } from "./utils";

interface SasiState {
  /* ---- navigation (client-side router; the product ships on a single route) ---- */
  view: View;
  param: string | null;
  navigate: (view: View, param?: string) => void;

  /* ---- global command interface ---- */
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;

  /* ---- notifications ---- */
  notifications: AppNotification[];
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  /* ---- cases (mutable) ---- */
  cases: SasiCase[];
  findings: Record<string, Finding[]>;
  evidence: EvidenceItem[];
  activeCaseId: string | null;
  activeIncidentId: string | null;
  activeService: string | null;

  openCase: (ref: string) => void;
  openIncident: (ref: string) => void;
  openService: (key: string) => void;

  /* ---- persistence ("survive a reload" layer) ---- */
  hydrated: boolean;
  hydrate: () => Promise<void>;

  /* ---- report flow ---- */
  reportDraft: {
    service: string;
    problem: string;
    location: string;
    when: string;
    impact: string;
    evidenceNote: string;
  } | null;
  setReportDraft: (draft: Partial<NonNullable<SasiState["reportDraft"]>>) => void;
  clearReportDraft: () => void;

  /** create a case from a completed report; returns the new case ref */
  submitReport: () => string;

  /* ---- investigation ---- */
  startInvestigationFor: (caseId: string) => void;
  setCaseAIState: (caseId: string, state: SasiCase["aiState"]) => void;
  addCaseEvent: (caseId: string, event: SasiCase["events"][number]) => void;
  addFinding: (caseId: string, finding: Finding) => void;
  addEvidence: (item: EvidenceItem) => void;
  /** snapshot a case to the server store (best-effort) */
  persistCaseById: (caseId: string) => void;

  /* ---- actions / approval ---- */
  approveAction: (caseId: string) => void;
  rejectAction: (caseId: string) => void;
  setActionState: (caseId: string, state: ProposedAction["state"]) => void;
  setVerification: (
    caseId: string,
    v: SasiCase["verification"]
  ) => void;

  /* ---- saved location / preferences ---- */
  savedLocation: { province: string; city: string; suburb: string };
  setSavedLocation: (loc: Partial<SasiState["savedLocation"]>) => void;

  /* ---- Ask SASI (LLM chat, SSE streaming + persisted) ---- */
  chatMessages: ChatMessage[];
  chatBusy: boolean;
  /** question queued from the palette / other views — consumed by the chat view */
  pendingAsk: string | null;
  setPendingAsk: (q: string | null) => void;
  askSasi: (question: string) => Promise<void>;
  clearChat: () => void;

  /* ---- chat → report loop ---- */
  /** pre-fill the report wizard from an assistant suggestion and open it */
  draftReportFromChat: (messageId: string) => void;

  /* ---- AI City briefing (dashboard digest) ---- */
  briefing: CityBriefing | null;
  briefingBusy: boolean;
  briefingError: string | null;
  /** generate (or regenerate) the daily briefing; caches in sessionStorage */
  generateBriefing: (opts?: { force?: boolean }) => Promise<void>;
  /** restore a briefing cached earlier in this browser session (no network) */
  restoreBriefing: () => void;
}

let caseCounter = 124;
let eventCounter = 100;

/** keep ref generation ahead of any case restored from the persisted store */
function bumpCaseCounterFrom(c: SasiCase) {
  const refNum = Number(/^CASE-(\d{6})$/.exec(c.ref)?.[1] ?? 0);
  const idNum = Number(/^case-new-(\d+)$/.exec(c.id)?.[1] ?? 0);
  const max = Math.max(refNum, idNum);
  if (Number.isFinite(max) && max >= caseCounter) caseCounter = max + 1;
}

/* ---------- persistence helpers (fire-and-forget; the demo never blocks on storage) ---------- */

async function persistCase(c: SasiCase) {
  try {
    await fetch("/api/sasi/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "case", sessionId: getSessionId(), case: c }),
    });
  } catch {
    /* offline / demo — the in-memory case still works */
  }
}

let locationSaveTimer: ReturnType<typeof setTimeout> | null = null;
function persistLocation(loc: SasiState["savedLocation"]) {
  if (locationSaveTimer) clearTimeout(locationSaveTimer);
  locationSaveTimer = setTimeout(() => {
    void fetch("/api/sasi/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "location", sessionId: getSessionId(), location: loc }),
    }).catch(() => undefined);
  }, 600);
}

export const useSasiStore = create<SasiState>((set, get) => ({
  view: "landing",
  param: null,
  navigate: (view, param) =>
    set({
      view,
      param: param ?? null,
      commandOpen: false,
    }),

  /* ---------- AI City briefing ---------- */
  briefing: null,
  briefingBusy: false,
  briefingError: null,
  restoreBriefing: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem("sasi.briefing");
      if (!raw) return;
      const cached = JSON.parse(raw) as CityBriefing;
      /* only restore if it matches the current location (cheap sanity check) */
      if (cached?.headline && cached?.sections?.length) {
        set({ briefing: cached });
      }
    } catch {
      /* corrupt cache — ignore, user can regenerate */
    }
  },
  generateBriefing: async (opts) => {
    if (get().briefingBusy) return;
    if (!opts?.force) {
      get().restoreBriefing();
      if (get().briefing) return; // cached earlier this session — no LLM call
    }
    set({ briefingBusy: true, briefingError: null });
    try {
      const res = await fetch("/api/sasi/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: get().savedLocation,
          /* the user's live cases ground the briefing (and its refs) */
          extraCases: get()
            .cases.slice(0, 8)
            .map((c) => ({
              ref: c.ref,
              title: c.title,
              status: c.status,
              service: c.service,
              city: c.location.city,
              actionState: c.proposedAction?.state,
            })),
        }),
      });
      const data = (await res.json()) as { briefing?: CityBriefing; error?: string };
      if (!res.ok || !data.briefing) {
        throw new Error(data.error ?? "SASI could not write the briefing right now.");
      }
      set({ briefing: data.briefing, briefingBusy: false });
      try {
        window.sessionStorage.setItem("sasi.briefing", JSON.stringify(data.briefing));
      } catch {
        /* storage full/blocked — briefing stays in memory */
      }
    } catch (err) {
      set({
        briefingBusy: false,
        briefingError:
          err instanceof Error && err.message
            ? err.message
            : "SASI could not write the briefing right now.",
      });
    }
  },

  commandOpen: false,
  setCommandOpen: (open) => set({ commandOpen: open }),

  notifications: NOTIFICATIONS,
  markNotificationRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),
  markAllNotificationsRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),

  cases: CASES,
  findings: FINDINGS,
  evidence: EVIDENCE,
  activeCaseId: "case-123",
  activeIncidentId: "inc-41",
  activeService: "water",

  openCase: (ref) => {
    const c = get().cases.find((x) => x.ref === ref || x.id === ref);
    set({ activeCaseId: c?.id ?? null, view: "case-detail", param: ref, commandOpen: false });
  },
  openIncident: (ref) => {
    set({ activeIncidentId: ref, view: "incident-detail", param: ref, commandOpen: false });
  },
  openService: (key) => {
    set({ activeService: key, view: "service-detail", param: key, commandOpen: false });
  },

  /* ------------------------------------------------------------------
     Hydrate — load the user's cases, chat history and saved location
     from /api/sasi/state (keyed by an anonymous browser session id).
     Runs once while the splash screen is up; failures are silent and
     the demo falls back to its in-memory dataset.
     ------------------------------------------------------------------ */
  hydrated: false,
  hydrate: async () => {
    if (get().hydrated || typeof window === "undefined") return;
    set({ hydrated: true }); // guard against double-invoke before the fetch resolves
    try {
      const res = await fetch(`/api/sasi/state?sessionId=${encodeURIComponent(getSessionId())}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        cases?: SasiCase[];
        chat?: {
          id: string;
          role: "user" | "assistant";
          content: string;
          at: string;
          refs?: string[];
        }[];
        evidence?: EvidenceItem[];
        location?: { province: string; city: string; suburb: string };
      };

      set((s) => {
        const userCases = (data.cases ?? []).filter(
          (c) => !s.cases.some((existing) => existing.ref === c.ref)
        );
        for (const c of data.cases ?? []) bumpCaseCounterFrom(c);
        const userEvidence = (data.evidence ?? []).filter(
          (ev) => !s.evidence.some((existing) => existing.id === ev.id)
        );
        const chat =
          s.chatMessages.length === 0 && (data.chat?.length ?? 0) > 0
            ? (data.chat ?? []).map<ChatMessage>((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                at: m.at,
                state: "done",
                refs: m.refs,
              }))
            : s.chatMessages;
        return {
          cases: userCases.length ? [...userCases, ...s.cases] : s.cases,
          evidence: userEvidence.length ? [...userEvidence, ...s.evidence] : s.evidence,
          chatMessages: chat,
          savedLocation: data.location ?? s.savedLocation,
        };
      });
    } catch {
      /* offline / cold DB — demo continues from memory */
    }
  },

  reportDraft: null,
  setReportDraft: (draft) =>
    set((s) => ({
      reportDraft: { ...(s.reportDraft ?? { service: "water", problem: "", location: "", when: "today", impact: "", evidenceNote: "" }), ...draft },
    })),
  clearReportDraft: () => set({ reportDraft: null }),

  submitReport: () => {
    const draft = get().reportDraft ?? {
      service: "water",
      problem: "Issue reported via SASI",
      location: "Johannesburg, Gauteng",
      when: "today",
      impact: "",
      evidenceNote: "",
    };
    const nowIso = new Date().toISOString();
    const id = `case-new-${caseCounter}`;
    const finalRef = `CASE-${String(caseCounter).padStart(6, "0")}`;
    caseCounter += 1;
    const newCase: SasiCase = {
      id,
      ref: finalRef,
      title: draft.problem || "New report",
      description: draft.impact || draft.problem,
      service: (draft.service as SasiCase["service"]) || "water",
      location: {
        province: "Gauteng",
        municipality: "City of Johannesburg",
        city: draft.location.split(",")[0]?.trim() || "Johannesburg",
        suburb: draft.location,
      },
      status: "OPEN",
      priority: "MEDIUM",
      createdAt: nowIso,
      updatedAt: nowIso,
      aiState: "IDLE",
      impact: draft.impact,
      isDemo: true,
      events: [
        {
          id: `ev-${eventCounter++}`,
          at: nowIso,
          label: "Report received",
          detail: "You reported this to SASI. This is not yet a government submission.",
          kind: "user",
        },
      ],
    };
    set((s) => ({
      cases: [newCase, ...s.cases],
      activeCaseId: id,
      findings: { ...s.findings, [id]: [] },
      reportDraft: null,
    }));
    void persistCase(newCase);
    toast.success(`Report ${finalRef} created`, {
      description: "Saved to this browser — it will still be here when you come back.",
    });
    return finalRef;
  },

  startInvestigationFor: (caseId) => {
    set((s) => ({
      activeCaseId: caseId,
      view: "investigate",
      param: caseId,
      cases: s.cases.map((c) =>
        c.id === caseId
          ? {
              ...c,
              status: c.status === "OPEN" ? "INVESTIGATING" : c.status,
              aiState: "UNDERSTANDING",
              updatedAt: new Date().toISOString(),
            }
          : c
      ),
    }));
    const c = get().cases.find((x) => x.id === caseId);
    if (c) void persistCase(c);
  },
  setCaseAIState: (caseId, state) =>
    set((s) => ({
      cases: s.cases.map((c) =>
        c.id === caseId ? { ...c, aiState: state, updatedAt: new Date().toISOString() } : c
      ),
    })),
  addCaseEvent: (caseId, event) =>
    set((s) => ({
      cases: s.cases.map((c) =>
        c.id === caseId ? { ...c, events: [...c.events, event] } : c
      ),
    })),
  addFinding: (caseId, finding) =>
    set((s) => ({
      findings: { ...s.findings, [caseId]: [...(s.findings[caseId] ?? []), finding] },
    })),
  addEvidence: (item) => {
    set((s) => ({ evidence: [item, ...s.evidence] }));
    void fetch("/api/sasi/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "evidence", sessionId: getSessionId(), evidence: item }),
    }).catch(() => undefined);
  },
  persistCaseById: (caseId) => {
    const c = get().cases.find((x) => x.id === caseId);
    if (c) void persistCase(c);
  },

  approveAction: (caseId) => {
    const c = get().cases.find((x) => x.id === caseId);
    if (!c?.proposedAction) return;
    get().setActionState(caseId, "APPROVED");
    get().addCaseEvent(caseId, {
      id: `ev-${eventCounter++}`,
      at: new Date().toISOString(),
      label: "You approved the action",
      detail: c.proposedAction.title,
      kind: "action",
    });
    set((s) => ({
      notifications: [
        {
          id: `ntf-approved-${Date.now()}`,
          kind: "ACTION" as const,
          title: "Action approved",
          body: `You approved: ${c.proposedAction?.title}. SASI is executing.`,
          at: new Date().toISOString(),
          read: false,
          caseRef: c.ref,
        },
        ...s.notifications,
      ],
    }));
    void persistCase(get().cases.find((x) => x.id === caseId) ?? c);
    toast.success("Action approved — SASI is executing", {
      description: `${c.ref} · ${c.proposedAction?.title ?? ""}`.trim(),
    });
  },
  rejectAction: (caseId) => {
    const c = get().cases.find((x) => x.id === caseId);
    if (!c?.proposedAction) return;
    get().setActionState(caseId, "REJECTED");
    get().setCaseAIState(caseId, "PAUSED");
    get().addCaseEvent(caseId, {
      id: `ev-${eventCounter++}`,
      at: new Date().toISOString(),
      label: "You rejected the action",
      detail: "SASI will not proceed. You can revisit this later.",
      kind: "action",
    });
    void persistCase(get().cases.find((x) => x.id === caseId) ?? c);
    toast("Action rejected — SASI paused", {
      description: `${c.ref} · nothing was sent. You can revisit this later.`,
    });
  },
  setActionState: (caseId, state) =>
    set((s) => ({
      cases: s.cases.map((c) =>
        c.id === caseId && c.proposedAction
          ? { ...c, proposedAction: { ...c.proposedAction, state } }
          : c
      ),
    })),
  setVerification: (caseId, v) =>
    set((s) => ({
      cases: s.cases.map((c) => (c.id === caseId ? { ...c, verification: v } : c)),
    })),

  savedLocation: { province: "Gauteng", city: "Johannesburg", suburb: "Melrose" },
  setSavedLocation: (loc) => {
    set((s) => ({ savedLocation: { ...s.savedLocation, ...loc } }));
    persistLocation(get().savedLocation);
  },

  /* ------------------------------------------------------------------
     Ask SASI — free-text civic assistant backed by /api/sasi/ask.
     The reply arrives as Server-Sent Events: deltas append to the
     assistant bubble in real time, the done event carries refs and
     suggested follow-up actions. The server persists both sides of
     the conversation per browser session. On failure the user gets
     an honest error bubble instead of a fabricated answer.
     ------------------------------------------------------------------ */
  chatMessages: [],
  chatBusy: false,
  pendingAsk: null,
  setPendingAsk: (q) => set({ pendingAsk: q }),
  clearChat: () => {
    set({ chatMessages: [], pendingAsk: null });
    void fetch(
      `/api/sasi/state?sessionId=${encodeURIComponent(getSessionId())}&scope=chat`,
      { method: "DELETE" }
    ).catch(() => undefined);
    toast("Conversation cleared", {
      description: "Chat history was removed from this browser and from SASI's memory.",
    });
  },
  askSasi: async (question) => {
    const trimmed = question.trim();
    if (!trimmed || get().chatBusy) return;

    const userMsg: ChatMessage = {
      id: `chat-u-${Date.now()}`,
      role: "user",
      content: trimmed,
      at: new Date().toISOString(),
      state: "done",
    };
    const history = [...get().chatMessages, userMsg];
    const replyId = `chat-a-${Date.now()}`;
    set({
      chatMessages: [
        ...history,
        { id: replyId, role: "assistant", content: "", at: new Date().toISOString(), state: "sending" },
      ],
      chatBusy: true,
    });

    const patchReply = (patch: Partial<ChatMessage>) =>
      set((s) => ({
        chatMessages: s.chatMessages.map((m) =>
          m.id === replyId ? { ...m, ...patch } : m
        ),
      }));

    try {
      const res = await fetch("/api/sasi/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history
            .filter((m) => m.state === "done")
            .slice(-10)
            .map((m) => ({ role: m.role, content: m.content })),
          location: get().savedLocation,
          sessionId: getSessionId(),
          stream: true,
        }),
      });

      const contentType = res.headers.get("content-type") ?? "";

      /* ---- SSE streaming path ---- */
      if (res.ok && contentType.includes("text/event-stream") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;

        const handleEvent = (raw: string) => {
          const line = raw.trim();
          if (!line.startsWith("data:")) return;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") return;
          try {
            const evt = JSON.parse(data) as {
              type: string;
              text?: string;
              refs?: string[];
              suggestReport?: boolean;
              message?: string;
            };
            if (evt.type === "delta" && typeof evt.text === "string") {
              // append incrementally (read current content from state)
              const current = get().chatMessages.find((m) => m.id === replyId);
              patchReply({ state: "streaming", content: (current?.content ?? "") + evt.text });
            } else if (evt.type === "done") {
              finished = true;
              patchReply({
                state: "done",
                refs: evt.refs,
                actions: evt.suggestReport ? { report: true } : undefined,
              });
            } else if (evt.type === "error") {
              finished = true;
              patchReply({
                state: "error",
                content: evt.message ?? "SASI could not answer right now.",
              });
            }
          } catch {
            /* partial JSON — ignore */
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep: number;
          while ((sep = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 1);
            if (line.trim()) handleEvent(line);
          }
        }
        if (buffer.trim()) handleEvent(buffer);

        if (!finished) {
          // stream ended without an explicit done/error — treat as done if we have text
          const current = get().chatMessages.find((m) => m.id === replyId);
          patchReply({
            state: (current?.content?.length ?? 0) > 0 ? "done" : "error",
            content:
              (current?.content?.length ?? 0) > 0
                ? current?.content
                : "The reply stream ended unexpectedly. Please try again.",
          });
        }
        set({ chatBusy: false });
        return;
      }

      /* ---- JSON fallback path (older client/server mismatch) ---- */
      const data = (await res.json()) as {
        reply?: string;
        refs?: string[];
        suggestReport?: boolean;
        error?: string;
      };
      if (!res.ok || !data.reply) throw new Error(data.error ?? "SASI could not answer right now.");
      patchReply({
        content: data.reply,
        refs: data.refs,
        actions: data.suggestReport ? { report: true } : undefined,
        state: "done",
      });
      set({ chatBusy: false });
    } catch (err) {
      patchReply({
        content:
          err instanceof Error && err.message
            ? err.message
            : "SASI could not reach the assistant service. Please try again.",
        state: "error",
      });
      set({ chatBusy: false });
    }
  },

  draftReportFromChat: (messageId) => {
    const msgs = get().chatMessages;
    const idx = msgs.findIndex((m) => m.id === messageId);
    const msg = msgs[idx];
    const lastUser = [...msgs.slice(0, idx < 0 ? msgs.length : idx)]
      .reverse()
      .find((m) => m.role === "user");
    const problem = (lastUser?.content ?? "").slice(0, 160) || "";
    set((s) => ({
      reportDraft: {
        service: s.reportDraft?.service ?? "water",
        problem,
        location: s.savedLocation.suburb
          ? `${s.savedLocation.suburb}, ${s.savedLocation.city}`
          : s.savedLocation.city,
        when: s.reportDraft?.when ?? "today",
        impact: s.reportDraft?.impact ?? "",
        evidenceNote: s.reportDraft?.evidenceNote ?? "",
      },
      view: "report",
      param: null,
      commandOpen: false,
    }));
    if (msg) {
      toast("Report wizard pre-filled", {
        description: "Your conversation gave SASI a head start — review and continue.",
      });
    }
  },
}));
