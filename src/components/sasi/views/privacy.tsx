"use client";

import {
  Brain,
  Check,
  ClipboardList,
  Info,
  Mail,
  X,
} from "lucide-react";
import { SectionHeader } from "@/components/sasi/primitives";

/* ============================================================
   Privacy — editorial, plain language, honest.
   ============================================================ */

const COLLECT: { title: string; detail: string }[] = [
  {
    title: "Account basics",
    detail: "Your name and email address, to identify your account and secure access to it.",
  },
  {
    title: "What you report",
    detail: "The problems you describe, the locations you give, and the evidence you attach.",
  },
  {
    title: "Optional saved location",
    detail: "Only if you choose to save one, to pre-fill future reports. Clearing it takes one tap.",
  },
];

const NEVER: string[] = [
  "We never sell your data. There is no advertising model and no data brokerage — by design, not by promise.",
  "We never train public models on your evidence without consent. Your evidence belongs to your case.",
  "We never share your identity with any institution without your explicit approval.",
];

const CONTROLS: { title: string; detail: string }[] = [
  {
    title: "Export your data",
    detail: "Download the cases and evidence associated with your account.",
  },
  {
    title: "Delete evidence",
    detail: "Remove individual items from a case at any time.",
  },
  {
    title: "Delete a case",
    detail: "Removes the case, its timeline and its findings.",
  },
  {
    title: "Clear saved location",
    detail: "Forget the location stored to pre-fill your reports.",
  },
  {
    title: "Manage AI memory",
    detail: "Review and clear what SASI remembers about your work.",
  },
  {
    title: "Delete your account",
    detail: "Removes your account and the data associated with it.",
  },
];

export default function PrivacyView() {
  return (
    <div className="relative">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        {/* Intro */}
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Privacy
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Your evidence is yours. The boundaries are explicit.
        </h1>
        <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-zinc-400">
          This page says, in plain language, what SASI collects, what it will never do, and what
          you control. Where something is a design commitment rather than a shipped control, we
          say that too.
        </p>

        <div className="mt-12 space-y-12">
          {/* What we collect */}
          <section aria-labelledby="privacy-collect">
            <SectionHeader title="What we collect" />
            <ul className="mt-4 space-y-3.5">
              {COLLECT.map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/8 bg-white/[0.03]">
                    <ClipboardList className="h-3 w-3 text-zinc-400" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-zinc-100">{item.title}</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-zinc-500">
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* What we never do */}
          <section aria-labelledby="privacy-never">
            <SectionHeader
              title="What we never do"
              description="These are product boundaries, not policy footnotes."
            />
            <ul className="mt-4 space-y-3.5">
              {NEVER.map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/8 bg-white/[0.03]">
                    <X className="h-3 w-3 text-[#fda4a0]" aria-hidden />
                  </span>
                  <p className="text-[13px] leading-relaxed text-zinc-400">{line}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* Your controls */}
          <section aria-labelledby="privacy-controls">
            <SectionHeader title="Your controls" />
            <ul className="mt-4 space-y-3.5">
              {CONTROLS.map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/8 bg-white/[0.03]">
                    <Check className="h-3 w-3 text-[#8ee09a]" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-zinc-100">{item.title}</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-zinc-500">
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-[12.5px] text-zinc-400">
              <Info className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
              All of these controls live in <span className="font-medium text-zinc-200">Settings → Privacy</span>.
            </p>
          </section>

          {/* AI memory boundaries */}
          <section aria-labelledby="privacy-memory">
            <SectionHeader title="AI memory boundaries" />
            <div className="sasi-card mt-3 flex items-start gap-3 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]">
                <Brain className="h-4 w-4 text-zinc-300" aria-hidden />
              </span>
              <p className="text-[13px] leading-relaxed text-zinc-400">
                SASI keeps a working memory so an investigation can continue across sessions.
                That memory is scoped to your own cases: it exists to pick up where an
                investigation left off — not to build a profile of you, and not to personalise
                anything beyond your own work. You can review and clear it whenever you want.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section aria-labelledby="privacy-contact" className="border-t border-white/5 pt-10">
            <SectionHeader title="Contact" />
            <div className="mt-3 flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]">
                <Mail className="h-4 w-4 text-zinc-300" aria-hidden />
              </span>
              <p className="text-[13px] leading-relaxed text-zinc-400">
                This is a demo environment, so there is no live contact channel yet. In
                production, this page will carry a direct privacy contact and a response
                commitment. Until then, treat this page as the honest statement of intent.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
