"use client";

import {
  ArrowRight,
  Check,
  Info,
  Scale,
  ShieldCheck,
  X,
} from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { SectionHeader } from "@/components/sasi/primitives";

/* ============================================================
   About — quiet, editorial. No data, no demo badges needed.
   ============================================================ */

const DOES: { title: string; detail: string }[] = [
  {
    title: "Understand the problem you describe",
    detail: "Turn a frustration into a structured civic problem with a service and a location.",
  },
  {
    title: "Research official notices, news and public information",
    detail: "Look for what is already known and who has already said something.",
  },
  {
    title: "Organise evidence with clear status and confidence",
    detail: "Yours and SASI's, side by side — labelled, never mixed.",
  },
  {
    title: "Prepare findings and recommend next steps",
    detail: "With the reasoning written in plain language you can question.",
  },
  {
    title: "Verify outcomes and keep a complete audit trail",
    detail: "So the whole history of a case stays together and checkable.",
  },
];

const DOES_NOT: { title: string; detail: string }[] = [
  {
    title: "Not a government website",
    detail: "SASI has no official status and speaks for no institution.",
  },
  {
    title: "Not an official complaints portal",
    detail: "SASI prepares submissions for you — it is not a government channel.",
  },
  {
    title: "Not a political organization",
    detail: "No party affiliations, no campaigns, no advocacy positions.",
  },
  {
    title: "Not a social network",
    detail: "No feeds, no followers, no public profiles.",
  },
  {
    title: "Not a chatbot gimmick",
    detail: "SASI is a structured investigation workflow, not small talk.",
  },
];

const AI_TRANSPARENCY: { title: string; detail: string }[] = [
  {
    title: "Findings carry status and confidence",
    detail: "Confirmed, reported, inferred or unverified — inference is never presented as fact.",
  },
  {
    title: "Sources are shown",
    detail: "Every finding links to the material behind it, with publisher and retrieval time.",
  },
  {
    title: "No hidden reasoning",
    detail: "SASI's reasoning is written in plain language on the case timeline. There is no secret layer you are asked to trust.",
  },
];

export default function AboutView() {
  const navigate = useSasiStore((s) => s.navigate);

  return (
    <div className="relative">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        {/* Independence callout */}
        <div className="sasi-card flex items-start gap-3 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#e3c567]" aria-hidden />
          <p className="text-[13px] leading-relaxed text-zinc-300">
            SASI is an independent civic technology platform. It is not operated by or affiliated
            with the South African government.
          </p>
        </div>

        <div className="mt-12 space-y-12">
          {/* What SASI is */}
          <section aria-labelledby="about-what">
            <SectionHeader title="What SASI is" />
            <p className="mt-3 text-[13.5px] leading-relaxed text-zinc-400">
              SASI — the South African Civic Intelligence Platform — is an independent civic
              technology product. It helps you describe a civic problem, investigates what is
              known about it, organises the evidence, and prepares clear findings — so you can
              decide what to do next with facts instead of frustration.
            </p>
            <p className="mt-3 text-[13.5px] leading-relaxed text-zinc-400">
              It is built for everyday civic life: water, electricity, roads, waste and the rest
              of the services that hold a neighbourhood together.
            </p>
          </section>

          {/* Why SASI exists */}
          <section aria-labelledby="about-why">
            <SectionHeader title="Why SASI exists" />
            <p className="mt-3 text-[13.5px] leading-relaxed text-zinc-400">
              Civic problems are easy to report and hard to understand. A tap runs dry, and
              nobody can say why, for how long, or who is responsible. Complaints disappear into
              portals; answers arrive — if at all — as rumour.
            </p>
            <p className="mt-3 text-[13.5px] leading-relaxed text-zinc-400">
              SASI exists to close that gap: to turn scattered signals — notices, news, resident
              reports, your own photos — into an organised picture with honest uncertainty
              attached, and to keep you in control of what happens next.
            </p>
          </section>

          {/* How SASI works (short) */}
          <section aria-labelledby="about-how">
            <SectionHeader title="How SASI works, briefly" />
            <p className="mt-3 text-[13.5px] leading-relaxed text-zinc-400">
              You tell SASI what is happening. SASI researches relevant information, organises
              the evidence and prepares findings — each with a status and a confidence level. You
              review everything, and any consequential action waits for your approval. SASI then
              verifies what happened and keeps the record organised.
            </p>
            <button
              onClick={() => navigate("how-it-works")}
              className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-300 transition-colors hover:text-white"
            >
              See the full nine-step loop
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </section>

          {/* What SASI does */}
          <section aria-labelledby="about-does">
            <SectionHeader title="What SASI does" />
            <ul className="mt-4 space-y-3.5">
              {DOES.map((item) => (
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
          </section>

          {/* What SASI does NOT do */}
          <section aria-labelledby="about-does-not">
            <SectionHeader
              title="What SASI does not do"
              description="Boundaries are part of the product, not fine print."
            />
            <ul className="mt-4 space-y-3.5">
              {DOES_NOT.map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-white/8 bg-white/[0.03]">
                    <X className="h-3 w-3 text-[#fda4a0]" aria-hidden />
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

          {/* AI transparency */}
          <section aria-labelledby="about-ai">
            <SectionHeader
              title="AI transparency"
              description="If SASI cannot show its work, it does not make the claim."
            />
            <ul className="mt-4 space-y-3.5">
              {AI_TRANSPARENCY.map((item) => (
                <li key={item.title} className="flex items-start gap-3">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#e3c567]" />
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

          {/* Human control */}
          <section aria-labelledby="about-control">
            <SectionHeader title="Human control" />
            <div className="sasi-card mt-3 flex items-start gap-3 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]">
                <ShieldCheck className="h-4 w-4 text-zinc-300" aria-hidden />
              </span>
              <p className="text-[13px] leading-relaxed text-zinc-400">
                Consequential actions — submitting a report to an institution, sharing your
                information — wait for your approval. SASI shows what will happen, what is shared
                and who receives it. You can approve, edit or reject, and your decision is
                recorded in the case timeline.
              </p>
            </div>
          </section>

          {/* Independence statement */}
          <section aria-labelledby="about-independence">
            <SectionHeader title="Independence statement" />
            <div className="mt-3 flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <Scale className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
              <p className="text-[13.5px] leading-relaxed text-zinc-300">
                SASI is developed and operated independently. It is not operated by, affiliated
                with, or endorsed by the South African government, any municipality, or any
                political party. SASI&apos;s only commitment is to transparent, evidence-led
                civic information for the people who use it — and to saying clearly when it does
                not know.
              </p>
            </div>
          </section>

          {/* CTA */}
          <section aria-label="Get started" className="border-t border-white/5 pt-10">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => navigate("report")}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-[13px] font-medium text-black transition-all hover:bg-zinc-200 active:scale-[0.98]"
              >
                Tell SASI what is happening
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </button>
              <button
                onClick={() => navigate("security")}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-[13px] font-medium text-zinc-300 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
              >
                Read about security
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
