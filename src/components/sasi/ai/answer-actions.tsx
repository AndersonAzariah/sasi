"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BellPlus,
  BookmarkPlus,
  ExternalLink,
  MapPin,
  MessageCircleQuestion,
  Route,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { getSessionId } from "@/lib/sasi/utils";
import { cn } from "@/lib/utils";
import { useSasiStore } from "@/lib/sasi/store";
import {
  deriveLocationCategory,
  serviceSlugResolvable,
  type StructuredAnswer,
} from "@/lib/sasi/civic-ai";

/* ============================================================
   ANSWER ACTIONS (Task 28-b · Phase 7)

   Real handlers only — a button renders ONLY when its target data
   actually exists, and every async action reports honestly:
   non-2xx or a network error shows "…isn't available right now",
   never a fabricated success. Translation is deliberately omitted
   (deferred — see the 28-b worklog entry).

   Touch targets are ≥ 44px (mission rule) while keeping the visual
   language of the quick-reply chips. Feedback uses dots, never
   progress bars.
   ============================================================ */

interface AnswerActionsProps {
  msgId: string;
  structured: StructuredAnswer;
  /** the resident's question that produced this answer (for titles/topics) */
  questionText: string;
  /** send a follow-up in the same thread (Explain Further) */
  onAsk: (question: string) => void;
}

type BusyAction = "save" | "reminder" | null;

/* dots — same visual as the view's TypingDots, defined locally to
   avoid an import cycle back into the view */
