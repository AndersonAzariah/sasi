"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CloudCheck,
  Copy,
  Eraser,
  FilePlus2,
  FileWarning,
  Lightbulb,
  MapPin,
  MessageCircleQuestion,
  MessageSquareText,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSasiStore } from "@/lib/sasi/store";
import { toast } from "sonner";
import type { ChatMessage } from "@/lib/sasi/types";
import { RichText } from "../rich-text";
import { SasiLogo } from "../primitives";

/* ============================================================
   ASK SASI — free-text civic assistant (LLM-backed, grounded only
   in what you provide). Built to stay SIMPLE: big touch targets,
   one obvious send button, honest errors, stop/retry when the
   answer is not right.
   ============================================================ */

const SUGGESTIONS: {
  icon: typeof Sparkles;
  q: string;
  hint: string;
  /** national accent — light tints only, never paint */
  accent: "red" | "blue" | "green" | "gold" | "plain";
}[] = [
  {
    icon: MessageCircleQuestion,
    q: "Why is my water off?",
    hint: "Outages · faults · next steps",
    accent: "blue",
  },
  {
    icon: Zap,
    q: "Is load-shedding affecting my area, and what can I do?",
    hint: "Electricity · preparedness",
    accent: "gold",
  },
  {
    icon: ScrollText,
    q: "What is the status of my case?",
    hint: "Your cases · explained",
    accent: "green",
  },
  {
    icon: FileWarning,
    q: "How do I report a burst pipe to Joburg Water?",
    hint: "Official pathways",
    accent: "red",
  },
  {
    icon: ShieldCheck,
    q: "What can SASI actually do for me?",
    hint: "Capabilities · limits",
    accent: "plain",
  },
  {
    icon: MapPin,
    q: "Which municipality handles streetlights in Johannesburg?",
    hint: "Service directory",
    accent: "blue",
  },
];

const ACCENT_TILE: Record<string, string> = {
  red: "border-[#ef5350]/25 bg-[#ef5350]/[0.08] text-[#f08c88]",
  blue: "border-[#64b5f6]/25 bg-[#64b5f6]/[0.08] text-[#a7d3f5]",
  green: "border-[#66bb6a]/25 bg-[#66bb6a]/[0.08] text-[#9ccc9f]",
  gold: "border-[#e3c567]/25 bg-[#e3c567]/[0.08] text-[#e3c567]",
  plain: "border-white/10 bg-white/[0.04] text-zinc-400",
};

const MAX_INPUT = 500;

/* ============================================================
   FOLLOW-UP QUICK REPLIES — after SASI answers, offer three
   contextual next questions. Picked locally (topic heuristics on
   the answer text) so it is instant, free and private; the seed
   rotates per answer so two answers in a row never show the
   exact same chips.
   ============================================================ */

const FOLLOW_UP_POOL: {
  /** match any of these (case-insensitive) in the user question OR SASI answer */
  match: RegExp;
  qs: string[];
}[] = [
  {
    match: /\b(water|outage|burst|pipe|tap|leak|reservoir|pressure)\b/i,
    qs: [
      "How long do water outages usually take to fix?",
      "Who do I call about a burst pipe?",
      "How do I store water safely during an outage?",
      "How do I report a water fault to the municipality?",
    ],
  },
  {
    match: /\b(electricity|power|load.?shed|eskom|outage stage| prepaid |meter)\b/i,
    qs: [
      "How do I prepare for load-shedding?",
      "How do I protect my appliances during outages?",
      "Where do I report a streetlight outage?",
    ],
  },
  {
    match: /\b(CASE-\d{6}|case|report|investigat|evidence|status)\b/i,
    qs: [
      "What is the status of my case?",
      "What happens after SASI investigates?",
      "Can I add evidence to an existing case?",
    ],
  },
  {
    match: /\b(bill|account|payment|tariff|charge|municipal account)\b/i,
    qs: [
      "How do I query a municipal bill?",
      "Where is my nearest municipal walk-in centre?",
    ],
  },
  {
    match: /\b(road|pothole|traffic light|streetlight|sidewalk|storm drain)\b/i,
    qs: [
      "Who fixes potholes in Johannesburg?",
      "How do I report a broken traffic light?",
    ],
  },
  {
    match: /\b(10111|10177|emergency|danger|safety|crime)\b/i,
    qs: ["What counts as a real emergency?", "Which number do I call for an ambulance?"],
  },
];

