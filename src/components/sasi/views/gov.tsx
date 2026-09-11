"use client";

import { useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  FileOutput,
  Info,
  Landmark,
  MapPinned,
  ScrollText,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useSasiStore } from "@/lib/sasi/store";
import { copyExplainerPrompt } from "@/lib/sasi/explainer";
import { HAPTIC, haptic } from "@/lib/sasi/mobile";
import { SectionHeader } from "@/components/sasi/primitives";

/* ============================================================
   GOVERNMENT — what SASI offers the state, stated honestly.
   An institutional page with the same rules as everywhere else
   on the platform: no invented integrations, no official
   status, no procurement claims. What is possible and what is
   not, side by side.
   ============================================================ */

const OFFERS: { icon: typeof Landmark; title: string; detail: string }[] = [
  {
    icon: MapPinned,
    title: "Ward-level signal, structured",
    detail:
      "Resident reports arrive structured — service category, location, impact, photo evidence — instead of as free-text complaints. Ward-level patterns become readable without a call-centre backlog.",
  },
  {
    icon: Landmark,
    title: "Municipal service categories",
    detail:
      "Water, sanitation, electricity, roads, waste — SASI's taxonomy follows the services municipalities actually deliver, so records could align with existing workflows.",
  },
  {
    icon: FileOutput,
    title: "Exportable case records",
    detail:
      "Every case is a complete, printable record: timeline, evidence with sources, findings with plain-language reasoning. PDF and plain-text export exist today.",
  },
  {
    icon: ShieldCheck,
    title: "Transparency-first by design",
    detail:
      "AI output is labelled as AI-assisted and unverified. Human decisions are recorded. Residents keep approval control over every consequential step.",
  },
];

const NOT_YET: { title: string; detail: string }[] = [
  {
    title: "No official status",
    detail:
      "SASI is independent. It speaks for no institution and holds no mandate from any sphere of government.",
  },
  {
    title: "No systems integration",
    detail:
      "Nothing SASI produces flows into a municipal ERP, CRM or faults line today. No such integration has been built or agreed with anyone.",
  },
  {
    title: "No procurement vehicle",
    detail:
      "There is no contract, tender, service-level agreement or pricing model for institutional use. The product is self-serve for residents.",
  },
  {
    title: "Prototype, not a platform",
    detail:
      "SASI now has real accounts and per-user data isolation, but it has no team accounts, roles or department workflows, and no security audit yet. It is not ready for multi-department roll-out, and we say so plainly.",
  },
];

const POPIA_ROWS: { label: string; detail: string }[] = [
  {
    label: "Minimality",
    detail: "Reports collect what the problem needs — service, location, impact, optional photo. Nothing else.",
  },
  {
    label: "Purpose",
    detail: "Resident data is used to run the resident's own case. It is not sold, not advertised against, not profiled.",
  },
  {
    label: "Resident control",
    detail: "Nothing is submitted anywhere without the resident's explicit approval, and approvals are recorded in the case timeline.",
  },
  {
    label: "Device-local storage",
    detail: "The offline snapshot lives in the resident's browser and never leaves the device. Server storage is SQLite, single-tenant.",
  },
];

