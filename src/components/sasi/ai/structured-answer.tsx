"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { RichText } from "../rich-text";
import { AnswerActions } from "./answer-actions";
import type { StructuredAnswer } from "@/lib/sasi/civic-ai";

/* ============================================================
   STRUCTURED ANSWER VIEW (Task 28-b · Phases 6 + 7)

   Renders the OPTIONAL sections of a validated structured answer
   under the chat bubble — only the sections that are actually
   present render ("only-present sections" rule):

     - whatYouNeed  → "What you'll need" bullet list
     - nextStep     → "Suggested next step" callout
     - related      → real follow-up chips (each sends a question)
     - actions row  → AnswerActions (real handlers only)

   The plain `answer` text itself is rendered by the chat bubble
   above (it is what gets persisted/streamed), so nothing here
   duplicates it. Sections are composed as markdown-lite strings and
   drawn through the shared RichText renderer so Ask SASI, briefings
   and photo analysis all read identically. No loading bars.
   ============================================================ */

interface StructuredAnswerViewProps {
  structured: StructuredAnswer;
  msgId: string;
  questionText: string;
  onAsk: (question: string) => void;
}

const RELATED_CHIP =
  "group flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 text-[11.5px] text-zinc-400 transition hover:border-[#e3c567]/45 hover:bg-[#e3c567]/[0.08] hover:text-[#e3c567]";

export function StructuredAnswerView({
  structured,
  msgId,
  questionText,
  onAsk,
}: StructuredAnswerViewProps) {
  /* ---------- markdown-lite sections (only-present) ---------- */
  const sections: string[] = [];
  if (structured.whatYouNeed && structured.whatYouNeed.length > 0) {
    sections.push("## What you'll need");
    for (const item of structured.whatYouNeed) sections.push(`- ${item}`);
  }
  if (structured.nextStep) {
    sections.push(`> **Suggested next step:** ${structured.nextStep}`);
  }
  const hasSections = sections.length > 0;
  const related = (structured.related ?? []).slice(0, 6);
  /* the action row (Save / Verify / Explain / Reminder …) is always
     renderable — it acts on the answer itself — so the panel always
     renders once a validated structured answer exists */

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: "easeOut" }}
      className="mt-2 rounded-xl border border-[#e3c567]/15 bg-[#e3c567]/[0.03] p-3"
    >
      {hasSections && (
        <div className="text-[13px] leading-relaxed text-zinc-300">
          <RichText content={sections.join("\n")} />
        </div>
      )}

      {related.length > 0 && (
        <div
          className={cn("flex flex-wrap gap-1.5", hasSections && "mt-3")}
          role="group"
          aria-label="Related topics you can ask about next"
        >
          {related.map((r) => (
            <button
              key={r}
              onClick={() => onAsk(`Tell me about ${r} in more detail`)}
              className={RELATED_CHIP}
              aria-label={`Ask about ${r}`}
            >
              <Sparkles className="h-3 w-3 text-zinc-600 transition group-hover:text-[#e3c567]" aria-hidden />
              {r}
            </button>
          ))}
        </div>
      )}

      <div className={cn("mt-3 border-t border-white/6 pt-2.5")}>
        <AnswerActions msgId={msgId} structured={structured} questionText={questionText} onAsk={onAsk} />
      </div>
    </motion.div>
  );
}