/** always-available fillers, least topic-specific last */
const FOLLOW_UP_DEFAULTS = [
  "What can SASI actually do for me?",
  "How do I start a new report?",
  "Which municipality handles streetlights?",
  "How does SASI verify its findings?",
];

function pickFollowUps(lastUser: string, lastAnswer: string, seed: number): string[] {
  const hay = `${lastUser} ${lastAnswer}`;
  const seen = new Set<string>();
  const norm = (q: string) => q.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  const asked = norm(lastUser);
  const out: string[] = [];
  const push = (q: string) => {
    const n = norm(q);
    if (seen.has(n) || n === asked) return;
    if (out.some((x) => norm(x) === n)) return;
    seen.add(n);
    out.push(q);
  };
  /* topic matches first — most specific pool wins */
  for (const t of FOLLOW_UP_POOL) {
    if (t.match.test(hay)) {
      /* seed rotates the starting index so answers vary their chips */
      for (let i = 0; i < t.qs.length && out.length < 3; i++) {
        push(t.qs[(i + seed) % t.qs.length]);
      }
    }
    if (out.length >= 3) break;
  }
  for (const q of FOLLOW_UP_DEFAULTS) {
    if (out.length >= 3) break;
    push(q);
  }
  return out.slice(0, 3);
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/* ---------- typing indicator ---------- */

function TypingDots() {
  return (
    <span className="flex items-center gap-1" aria-label="SASI is typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-zinc-500"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2.5, 0] }}
          transition={{ duration: 1.05, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

/* ---------- message row: user ---------- */

function UserMessage({ msg }: { msg: ChatMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col items-end gap-1"
    >
      <div className="max-w-[85%] rounded-xl rounded-tr-sm border border-white/12 bg-gradient-to-b from-white/[0.09] to-white/[0.05] px-3.5 py-2.5 text-[13px] leading-relaxed text-zinc-100 shadow-sm shadow-black/30 sm:max-w-[70%]">
        {msg.content}
      </div>
      <span className="pr-1 text-[9.5px] tabular-nums text-zinc-700">
        {formatTime(msg.at)}
      </span>
    </motion.div>
  );
}

/* ---------- message row: assistant ---------- */

function AssistantMessage({
  msg,
  onRef,
  onDraftReport,
  onRetry,
}: {
  msg: ChatMessage;
  onRef: (ref: string) => void;
  onDraftReport: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const isError = msg.state === "error";
  const isStreaming = msg.state === "streaming" || msg.state === "sending";
  const isDone = msg.state === "done" && !isError && msg.content.trim().length > 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — ignore */
    }
  };

  const rate = (v: "up" | "down") => {
    const next = feedback === v ? null : v;
    setFeedback(next);
    if (next) {
      toast("Thanks — noted on this device.", { duration: 1800 });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
      className="group/msg flex gap-2.5"
    >
      <div
        className={cn(
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
          isError
            ? "border-[#ef5350]/30 bg-[#ef5350]/10 text-[#ef5350]"
            : "border-[#e3c567]/25 bg-[#e3c567]/10 text-[#e3c567] sasi-glow-soft"
        )}
        aria-hidden
      >
        {isError ? <AlertTriangle className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
      </div>

      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "sasi-card rounded-xl rounded-tl-sm px-3.5 py-2.5 text-[13px] leading-relaxed text-zinc-300",
            isError && "border-[#ef5350]/25 bg-[#ef5350]/[0.04] text-[#fda4a0]",
            isStreaming && "border-[#e3c567]/20"
          )}
        >
          {msg.state === "sending" && !msg.content ? (
            <div className="flex h-5 items-center">
              <TypingDots />
            </div>
          ) : (
            <div className="inline">
              <RichText content={msg.content} onRef={onRef} />
              {isStreaming && msg.content && <span className="sasi-caret" aria-hidden />}
            </div>
          )}
        </div>

        {msg.state === "done" && !isError && msg.actions?.report && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              onClick={() => onDraftReport(msg.id)}
              className="group/chip flex h-7 items-center gap-1.5 rounded-full border border-[#e3c567]/30 bg-[#e3c567]/[0.08] pl-2 pr-2.5 text-[11px] font-medium text-[#e3c567] transition hover:border-[#e3c567]/55 hover:bg-[#e3c567]/[0.14]"
              aria-label="Draft a report from this conversation"
            >
              <FilePlus2 className="h-3 w-3 transition group-hover/chip:scale-110" aria-hidden />
              Draft a report from this
            </button>
          </div>
        )}

        {isError && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              onClick={() => onRetry(msg.id)}
              className="flex h-7 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-2.5 text-[11px] font-medium text-zinc-300 transition hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
              aria-label="Ask SASI again"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Try again
            </button>
          </div>
        )}

        {isDone && (
          <div className="mt-1 flex items-center gap-2">
            <button
              onClick={copy}
              className="flex h-6 items-center gap-1 rounded px-1.5 text-[10.5px] text-zinc-600 transition hover:bg-white/[0.05] hover:text-zinc-300 focus-visible:text-zinc-300 sm:opacity-0 sm:group-hover/msg:opacity-100"
              aria-label="Copy answer"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-[#66bb6a]" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copy
                </>
              )}
            </button>
            <span className="hidden h-3 w-px bg-white/8 sm:block" aria-hidden />
            <div className="flex items-center gap-0.5 sm:opacity-0 sm:transition sm:group-hover/msg:opacity-100">
              <button
                onClick={() => rate("up")}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded transition hover:bg-white/[0.06]",
                  feedback === "up" ? "text-[#66bb6a]" : "text-zinc-600 hover:text-zinc-300"
                )}
                aria-label="Helpful answer"
                aria-pressed={feedback === "up"}
                title="Noted on this device"
              >
                <ThumbsUp className="h-3 w-3" aria-hidden />
              </button>
              <button
                onClick={() => rate("down")}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded transition hover:bg-white/[0.06]",
                  feedback === "down" ? "text-[#ef5350]" : "text-zinc-600 hover:text-zinc-300"
                )}
                aria-label="Not helpful"
                aria-pressed={feedback === "down"}
                title="Noted on this device"
              >
                <ThumbsDown className="h-3 w-3" aria-hidden />
              </button>
            </div>
            <span className="text-[9.5px] tabular-nums text-zinc-700">
              {formatTime(msg.at)}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ============================================================
   VIEW
   ============================================================ */