export default function GovView() {
  const navigate = useSasiStore((s) => s.navigate);
  const [copied, setCopied] = useState(false);

  const copyExplainer = async () => {
    haptic(HAPTIC.tap);
    const ok = await copyExplainerPrompt();
    if (ok) {
      setCopied(true);
      toast("Honest explainer copied", {
        description:
          "A complete, factual description of SASI — capabilities, real vs sample data, and limits — is on your clipboard.",
      });
      window.setTimeout(() => setCopied(false), 2400);
    } else {
      toast("Could not copy", {
        description: "Your browser blocked clipboard access.",
      });
    }
  };

  return (
    <div className="relative">
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-14 sm:px-6 sm:pt-20">
        {/* ---------- hero ---------- */}
        <p className="sasi-eyebrow" data-sasi-words>
          Government · Municipal · Provincial
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">
          <span data-sasi-words>SASI, for the state —</span>{" "}
          <span className="sasi-serif italic text-zinc-300" data-sasi-words>
            with the limits in writing.
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-[14px] leading-relaxed text-zinc-400">
          SASI is an independent civic technology platform, not a government
          system. This page is the honest version of a government pitch: what
          the platform genuinely offers a municipality or department today,
          what it does not do yet, and how resident data is protected.
        </p>

        {/* ---------- offers ---------- */}
        <section aria-labelledby="gov-offers" className="mt-14">
          <SectionHeader
            title="What government gets today"
            description="Shipped, working features — not roadmap items."
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {OFFERS.map((item) => (
              <div key={item.title} className="sasi-card p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03]">
                  <item.icon className="h-4 w-4 text-zinc-300" aria-hidden />
                </span>
                <p className="mt-3.5 text-[13.5px] font-medium text-zinc-100">
                  {item.title}
                </p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500">
                  {item.detail}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- not yet ---------- */}
        <section aria-labelledby="gov-limits" className="mt-14">
          <SectionHeader
            title="What SASI is not — and does not claim"
            description="Boundaries are part of the pitch. If a vendor won't write theirs down, ask why."
          />
          <ul className="mt-4 space-y-3">
            {NOT_YET.map((item) => (
              <li key={item.title} className="sasi-card flex items-start gap-3 p-4">
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

        {/* ---------- a realistic adoption path ---------- */}
        <section aria-labelledby="gov-path" className="mt-14">
          <SectionHeader title="A realistic adoption path" />
          <div className="sasi-card mt-4 p-5">
            <ol className="space-y-4">
              {[
                {
                  step: "Today",
                  body: "Residents self-serve: they report, investigate and export records. A municipality can already read the signal residents choose to share with it.",
                },
                {
                  step: "Next, if asked",
                  body: "Agreed, specific integrations — a monitored intake, ward dashboards, bulk exports — built only with an institution that has asked for them and put its name on it.",
                },
                {
                  step: "Not promised",
                  body: "Mandates, exclusivity, official-status badges, or replacing any government channel. SASI will not claim to be the state.",
                },
              ].map((row, i) => (
                <li key={row.step} className="flex items-start gap-3.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#e3c567]/25 bg-[#e3c567]/[0.08] font-mono text-[10px] font-semibold text-[#e3c567]" aria-hidden>
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-white">{row.step}</p>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-zinc-400">
                      {row.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- POPIA ---------- */}
        <section aria-labelledby="gov-popia" className="mt-14">
          <SectionHeader
            title="POPIA posture"
            description="Design intent aligned to the Protection of Personal Information Act — stated as intent, not as a certification."
          />
          <dl className="sasi-card mt-4 divide-y divide-white/[0.05] p-2">
            {POPIA_ROWS.map((row) => (
              <div key={row.label} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-baseline sm:gap-5">
                <dt className="w-36 shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                  {row.label}
                </dt>
                <dd className="min-w-0 text-[12.5px] leading-relaxed text-zinc-300">
                  {row.detail}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---------- the explainer ---------- */}
        <section aria-labelledby="gov-explainer" className="mt-14">
          <SectionHeader
            title="The honest explainer, in one prompt"
            description="A paste-ready description of what SASI is right now: capabilities, what is real vs sample data, and every limitation. Copy it and check our claims yourself."
          />
          <div className="sasi-card mt-4 flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03]">
                <ScrollText className="h-4 w-4 text-zinc-300" aria-hidden />
              </span>
              <p className="max-w-md text-[12.5px] leading-relaxed text-zinc-400">
                <span className="font-medium text-white">SASI-EXPLAINER-PROMPT</span> —
                the same text ships in the repository root, so what we say about
                SASI and what the code does can be diffed line by line.
              </p>
            </div>
            <button
              onClick={() => void copyExplainer()}
              className="sasi-btn-white-glass inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-white px-4 text-[13px] font-medium text-black transition-all hover:bg-zinc-100 active:scale-[0.98]"
              aria-label="Copy the honest explainer prompt to the clipboard"
            >
              {copied ? (
                <Check className="h-4 w-4 text-[#2e7d32]" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              {copied ? "Copied" : "Copy the explainer"}
            </button>
          </div>
        </section>

        {/* ---------- honesty note ---------- */}
        <div className="sasi-card mt-14 flex items-start gap-3 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#e3c567]" aria-hidden />
          <p className="text-[13px] leading-relaxed text-zinc-300">
            Nothing on this page is an offer, a certification, or a
            government endorsement. SASI is developed and operated
            independently, and its only commitment is to transparent,
            evidence-led civic information.
          </p>
        </div>

        {/* ---------- CTA ---------- */}
        <section aria-label="Get started" className="mt-12 border-t border-white/5 pt-10">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate("signup")}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-[13px] font-medium text-black transition-all hover:bg-zinc-200 active:scale-[0.98]"
            >
              Try SASI as a resident
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              onClick={() => navigate("about")}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 px-4 text-[13px] font-medium text-zinc-300 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white"
            >
              Read what SASI is
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
