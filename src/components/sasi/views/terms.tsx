"use client";

import {
  Check,
  ClipboardCheck,
  FileText,
  Landmark,
  Scale,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ============================================================
   Terms — plain language, anchored sections.
   ============================================================ */

interface TermSection {
  id: string;
  n: string;
  icon: LucideIcon;
  title: string;
  paragraphs: string[];
}

const SECTIONS: TermSection[] = [
  {
    id: "terms-as-is",
    n: "01",
    icon: FileText,
    title: "Provided as-is",
    paragraphs: [
      "SASI is provided as-is, in a demo environment, without warranties of any kind. All data you see in this demo is demonstration data.",
      "Availability, accuracy or fitness for any particular purpose is not promised. Features may change or be withdrawn as the product develops.",
    ],
  },
  {
    id: "terms-status",
    n: "02",
    icon: Landmark,
    title: "No official government status",
    paragraphs: [
      "SASI is an independent platform. It is not operated by, affiliated with, or endorsed by the South African government or any municipality.",
      "Nothing submitted through SASI constitutes an official submission to any institution unless an approved action explicitly says otherwise — and even then, SASI acts on your instruction as your tool, not as a government channel.",
    ],
  },
  {
    id: "terms-evidence",
    n: "03",
    icon: ClipboardCheck,
    title: "Your responsibility for evidence",
    paragraphs: [
      "You are responsible for the accuracy of the evidence you provide, and for only attaching material you have the right to share.",
      "SASI labels the status of every claim, including yours: reported does not mean confirmed. If evidence you provided turns out to be wrong, you can correct or delete it.",
    ],
  },
  {
    id: "terms-ai",
    n: "04",
    icon: Scale,
    title: "AI outputs are informational, not legal advice",
    paragraphs: [
      "Findings, summaries and recommendations produced by SASI are informational: they are generated from the sources and evidence available at the time.",
      "They are not legal advice, not professional advice, and not a determination of anyone's rights or obligations. Verify anything that matters before relying on it.",
    ],
  },
  {
    id: "terms-acceptance",
    n: "05",
    icon: Check,
    title: "Acceptance",
    paragraphs: [
      "By using SASI you accept these terms together with the privacy statement. If you do not accept them, please do not use the platform.",
      "These terms may be updated; the version in force is the one shown here. In this demo environment, no contractual relationship is created.",
    ],
  },
];

export default function TermsView() {
  return (
    <div className="relative">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        {/* Intro */}
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Terms
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Plain-language terms.
        </h1>
        <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-zinc-400">
          Short, direct and honest. Demo draft — February 2026.
        </p>

        {/* Anchor list */}
        <nav aria-label="Terms sections" className="mt-8 flex flex-wrap gap-2">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full border border-white/8 px-3 py-1.5 text-[12px] text-zinc-500 transition-colors hover:border-white/15 hover:text-zinc-200"
            >
              {section.title}
            </a>
          ))}
        </nav>

        {/* Sections */}
        <div className="mt-12 space-y-0">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-heading`}
                className="scroll-mt-24 border-t border-white/5 py-10 first:border-t-0 first:pt-0"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-[10.5px] tracking-[0.14em] text-zinc-600">
                    {section.n}
                  </span>
                  <h2
                    id={`${section.id}-heading`}
                    className="text-[15px] font-semibold tracking-tight text-white"
                  >
                    {section.title}
                  </h2>
                  <Icon className="ml-auto h-4 w-4 shrink-0 self-center text-zinc-700" aria-hidden />
                </div>
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 32)}
                    className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-zinc-400"
                  >
                    {paragraph}
                  </p>
                ))}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
