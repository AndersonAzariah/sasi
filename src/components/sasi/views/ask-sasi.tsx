"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
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
  ScrollText,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSasiStore } from "@/lib/sasi/store";
import { toast } from "sonner";
import type { ChatMessage } from "@/lib/sasi/types";
import { RichText } from "../rich-text";
import { DemoBadge } from "../primitives";

/* ============================================================
   ASK SASI — free-text civic assistant (LLM-backed, demo data)
   ============================================================ */

const SUGGESTIONS: {
  icon: typeof Sparkles;
  q: string;
  hint: string;
}[] = [
  {
    icon: MessageCircleQuestion,
    q: "Why is my water off?",
    hint: "Outages · faults · next steps",
  },
  {
    icon: Zap,
    q: "Is load-shedding affecting my area, and what can I do?",
    hint: "Electricity · preparedness",
  },
  {
    icon: ScrollText,
    q: "What does my case CASE-000123 status mean?",
    hint: "Your cases · explained",
  },
  {
    icon: FileWarning,
    q: "How do I report a burst pipe to Joburg Water?",
    hint: "Official pathways",
  },
  {
    icon: ShieldCheck,
    q: "What can SASI actually do for me?",
    hint: "Capabilities · limits",
  },
  {
    icon: MapPin,
    q: "Which municipality handles streetlights in Johannesburg?",
    hint: "Civic directory",
  },
];

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

/* ---------- message row ---------- */

function AssistantMessage({
  msg,
  onRef,
  onDraftReport,
}: {
  msg: ChatMessage;
  onRef: (ref: string) => void;
  onDraftReport: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isError = msg.state === "error";
  const isStreaming = msg.state === "streaming" || msg.state === "sending";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — ignore */
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

        {msg.state === "done" && !isError && msg.content && (
          <button
            onClick={copy}
            className="mt-1.5 flex h-6 items-center gap-1 rounded px-1.5 text-[10.5px] text-zinc-600 opacity-0 transition hover:bg-white/[0.05] hover:text-zinc-300 focus-visible:opacity-100 group-hover/msg:opacity-100"
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
  const consumedPending = useRef(false);

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

  const send = (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || chatBusy) return;
    setInput("");
    void askSasi(q);
  };

  const onRef = (ref: string) => {
    if (ref.startsWith("CASE-")) openCase(ref);
    else openIncident(ref);
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-5 sm:px-6 lg:px-8">
      {/* fixed-height flex column: topbar 3.5rem + pt-5 + bottom clearance */}
      <div className="flex min-h-0 flex-1 flex-col max-lg:h-[calc(100vh-3.5rem-1.25rem-6rem)] max-lg:supports-[height:100dvh]:h-[calc(100dvh-3.5rem-1.25rem-6rem)] lg:h-[calc(100vh-3.5rem-1.25rem-2rem)] lg:supports-[height:100dvh]:h-[calc(100dvh-3.5rem-1.25rem-2rem)]">
        {/* ---------- header ---------- */}
        <header className="flex items-center gap-3 pb-4">
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
              <DemoBadge />
            </div>
            <p className="truncate text-[11.5px] text-zinc-500">
              Civic assistant · grounded in public information and your demo data
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
        <div
          ref={scrollRef}
          role="log"
          aria-label="SASI conversation"
          aria-live="polite"
          className="sasi-scroll min-h-0 flex-1 overflow-y-auto pb-3"
        >
          {empty ? (
            <div className="flex h-full flex-col items-center justify-center py-6">
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
                  <div className="sasi-glow-soft relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#e3c567]/25 bg-[#e3c567]/10">
                    <Sparkles className="h-6 w-6 text-[#e3c567]" aria-hidden />
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
                    className="group flex items-start gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-left transition hover:border-white/16 hover:bg-white/[0.045]"
                    aria-label={`Ask: ${s.q}`}
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03] text-zinc-400 transition group-hover:text-[#e3c567]">
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
            <div className="space-y-5">
              {chatMessages.map((m) =>
                m.role === "user" ? (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="flex justify-end"
                  >
                    <div className="max-w-[85%] rounded-xl rounded-tr-sm border border-white/10 bg-white/[0.07] px-3.5 py-2.5 text-[13px] leading-relaxed text-zinc-100 sm:max-w-[70%]">
                      {m.content}
                    </div>
                  </motion.div>
                ) : (
                  <AssistantMessage
                    key={m.id}
                    msg={m}
                    onRef={onRef}
                    onDraftReport={draftReportFromChat}
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
                    <Lightbulb className="h-3 w-3 text-[#e3c567]/60" aria-hidden />
                    {lastAssistantLen > 0
                      ? "SASI is answering live — you can keep reading while it streams."
                      : "SASI is checking public information and your case context…"}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ---------- composer ---------- */}
        <div className="sticky bottom-0 mt-auto">
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
                "sasi-pulse flex items-end gap-2 rounded-xl border border-white/10 bg-[#0b0b0c] p-2 pl-3.5 shadow-xl shadow-black/50 transition focus-within:border-white/20",
                chatBusy && "opacity-90"
              )}
            >
              <label htmlFor="sasi-ask-input" className="sr-only">
                Ask SASI a question
              </label>
              <input
                id="sasi-ask-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={chatBusy ? "SASI is answering…" : "Ask about services, outages, or your cases…"}
                autoComplete="off"
                maxLength={500}
                className="h-10 min-w-0 flex-1 bg-transparent text-[13.5px] text-white outline-none placeholder:text-zinc-600"
              />
              <button
                type="submit"
                disabled={!input.trim() || chatBusy}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Send question to SASI"
              >
                {chatBusy ? (
                  <motion.span
                    className="h-3.5 w-3.5 rounded-full border-[1.5px] border-black/25 border-t-black"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.7, repeat: Infinity, ease: "linear" }}
                  />
                ) : (
                  <ArrowUp className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </form>

          <p className="flex items-center justify-center gap-1.5 py-2 text-center text-[10px] text-zinc-700">
            <ShieldCheck className="h-3 w-3 text-zinc-600" aria-hidden />
            SASI can be wrong about public information — verify what matters. Nothing is
            submitted without your approval.
          </p>
        </div>
      </div>
    </div>
  );
}
