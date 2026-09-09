"use client";

import { create } from "zustand";
import type {
  AppNotification,
  ChatMessage,
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

  /* ---- Ask SASI (LLM chat) ---- */
  chatMessages: ChatMessage[];
  chatBusy: boolean;
  /** question queued from the palette / other views — consumed by the chat view */
  pendingAsk: string | null;
  setPendingAsk: (q: string | null) => void;
  askSasi: (question: string) => Promise<void>;
  clearChat: () => void;
}

let caseCounter = 124;
let eventCounter = 100;

export const useSasiStore = create<SasiState>((set, get) => ({
  view: "landing",
  param: null,
  navigate: (view, param) =>
    set({
      view,
      param: param ?? null,
      commandOpen: false,
    }),

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
    const ref = `CASE-0001${caseCounter++}`.replace("00010", "0001").slice(0, 11);
    const finalRef = `CASE-${String(caseCounter - 1).padStart(6, "0")}`;
    const nowIso = new Date().toISOString();
    const id = `case-new-${caseCounter - 1}`;
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
    void ref;
    void DEMO_NOW;
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
  addEvidence: (item) => set((s) => ({ evidence: [item, ...s.evidence] })),

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
  setSavedLocation: (loc) =>
    set((s) => ({ savedLocation: { ...s.savedLocation, ...loc } })),

  /* ------------------------------------------------------------------
     Ask SASI — free-text civic assistant backed by /api/sasi/ask.
     The API carries the conversation server-side; here we only track
     visible messages + busy state. On failure the user gets an honest
     error bubble instead of a fabricated answer.
     ------------------------------------------------------------------ */
  chatMessages: [],
  chatBusy: false,
  pendingAsk: null,
  setPendingAsk: (q) => set({ pendingAsk: q }),
  clearChat: () => set({ chatMessages: [], pendingAsk: null }),
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
        }),
      });
      const data = (await res.json()) as { reply?: string; refs?: string[]; error?: string };
      if (!res.ok || !data.reply) throw new Error(data.error ?? "SASI could not answer right now.");
      set((s) => ({
        chatMessages: s.chatMessages.map((m) =>
          m.id === replyId
            ? { ...m, content: data.reply as string, refs: data.refs, state: "done" }
            : m
        ),
        chatBusy: false,
      }));
    } catch (err) {
      set((s) => ({
        chatMessages: s.chatMessages.map((m) =>
          m.id === replyId
            ? {
                ...m,
                content:
                  err instanceof Error && err.message
                    ? err.message
                    : "SASI could not reach the assistant service. Please try again.",
                state: "error",
              }
            : m
        ),
        chatBusy: false,
      }));
    }
  },
}));