function ActionDots() {
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1 w-1 rounded-full bg-current"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{ duration: 1.05, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

const CHIP_BASE =
  "group flex min-h-[44px] items-center gap-1.5 rounded-full border px-3.5 text-[12px] font-medium transition";

const CHIP_NEUTRAL =
  "border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25 hover:bg-white/[0.07] hover:text-white";

function firstSentence(text: string, cap: number): string {
  const t = text.trim();
  const m = /^(.+?[.!?])\s/.exec(t);
  const s = (m ? m[1] : t).replace(/\s+/g, " ").trim();
  return s.length > cap ? `${s.slice(0, cap - 1).trimEnd()}…` : s;
}

export function AnswerActions({ msgId, structured, questionText, onAsk }: AnswerActionsProps) {
  const navigate = useSasiStore((s) => s.navigate);
  const [busy, setBusy] = useState<BusyAction>(null);

  /* ---------- derived action targets (only-present data only) ---------- */

  const service = structured.service;
  const canViewService = Boolean(service && serviceSlugResolvable(service.slug));

  const journey = structured.journey;
  const canStartJourney = Boolean(journey?.journeyId);

  const locationCategory =
    structured.locationCategory || deriveLocationCategory(structured, structured.answer);

  const source = structured.officialSource;
  const canViewSource = Boolean(
    source &&
      (() => {
        try {
          const u = new URL(source.url);
          return u.protocol === "https:" || u.protocol === "http:";
        } catch {
          return false;
        }
      })()
  );

  const topic =
    (service?.title && service.title.slice(0, 80)) ||
    (journey?.title && journey.title.slice(0, 80)) ||
    (questionText.trim() && firstSentence(questionText, 80)) ||
    firstSentence(structured.answer, 80);

  const claim = structured.nextStep || firstSentence(structured.answer, 160);
  const saveTitle =
    (questionText.trim() && firstSentence(questionText, 80)) ||
    firstSentence(structured.answer, 80);

  /* ---------- async handlers — honest outcomes only ---------- */

  const save = async () => {
    if (busy) return;
    setBusy("save");
    try {
      const res = await fetch("/api/sasi/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: getSessionId(),
          kind: "answer",
          itemId: msgId,
          payload: { title: saveTitle, question: questionText, answer: structured.answer },
        }),
      });
      if (!res.ok) throw new Error(`save failed: ${res.status}`);
      toast("Saved to My SASI", {
        description: "You will find this answer under your saved items.",
      });
    } catch {
      toast("Save isn't available right now", {
        description: "SASI couldn't reach the save service — nothing was saved.",
      });
    } finally {
      setBusy(null);
    }
  };

  const createReminder = async () => {
    if (busy) return;
    setBusy("reminder");
    const title = (structured.nextStep || `Follow up: ${topic}`).slice(0, 120);
    try {
      const res = await fetch("/api/sasi/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: getSessionId(),
          title,
          note: firstSentence(structured.answer, 200),
        }),
      });
      if (!res.ok) throw new Error(`reminder failed: ${res.status}`);
      toast("Reminder created", {
        description: "SASI noted it — it is yours to action, not an official notice.",
      });
    } catch {
      toast("Reminders aren't available right now", {
        description: "SASI couldn't reach the reminder service — nothing was created.",
      });
    } finally {
      setBusy(null);
    }
  };

  /* ---------- render ---------- */

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Answer actions">
        {canViewService && service && (
          <button
            onClick={() => navigate("service-detail", service.slug)}
            className={cn(CHIP_BASE, CHIP_NEUTRAL)}
            aria-label={`View the ${service.title} service page`}
          >
            <ArrowRight className="h-3.5 w-3.5 text-zinc-500 transition group-hover:text-white" aria-hidden />
            View {service.title}
          </button>
        )}

        {canStartJourney && journey && (
          <button
            onClick={() => navigate("journey", journey.journeyId)}
            className={cn(
              CHIP_BASE,
              "border-[#e3c567]/30 bg-[#e3c567]/[0.08] text-[#e3c567] hover:border-[#e3c567]/55 hover:bg-[#e3c567]/[0.14]"
            )}
            aria-label={`Start the ${journey.title} preparation journey`}
          >
            <Route className="h-3.5 w-3.5" aria-hidden />
            Start Journey
          </button>
        )}

        {locationCategory && (
          <button
            onClick={() => navigate("map", locationCategory)}
            className={cn(CHIP_BASE, CHIP_NEUTRAL)}
            aria-label="Find nearby places on the map"
          >
            <MapPin className="h-3.5 w-3.5 text-zinc-500 transition group-hover:text-white" aria-hidden />
            Find Nearby
          </button>
        )}

        {canViewSource && source && (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              CHIP_BASE,
              "border-[#64b5f6]/25 bg-[#64b5f6]/[0.06] text-[#a7d3f5] hover:border-[#64b5f6]/50 hover:bg-[#64b5f6]/[0.12]"
            )}
            aria-label={`Open the official source: ${source.org} (opens in a new tab)`}
            title={`${source.org} — official website (new tab)`}
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            View Source
          </a>
        )}

        <button
          onClick={() => navigate("verify", claim)}
          className={cn(CHIP_BASE, CHIP_NEUTRAL)}
          aria-label="Check this claim against official channels"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-zinc-500 transition group-hover:text-white" aria-hidden />
          Verify
        </button>

        <button
          onClick={() => onAsk(`Explain ${topic} in more detail`)}
          className={cn(CHIP_BASE, CHIP_NEUTRAL)}
          aria-label={`Ask SASI to explain ${topic} in more detail`}
        >
          <MessageCircleQuestion
            className="h-3.5 w-3.5 text-zinc-500 transition group-hover:text-white"
            aria-hidden
          />
          Explain Further
        </button>

        <button
          onClick={save}
          disabled={busy !== null}
          className={cn(
            CHIP_BASE,
            "border-[#66bb6a]/25 bg-[#66bb6a]/[0.07] text-[#9ccc9f] hover:border-[#66bb6a]/50 hover:bg-[#66bb6a]/[0.13]",
            busy !== null && "cursor-not-allowed opacity-60"
          )}
          aria-label="Save this answer to My SASI"
          aria-busy={busy === "save"}
        >
          {busy === "save" ? <ActionDots /> : <BookmarkPlus className="h-3.5 w-3.5" aria-hidden />}
          {busy === "save" ? "Saving…" : "Save"}
        </button>

        <button
          onClick={createReminder}
          disabled={busy !== null}
          className={cn(CHIP_BASE, CHIP_NEUTRAL, busy !== null && "cursor-not-allowed opacity-60")}
          aria-label="Create a reminder for this next step"
          aria-busy={busy === "reminder"}
        >
          {busy === "reminder" ? (
            <ActionDots />
          ) : (
            <BellPlus className="h-3.5 w-3.5 text-zinc-500 transition group-hover:text-white" aria-hidden />
          )}
          {busy === "reminder" ? "Adding…" : "Create Reminder"}
        </button>
      </div>

      {canViewSource && source && (
        <p className="pl-1 text-[10px] text-zinc-600">
          Opens {source.org}&apos;s official website in a new tab — SASI never submits anything
          there for you.
        </p>
      )}
    </div>
  );
}
