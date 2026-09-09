"use client";

import { motion } from "framer-motion";
import {
  Archive,
  ArrowRight,
  Brain,
  ChevronRight,
  ClipboardCheck,
  Compass,
  Layers,
  MessageSquareQuote,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { cn } from "@/lib/utils";

/* ============================================================
   How it works — the nine-step loop as a vertical rail.
   ============================================================ */

const LOOP = [
  "OBSERVE",
  "UNDERSTAND",
  "RESEARCH",
  "REASON",
  "PLAN",
  "ASK",
  "ACT",
  "VERIFY",
  "REMEMBER",
] as const;

/** dot tone mirrors the product timeline language */
const STEP_TONE = {
  user: "bg-white",
  ai: "bg-[#e3c567]",
  system: "bg-zinc-500",
  verification: "bg-[#66bb6a]",
} as const;

interface Step {
  n: string;
  tone: keyof typeof STEP_TONE;
  icon: LucideIcon;
  title: string;
  copy: string;
}

const STEPS: Step[] = [
  {
    n: "01",
    tone: "user",
    icon: MessageSquareQuote,
    title: "Tell SASI what is happening",
    copy: "Describe the issue in your own words. Add photos, notes or links if you have them — SASI does the structuring.",
  },
  {
    n: "02",
    tone: "ai",
    icon: Brain,
    title: "SASI understands the problem",
    copy: "Your description becomes a structured problem: a service, a location and an initial scope — shown back to you to correct.",
  },
  {
    n: "03",
    tone: "ai",
    icon: Search,
    title: "SASI researches relevant information",
    copy: "SASI looks for official notices, news coverage and other relevant material connected to the problem and the area.",
  },
  {
    n: "04",
    tone: "ai",
    icon: Layers,
    title: "SASI organizes evidence",
    copy: "What SASI finds — and what you provide — is organised as evidence attached to your case, each item labelled.",
  },
  {
    n: "05",
    tone: "ai",
    icon: Sparkles,
    title: "SASI identifies findings",
    copy: "Findings are prepared from the evidence. Each one carries a status and a confidence level, so inference is never dressed up as fact.",
  },
  {
    n: "06",
    tone: "ai",
    icon: Compass,
    title: "SASI recommends next steps",
    copy: "SASI proposes what could happen next, with the reasoning and the trade-offs written in plain language.",
  },
  {
    n: "07",
    tone: "user",
    icon: ShieldCheck,
    title: "You approve consequential actions",
    copy: "Anything consequential — like submitting a report — waits for your explicit approval, with what is shared shown first.",
  },
  {
    n: "08",
    tone: "verification",
    icon: ClipboardCheck,
    title: "SASI verifies what happened",
    copy: "After an approved action, SASI checks whether anything actually changed — and records the result honestly, including when it could not verify.",
  },
  {
    n: "09",
    tone: "system",
    icon: Archive,
    title: "The case remains organized",
    copy: "Sources, evidence, findings and decisions stay together as an organised record you can revisit, share or build on.",
  },
];

const VIEWPORT = { once: true, margin: "-60px" };

export default function HowItWorksView() {
  const navigate = useSasiStore((s) => s.navigate);

  return (
    <div className="relative">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        {/* Intro */}
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          How it works
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          One loop, nine steps, one rule: you decide.
        </h1>
        <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-zinc-400">
          Every SASI investigation follows the same loop — from your first description to a
          verified, organised record. Nothing skips the approval step.
        </p>

        {/* Agentic loop strip */}
        <div className="sasi-card mt-8 p-4">
          <p className="font-mono text-[9.5px] font-semibold tracking-[0.16em] text-zinc-600">
            THE AGENTIC LOOP
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-y-2">
            {LOOP.map((stage, i) => (
              <span key={stage} className="flex items-center">
                <span className="rounded border border-white/8 bg-white/[0.02] px-2 py-1 font-mono text-[9.5px] tracking-[0.14em] text-zinc-400">
                  {stage}
                </span>
                {i < LOOP.length - 1 && (
                  <ChevronRight className="mx-1 h-3 w-3 shrink-0 text-zinc-700" aria-hidden />
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Nine-step rail */}
        <ol className="mt-12" aria-label="The nine steps of a SASI investigation">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const last = i === STEPS.length - 1;
            return (
              <motion.li
                key={step.n}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={VIEWPORT}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className={cn("sasi-rail relative pb-10", last && "!before:hidden")}
              >
                <div className="flex gap-4">
                  <span
                    className={cn(
                      "relative z-10 mt-[5px] h-[11px] w-[11px] shrink-0 rounded-full border-2 border-[#101112]",
                      STEP_TONE[step.tone]
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono text-[10.5px] tracking-[0.14em] text-zinc-600">
                        {step.n}
                      </span>
                      <h2 className="text-[14.5px] font-semibold text-white">{step.title}</h2>
                      <Icon className="ml-auto h-4 w-4 shrink-0 self-center text-zinc-700" aria-hidden />
                    </div>
                    <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-zinc-500">
                      {step.copy}
                    </p>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ol>

        {/* End CTA */}
        <section
          aria-label="Start your first investigation"
          className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center sm:p-8"
        >
          <h2 className="text-[15px] font-semibold tracking-tight text-white">
            Start with one honest description.
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-zinc-500">
            SASI takes it from there — researching, organising and preparing, while every
            consequential step waits for you.
          </p>
          <button
            onClick={() => navigate("report")}
            className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-[13px] font-medium text-black transition-all hover:bg-zinc-200 active:scale-[0.98]"
          >
            Tell SASI what is happening
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </section>
      </div>
    </div>
  );
}