export default function AskSasiView() {
  const chatMessages = useSasiStore((s) => s.chatMessages);
  const chatBusy = useSasiStore((s) => s.chatBusy);
  const askSasi = useSasiStore((s) => s.askSasi);
  const stopSasi = useSasiStore((s) => s.stopSasi);
  const pendingAsk = useSasiStore((s) => s.pendingAsk);
  const setPendingAsk = useSasiStore((s) => s.setPendingAsk);
  const clearChat = useSasiStore((s) => s.clearChat);
  const openCase = useSasiStore((s) => s.openCase);
  const openIncident = useSasiStore((s) => s.openIncident);
  const navigate = useSasiStore((s) => s.navigate);
  const savedLocation = useSasiStore((s) => s.savedLocation);
  const draftReportFromChat = useSasiStore((s) => s.draftReportFromChat);
  const briefingBusy = useSasiStore((s) => s.briefingBusy);
  const briefingFromChat = useSasiStore((s) => s.briefingFromChat);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const consumedPending = useRef(false);
  const [showJump, setShowJump] = useState(false);

  /* consume a question queued from the command palette */
  useEffect(() => {
    if (pendingAsk && !consumedPending.current) {
      consumedPending.current = true;
      const q = pendingAsk;
      setPendingAsk(null);
      void askSasi(q);
    }
  }, [pendingAsk, setPendingAsk, askSasi]);

  /* keep the newest message in view — also follows live streaming growth */
  const lastAssistantLen =
    chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === "assistant"
      ? chatMessages[chatMessages.length - 1].content.length
      : 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [chatMessages.length, chatBusy, lastAssistantLen]);

  /* auto-grow the composer textarea (1 → ~5 lines) */
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [input]);

  const send = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || chatBusy) return;
    setInput("");
    void askSasi(q);
  };

  /* Enter sends · Shift+Enter makes a new line */
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const onRef = (ref: string) => {
    if (ref.startsWith("CASE-")) openCase(ref);
    else openIncident(ref);
  };

  /* ---------- follow-up quick replies ----------
     Show three contextual next questions once the newest answer is
     complete. Seeded from the answer id so consecutive answers
     rotate their chips instead of repeating the same three. */
  const followUps = useMemo(() => {
    if (chatBusy || chatMessages.length === 0) return [];
    const last = chatMessages[chatMessages.length - 1];
    if (last.role !== "assistant" || last.state !== "done" || !last.content.trim()) {
      return [];
    }
    const prevUser = [...chatMessages].reverse().find((m) => m.role === "user");
    let seed = 0;
    for (const ch of last.id) seed = (seed * 31 + ch.charCodeAt(0)) % 997;
    return pickFollowUps(prevUser?.content ?? "", last.content, seed);
  }, [chatMessages, chatBusy]);

  /* honest retry: re-ask the question that produced this failed reply */
  const retry = (msgId: string) => {
    if (chatBusy) return;
    const idx = chatMessages.findIndex((m) => m.id === msgId);
    for (let i = idx - 1; i >= 0; i--) {
      const m = chatMessages[i];
      if (m.role === "user" && m.content.trim()) {
        void askSasi(m.content);
        return;
      }
    }
  };

  const empty = chatMessages.length === 0;

  /* the reverse link needs a real answer to distil: ≥1 user ask + 1 done reply */
  const canDistil = useMemo(() => {
    const done = chatMessages.filter((m) => m.state === "done" && m.content.trim());
    return done.some((m) => m.role === "user") && done.some((m) => m.role === "assistant");
  }, [chatMessages]);

  const distil = () => {
    if (briefingBusy) return;
    toast("SASI is distilling this conversation…", {
      description: "Your dashboard briefing card will update when it is ready.",
    });
    void briefingFromChat();
  };

  const nearLimit = input.length > MAX_INPUT - 80;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-5 sm:px-6 lg:px-8">
      {/* fixed-height flex column: topbar 3.5rem + pt-5 + bottom clearance */}
      <div className="flex min-h-0 flex-col max-lg:h-[calc(100vh_-_3.5rem_-_1.25rem_-_6rem)] max-lg:supports-[height:100dvh]:h-[calc(100dvh_-_3.5rem_-_1.25rem_-_6rem)] lg:h-[calc(100vh_-_3.5rem_-_1.25rem_-_2rem)] lg:supports-[height:100dvh]:h-[calc(100dvh_-_3.5rem_-_1.25rem_-_2rem)]">
        {/* ---------- header ---------- */}
        <header className="flex shrink-0 items-center gap-3 pb-4">
          <div
            className="sasi-ambient left-1/2 top-1/2 h-10 w-10 shrink-0 -translate-x-1/2 -translate-y-1/2"
            style={{
              background:
                "radial-gradient(circle, rgba(227,197,103,0.18), transparent 70%)",
            }}
            aria-hidden
          />
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e3c567]/25 bg-[#e3c567]/10">
            <Sparkles className="h-[18px] w-[18px] text-[#e3c567]" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[15px] font-semibold text-white">Ask SASI</h1>
              {chatBusy && (
                <span className="flex items-center gap-1.5 rounded-full border border-[#e3c567]/20 bg-[#e3c567]/[0.06] px-2 py-0.5 text-[10px] font-medium text-[#e3c567]">
                  <TypingDots />
                  Thinking
                </span>
              )}
            </div>
            <p className="truncate text-[11.5px] text-zinc-500">
              Answers are AI-assisted — unverified. Grounded only in what you provide.
            </p>
          </div>
          <button
            onClick={() => navigate("settings")}
            className="hidden h-8 items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 text-[11.5px] text-zinc-400 transition hover:border-white/15 hover:text-zinc-200 sm:flex"
            aria-label="Saved location"
          >
            <MapPin className="h-3 w-3 text-zinc-500" aria-hidden />
            {savedLocation.city}
          </button>
          <span
            className="hidden h-8 items-center gap-1.5 rounded-lg border border-[#66bb6a]/20 bg-[#66bb6a]/[0.06] px-2.5 text-[11px] text-[#8fd694] md:flex"
            title="Chat history, reports and your location are saved for this browser"
          >
            <CloudCheck className="h-3.5 w-3.5" aria-hidden />
            Saved
          </span>
          {!empty && (
            <button
              onClick={distil}
              disabled={briefingBusy || !canDistil}
              className={cn(
                "sasi-chip-brief flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11.5px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
                canDistil && !briefingBusy
                  ? "border-[#64b5f6]/30 bg-[#64b5f6]/[0.08] text-[#a7d3f5]"
                  : "border-white/8 bg-white/[0.02] text-zinc-500"
              )}
              aria-label="Distil this conversation into a dashboard briefing"
              title={
                canDistil
                  ? "Summarise this conversation as a briefing on your dashboard"
                  : "Ask SASI something first — then distil the answer"
              }
            >
              {briefingBusy ? (
                <motion.span
                  className="h-3 w-3 rounded-full border-[1.5px] border-[#64b5f6]/30 border-t-[#64b5f6]"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                  aria-hidden
                />
              ) : (
                <MessageSquareText className="h-3.5 w-3.5" aria-hidden />
              )}
              <span className="hidden sm:inline">
                {briefingBusy ? "Distilling…" : "Summarise as briefing"}
              </span>
            </button>
          )}
          {!empty && (
            <button
              onClick={clearChat}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 text-[11.5px] text-zinc-400 transition hover:border-white/15 hover:text-zinc-200"
              aria-label="Clear conversation"
            >
              <Eraser className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </header>

        {/* ---------- conversation ---------- */}
        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            role="log"
            aria-label="SASI conversation"
            aria-live="polite"
            onScroll={(e) => {
              const el = e.currentTarget;
              setShowJump(el.scrollHeight - el.scrollTop - el.clientHeight > 260);
            }}
            className="sasi-scroll absolute inset-0 min-h-0 overflow-y-auto pb-3"
          >
            {empty ? (
              <div className="flex min-h-full flex-col items-center justify-center pb-28 pt-6">
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="flex flex-col items-center text-center"
                >
                  <div className="relative">
                    <div
                      className="sasi-ambient left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2"
                      style={{
                        background:
                          "radial-gradient(circle, rgba(227,197,103,0.16), rgba(100,181,246,0.08) 55%, transparent 75%)",
                      }}
                      aria-hidden
                    />
                    <div className="sasi-glow-soft relative overflow-hidden rounded-2xl border border-[#e3c567]/25">
                      <SasiLogo size={56} withWordmark={false} />
                    </div>
                  </div>
                  <h2 className="mt-4 text-[16px] font-semibold text-white">
                    What is happening around you?
                  </h2>
                  <p className="mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-zinc-500">
                    Ask about outages, municipal services, or your cases. SASI answers with
                    sources — and never contacts an authority without your approval.
                  </p>
                </motion.div>

                <div className="mt-7 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s, i) => (
                    <motion.button
                      key={s.q}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 + i * 0.05, duration: 0.3, ease: "easeOut" }}
                      onClick={() => send(s.q)}
                      className="sasi-card group flex min-h-[52px] items-start gap-2.5 p-3 text-left"
                      aria-label={`Ask: ${s.q}`}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition",
                          ACCENT_TILE[s.accent]
                        )}
                      >
                        <s.icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[12.5px] font-medium text-zinc-200 group-hover:text-white">
                          {s.q}
                        </span>
                        <span className="mt-0.5 block text-[10.5px] text-zinc-600">{s.hint}</span>
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              /* pb-14: last elements (follow-up chips) must scroll clear of
                 the floating summarise pill + composer hint row */
              <div className="space-y-5 pb-14">
                {/* today divider */}
                <div className="flex items-center gap-3 pt-1" aria-hidden>
                  <span className="h-px flex-1 bg-white/6" />
                  <span className="text-[9.5px] font-medium uppercase tracking-[0.14em] text-zinc-700">
                    Today
                  </span>
                  <span className="h-px flex-1 bg-white/6" />
                </div>
                {chatMessages.map((m) =>
                  m.role === "user" ? (
                    <UserMessage key={m.id} msg={m} />
                  ) : (
                    <AssistantMessage
                      key={m.id}
                      msg={m}
                      onRef={onRef}
                      onDraftReport={draftReportFromChat}
                      onRetry={retry}
                    />
                  )
                )}
                <AnimatePresence>
                  {chatBusy && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-2 pl-1 text-[11px] text-zinc-600"
                    >
                      <Lightbulb />
                      {lastAssistantLen > 0
                        ? "SASI is answering live — you can keep reading while it streams."
                        : "SASI is checking public information and your case context…"}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* follow-up quick replies — contextual, one tap to continue */}
                <AnimatePresence>
                  {followUps.length > 0 && !chatBusy && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.28, ease: "easeOut" }}
                      className="flex flex-col gap-1.5 pl-1"
                      role="group"
                      aria-label="Suggested follow-up questions"
                    >
                      <span className="flex items-center gap-2 text-[9.5px] font-medium uppercase tracking-[0.16em] text-zinc-700">
                        <span
                          aria-hidden
                          className="h-1 w-1 rounded-full"
                          style={{
                            background:
                              "linear-gradient(90deg, #ef5350, #64b5f6, #66bb6a, #e3c567)",
                          }}
                        />
                        Continue the thread
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {followUps.map((q, i) => (
                          <motion.button
                            key={q}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                              delay: 0.1 + i * 0.07,
                              duration: 0.26,
                              ease: "easeOut",
                            }}
                            onClick={() => send(q)}
                            className="sasi-chip-brief group flex min-h-9 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3 text-[11.5px] text-zinc-400 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-zinc-100"
                            aria-label={`Ask follow-up: ${q}`}
                          >
                            <MessageCircleQuestion
                              className="h-3 w-3 text-zinc-600 transition group-hover:text-[#e3c567]"
                              aria-hidden
                            />
                            {q}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* scroll-to-bottom pill — appears when you scrolled up while SASI streams */}
          <AnimatePresence>
            {showJump && !empty && (
              <motion.button
                initial={{ opacity: 0, y: 6, scale: 0.94 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.94 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                onClick={() =>
                  scrollRef.current?.scrollTo({
                    top: scrollRef.current.scrollHeight,
                    behavior: "smooth",
                  })
                }
                className="sasi-btn-ring absolute bottom-2 left-1/2 flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/12 bg-[#101012]/90 px-3 text-[11px] font-medium text-zinc-300 shadow-xl shadow-black/50 backdrop-blur-sm transition hover:text-white"
                aria-label="Jump to the newest message"
              >
                <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                Latest
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* ---------- composer ---------- */}
        <div className="sticky bottom-0 mt-auto shrink-0">
          {/* reverse-loop hint: quiet affordance once there is something worth distilling */}
          {canDistil && !chatBusy && !briefingBusy && (
            <div className="mb-2 flex justify-center">
              <button
                onClick={distil}
                className="sasi-chip-brief group flex h-7 items-center gap-1.5 rounded-full border border-[#64b5f6]/25 bg-[#64b5f6]/[0.06] px-3 text-[11px] font-medium text-[#a7d3f5] transition hover:border-[#64b5f6]/50 hover:bg-[#64b5f6]/[0.12]"
                aria-label="Pin this conversation to your dashboard as a briefing"
              >
                <MessageSquareText
                  className="h-3 w-3 transition group-hover:scale-110"
                  aria-hidden
                />
                Summarise this chat as a briefing
                <ArrowUp className="h-3 w-3 -rotate-45 opacity-60 transition group-hover:opacity-100" aria-hidden />
              </button>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="relative"
          >
            <div className="pointer-events-none absolute -inset-x-3 -top-6 h-6 bg-gradient-to-t from-[#050505] to-transparent" aria-hidden />
            <div
              className={cn(
                "sasi-search-glow flex items-end gap-2 rounded-xl border border-white/10 bg-[#0b0b0c] p-2 pl-3.5 shadow-xl shadow-black/50 transition focus-within:border-white/20",
                chatBusy && "opacity-90"
              )}
            >
              <label htmlFor="sasi-ask-input" className="sr-only">
                Ask SASI a question
              </label>
              <textarea
                id="sasi-ask-input"
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT))}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder={
                  chatBusy
                    ? "SASI is answering — stop it below if you need to…"
                    : "Ask about services, outages, or your cases…"
                }
                autoComplete="off"
                maxLength={MAX_INPUT}
                className="max-h-[120px] min-h-[40px] min-w-0 flex-1 resize-none bg-transparent py-2.5 text-[13.5px] leading-relaxed text-white outline-none placeholder:text-zinc-600"
              />
              {chatBusy ? (
                /* STOP — one obvious square while SASI is streaming */
                <button
                  type="button"
                  onClick={stopSasi}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.07] transition hover:border-[#ef5350]/50 hover:bg-[#ef5350]/10"
                  aria-label="Stop SASI's answer"
                  title="Stop this answer"
                >
                  <span className="h-3 w-3 rounded-[3px] bg-zinc-200" aria-hidden />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Send question to SASI"
                >
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
            {/* char counter — only when near the limit (kept quiet on purpose) */}
            <div className="flex items-center justify-between px-1 pt-1">
              <span className="hidden text-[9.5px] text-zinc-800 sm:block">
                Enter to send · Shift+Enter for a new line
              </span>
              <span
                className={cn(
                  "ml-auto text-[9.5px] tabular-nums transition",
                  nearLimit ? "text-[#e3c567]/80" : "text-transparent"
                )}
                aria-hidden={!nearLimit}
              >
                {input.length}/{MAX_INPUT}
              </span>
            </div>
          </form>

          <p className="flex items-center justify-center gap-1.5 pb-2 text-center text-[10px] text-zinc-700">
            <ShieldCheck className="h-3 w-3 text-zinc-600" aria-hidden />
            SASI can be wrong about public information — verify what matters. Nothing is
            submitted without your approval.
          </p>
        </div>
      </div>
    </div>
  );
}
