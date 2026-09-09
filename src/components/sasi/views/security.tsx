"use client";

import {
  Brain,
  FileLock,
  History,
  Info,
  KeyRound,
  Lock,
  Scale,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ============================================================
   Security — honest by design: "designed to", "planned",
   never claimed. Quiet layout, no data, no demo badges.
   ============================================================ */

interface SecuritySection {
  icon: LucideIcon;
  title: string;
  copy: string;
}

const SECTIONS: SecuritySection[] = [
  {
    icon: Lock,
    title: "Data protection",
    copy: "SASI is designed to collect the minimum information an investigation needs, and to keep what you provide separate from what SASI researches. Data protection is treated as an architectural requirement, not a feature added later.",
  },
  {
    icon: KeyRound,
    title: "Authentication",
    copy: "Accounts are protected with standard session-based authentication. Additional controls — such as two-factor authentication and hardened session policies — are planned for production, and are not claimed for this demo.",
  },
  {
    icon: UserCheck,
    title: "Permissions",
    copy: "SASI follows a least-privilege model by design: agents request permission for each consequential capability, scoped per case. In this demo environment, permission checks are simulated to show how the model works.",
  },
  {
    icon: History,
    title: "Audit trails",
    copy: "Every meaningful event — sources found, findings prepared, approvals given — is written to a case-level timeline. The goal is that any outcome can be traced back to the events and decisions that produced it.",
  },
  {
    icon: Brain,
    title: "AI controls",
    copy: "AI activity is constrained to research, organisation and preparation. The agent cannot send communications or take external actions on its own; every consequential step routes through an approval gate.",
  },
  {
    icon: ShieldCheck,
    title: "Human approval",
    copy: "Consequential actions always wait for you. SASI shows what will happen, what information is shared and who receives it before you decide — and records your decision in the case timeline.",
  },
  {
    icon: FileLock,
    title: "Evidence security",
    copy: "Evidence you provide is attached to your case and used to support your report. SASI is not designed to publish your evidence, and access controls for stored files are part of the production architecture plan.",
  },
  {
    icon: Scale,
    title: "Responsible AI",
    copy: "Findings are labelled with status and confidence so inference is never presented as fact. Where SASI is uncertain, it says so — and shows you the sources so you can check for yourself.",
  },
];

export default function SecurityView() {
  return (
    <div className="relative">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        {/* Intro */}
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
          Security
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Designed for trust, honest about maturity.
        </h1>
        <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-zinc-400">
          SASI is being built on the assumption that it will handle sensitive civic information.
          This page states what the architecture is designed to do — and, just as clearly, what
          is planned rather than claimed.
        </p>

        {/* Sections */}
        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <section key={section.title} aria-labelledby={`sec-${section.title.replace(/\s+/g, "-").toLowerCase()}`} className="sasi-card p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]">
                    <Icon className="h-3.5 w-3.5 text-zinc-300" aria-hidden />
                  </span>
                  <h2
                    id={`sec-${section.title.replace(/\s+/g, "-").toLowerCase()}`}
                    className="text-[13.5px] font-semibold text-white"
                  >
                    {section.title}
                  </h2>
                </div>
                <p className="mt-2.5 text-[12.5px] leading-relaxed text-zinc-500">
                  {section.copy}
                </p>
              </section>
            );
          })}
        </div>

        {/* Honest limitations */}
        <section
          aria-labelledby="security-limitations"
          className="mt-8 rounded-xl border border-[#e3c567]/15 bg-[#e3c567]/[0.04] p-5"
        >
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-[#e3c567]" aria-hidden />
            <h2 id="security-limitations" className="text-[13.5px] font-semibold text-[#efe0a8]">
              Honest limitations
            </h2>
          </div>
          <p className="mt-2.5 text-[13px] leading-relaxed text-zinc-400">
            SASI is in a demo environment. Production controls — encryption at rest, row-level
            security, independent SOC 2-style audits — are planned, not claimed. What you see
            here is the architecture and the intent; the certifications will be earned before
            they are advertised.
          </p>
        </section>

        <p className="mt-6 text-[11.5px] leading-relaxed text-zinc-600">
          All data in this environment is demonstration data. No real reports, evidence or
          personal information are processed.
        </p>
      </div>
    </div>
  );
}
