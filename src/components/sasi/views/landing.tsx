"use client";

import { motion, type Variants } from "framer-motion";
import {
  ArrowRight,
  ChevronRight,
  Eye,
  FileSearch,
  Flag,
  FlaskConical,
  MessageSquareQuote,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { DEMO_NOW, INCIDENTS, POPULAR_SERVICES } from "@/lib/sasi/data";
import { useSasiStore } from "@/lib/sasi/store";
import { SERVICES, timeAgo } from "@/lib/sasi/utils";
import type { TimelineEvent, TrustStatus } from "@/lib/sasi/types";
import {
  ConfidenceBar,
  DemoBadge,
  SERVICE_TINT,
  ServiceIcon,
  SasiPulse,
  StatusBadge,
} from "@/components/sasi/primitives";
import { IncidentCard, TimelineRail } from "@/components/sasi/domain";
import { cn } from "@/lib/utils";

/* ============================================================
   Landing — the homepage.
   90-95% monochrome; national color only as tiny light.
   ============================================================ */

/* Deterministic slices (fixed demo clock → stable render) */
const demoNowMs = new Date(DEMO_NOW).getTime();

const LATEST_INCIDENTS = [...INCIDENTS]
  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  .slice(0, 3);

const STATUS_ROW: TrustStatus[] = ["CONFIRMED", "REPORTED", "INFERRED", "UNVERIFIED"];

const EXAMPLE_PROMPTS = [
  "Why is my water off?",
  "Report a burst pipe",
  "Show incidents near me",
];

const DEMO_TIMELINE: TimelineEvent[] = [
  {
    id: "demo-ev-1",
    at: "2026-02-10T06:10:00+02:00",
    kind: "user",
    label: "You described the problem",
    detail: "\u201CNo water since early morning \u2014 taps dry across the building.\u201D",
  },
  {
    id: "demo-ev-2",
    at: "2026-02-10T06:11:00+02:00",
    kind: "ai",
    agent: "Research Agent",
    label: "SASI began researching",
    detail: "Checking utility notices and recent reports for this area.",
  },
  {
    id: "demo-ev-3",
    at: "2026-02-10T06:14:00+02:00",
    kind: "source",
    label: "Official maintenance notice found",
    detail: "Bulk maintenance scheduled on the northern network (demo reference).",
  },
  {
    id: "demo-ev-4",
    at: "2026-02-10T06:20:00+02:00",
    kind: "finding",
    agent: "Investigation Agent",
    label: "Finding prepared \u2014 AI-inferred",
    detail: "Outage consistent with planned maintenance. Confidence: medium.",
  },
  {
    id: "demo-ev-5",
    at: "2026-02-10T06:24:00+02:00",
    kind: "action",
    label: "Draft report awaiting your approval",
    detail: "Nothing is submitted without your approval.",
  },
];

const STEPS = [
  {
    n: "01",
    icon: MessageSquareQuote,
    title: "Tell SASI",
    copy: "Describe the problem in your own words. Add photos or notes if you have them \u2014 SASI does the structuring.",
  },
  {
    n: "02",
    icon: Sparkles,
    title: "SASI investigates",
    copy: "SASI researches sources, organises evidence and prepares findings \u2014 each with a status and a confidence level.",
  },
  {
    n: "03",
    icon: ShieldCheck,
    title: "You decide",
    copy: "Review what SASI found and what it proposes. Nothing consequential happens without your explicit approval.",
  },
];

const TRUST_ITEMS = [
  { icon: Flag, label: "Independent" },
  { icon: FileSearch, label: "Transparent sources" },
  { icon: UserCheck, label: "Human control" },
  { icon: FlaskConical, label: "Demo environment" },
];

const VIEWPORT = { once: true, margin: "-80px" };

const heroContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const heroItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.23, 1, 0.32, 1] } },
};

export default function LandingView() {
  const navigate = useSasiStore((s) => s.navigate);
  const setCommandOpen = useSasiStore((s) => s.setCommandOpen);
  const openService = useSasiStore((s) => s.openService);
  const openIncident = useSasiStore((s) => s.openIncident);

  return (
    <div className="relative overflow-x-clip">
      {/* ================================================== HERO */}
      <section aria-labelledby="hero-heading" className="sasi-grid-bg relative overflow-hidden">
        {/* very subtle national-light ambience */}
        <div
          aria-hidden
          className="sasi-ambient -top-28 left-[12%] h-72 w-[420px]"
          style={{ background: "radial-gradient(closest-side, rgba(100,181,246,0.12), transparent)" }}
        />
        <div
          aria-hidden
          className="sasi-ambient -top-12 right-[6%] h-64 w-80"
          style={{ background: "radial-gradient(closest-side, rgba(227,197,103,0.1), transparent)" }}
        />
        <div
          aria-hidden
          className="sasi-ambient bottom-0 left-1/2 h-72 w-[560px] -translate-x-1/2"
          style={{ background: "radial-gradient(closest-side, rgba(102,187,106,0.09), transparent)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#050505]"
        />

        <motion.div
          variants={heroContainer}
          initial="hidden"
          animate="show"
          className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pb-16 pt-16 text-center sm:px-6 sm:pb-24 sm:pt-24"
        >
          {/* eyebrow */}
          <motion.div variants={heroItem}>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
              <span
                className="sasi-breathe h-1.5 w-1.5 rounded-full"
                style={{ background: "linear-gradient(90deg, #ef5350, #64b5f6, #66bb6a, #e3c567)" }}
              />
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                Independent civic technology
              </span>
            </span>
          </motion.div>

          {/* headline */}
          <motion.h1
            id="hero-heading"
            variants={heroItem}
            className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl"
          >
            Civic intelligence for{" "}
            <span className="bg-gradient-to-r from-[#64b5f6] via-[#66bb6a] to-[#e3c567] bg-clip-text text-transparent">
              South Africa
            </span>
            .
          </motion.h1>

          {/* sub copy */}
          <motion.p
            variants={heroItem}
            className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-zinc-400 sm:text-[15.5px]"
          >
            Understand what is happening. Build the evidence. Take the next step.
          </motion.p>

          {/* CTAs */}
          <motion.div variants={heroItem} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => navigate("report")}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-5 text-[13.5px] font-medium text-black transition-all hover:bg-zinc-200 active:scale-[0.98]"
            >
              Tell SASI what is happening
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
            <button
              onClick={() => navigate("services")}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-5 text-[13.5px] font-medium text-zinc-300 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white active:scale-[0.98]"
            >
              Explore civic services
            </button>
          </motion.div>

          {/* command bar */}
          <motion.div variants={heroItem} className="mt-10 w-full max-w-xl">
            <div className="sasi-command-focus rounded-2xl border border-white/10 bg-white/[0.03] transition-colors hover:border-white/20">
              <button
                onClick={() => setCommandOpen(true)}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left"
                aria-label="Open the SASI command bar to search or ask"
              >
                <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                <span className="flex-1 truncate text-[13.5px] text-zinc-500">
                  Search services, cases, incidents or ask SASI…
                </span>
                <kbd className="hidden shrink-0 items-center rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-zinc-500 sm:inline-flex">
                  ⌘K
                </kbd>
              </button>
            </div>

            {/* example prompts */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setCommandOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/8 px-3 py-1.5 text-[12px] text-zinc-500 transition-colors hover:border-white/15 hover:text-zinc-200"
                >
                  <span
                    className="h-1 w-1 rounded-full"
                    style={{ background: "linear-gradient(90deg, #64b5f6, #e3c567)" }}
                  />
                  {prompt}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ================================================== TRUST BAR */}
      <section aria-label="SASI principles" className="border-y border-white/5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-3.5 sm:px-6">
          {TRUST_ITEMS.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600">
              <item.icon className="h-3 w-3 text-zinc-600" aria-hidden />
              {item.label}
            </span>
          ))}
        </div>
      </section>

      {/* ================================================== POPULAR SERVICES */}
      <section aria-labelledby="services-heading">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Popular services
            </p>
            <h2 id="services-heading" className="mt-1.5 text-lg font-semibold tracking-tight text-white sm:text-xl">
              Get help with the things that affect everyday life.
            </h2>

            <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {POPULAR_SERVICES.map((key) => {
                const svc = SERVICES[key];
                return (
                  <button
                    key={key}
                    onClick={() => openService(key)}
                    className="sasi-card sasi-card-interactive group p-4 text-left"
                    aria-label={`Open ${svc.label} services`}
                  >
                    <div className="flex items-start justify-between">
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]",
                          SERVICE_TINT[key]
                        )}
                      >
                        <ServiceIcon service={key} className="h-4 w-4" />
                      </span>
                      <ChevronRight
                        className="mt-1 h-3.5 w-3.5 text-zinc-700 transition-all group-hover:translate-x-0.5 group-hover:text-zinc-400"
                        aria-hidden
                      />
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-[13.5px] font-medium text-white">
                      {svc.label}
                      <span className={cn("h-1 w-1 rounded-full bg-current", SERVICE_TINT[key])} />
                    </p>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-zinc-500">
                      {svc.blurb}
                    </p>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================================== LIVE CIVIC INTELLIGENCE */}
      <section aria-labelledby="live-heading">
        <div className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 sm:pb-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="sasi-card p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 id="live-heading" className="text-[15px] font-semibold tracking-tight text-white">
                Live civic intelligence
              </h2>
              <DemoBadge label="DEMO DATA" />
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-400">
                <span className="sasi-breathe h-1.5 w-1.5 rounded-full bg-[#66bb6a]" />
                SASI is monitoring
              </span>
            </div>
            <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-zinc-500">
              The latest signals from the demo dataset — each carrying an honest status, never presented as fact.
            </p>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {LATEST_INCIDENTS.map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  onOpen={() => openIncident(incident.id)}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================================== HOW SASI WORKS */}
      <section aria-labelledby="how-heading" className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              How SASI works
            </p>
            <h2 id="how-heading" className="mt-1.5 text-lg font-semibold tracking-tight text-white sm:text-xl">
              Three steps. You stay in control of the last one.
            </h2>

            <div className="mt-8 grid gap-8 md:grid-cols-3 md:gap-6">
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={step.n}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={VIEWPORT}
                    transition={{ duration: 0.4, ease: "easeOut", delay: i * 0.08 }}
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-[11px] tracking-[0.14em] text-zinc-600">
                        {step.n}
                      </span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]">
                        <Icon className="h-4 w-4 text-zinc-300" aria-hidden />
                      </span>
                    </div>
                    <h3 className="mt-3 text-[14.5px] font-semibold text-white">{step.title}</h3>
                    <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-zinc-500">
                      {step.copy}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================================== INVESTIGATION WORKFLOW PREVIEW */}
      <section aria-labelledby="workflow-heading">
        <div className="mx-auto max-w-6xl px-4 pb-14 sm:px-6 sm:pb-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-12">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                The agentic loop
              </p>
              <h2 id="workflow-heading" className="mt-1.5 text-lg font-semibold tracking-tight text-white sm:text-xl">
                An investigation you can watch.
              </h2>
              <p className="mt-3 max-w-md text-[13.5px] leading-relaxed text-zinc-400">
                SASI researches sources, organizes evidence and prepares findings — never acting
                without your approval. Every step lands on the case timeline, in plain language,
                with the agent that did it.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "Every event is timestamped on the case timeline.",
                  "Every agent that acted is named.",
                  "Every consequential action waits for you.",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-[13px] text-zinc-400">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                    {line}
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VIEWPORT}
              transition={{ duration: 0.45, ease: "easeOut", delay: 0.08 }}
            >
              <SasiPulse color="multi" className="sasi-card p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-zinc-500">
                    SAMPLE INVESTIGATION
                  </p>
                  <DemoBadge label="DEMO" />
                </div>
                <TimelineRail events={DEMO_TIMELINE} live className="mt-4" />
              </SasiPulse>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ================================================== EVIDENCE & TRANSPARENCY */}
      <section aria-labelledby="evidence-heading" className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Evidence &amp; transparency
            </p>
            <h2 id="evidence-heading" className="mt-1.5 text-lg font-semibold tracking-tight text-white sm:text-xl">
              Built to be checked, not just believed.
            </h2>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {/* card 1 */}
              <div className="sasi-card p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]">
                  <FileSearch className="h-4 w-4 text-zinc-300" aria-hidden />
                </span>
                <h3 className="mt-3 text-[14px] font-semibold text-white">
                  Every claim has a status
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500">
                  Confirmed, reported, inferred or unverified — nothing is dressed up as fact.
                  Status travels with the claim.
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {STATUS_ROW.map((status) => (
                    <StatusBadge key={status} status={status} size="sm" />
                  ))}
                </div>
              </div>

              {/* card 2 */}
              <div className="sasi-card p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]">
                  <Eye className="h-4 w-4 text-zinc-300" aria-hidden />
                </span>
                <h3 className="mt-3 text-[14px] font-semibold text-white">
                  Every finding shows its evidence
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500">
                  Findings link back to the sources and evidence behind them, with an explicit
                  confidence level you can weigh yourself.
                </p>
                <div className="mt-4">
                  <ConfidenceBar confidence="HIGH" />
                </div>
              </div>

              {/* card 3 */}
              <div className="sasi-card p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]">
                  <ShieldCheck className="h-4 w-4 text-zinc-300" aria-hidden />
                </span>
                <h3 className="mt-3 text-[14px] font-semibold text-white">
                  Every action needs your approval
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500">
                  SASI proposes; you decide. Consequential actions show what will happen, what is
                  shared and who receives it — before anything moves.
                </p>
                <p className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-white/8 bg-white/[0.03] px-2 py-1 text-[11px] text-zinc-400">
                  <span className="sasi-breathe h-1.5 w-1.5 rounded-full bg-[#e3c567]" />
                  Approval gate always on
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ================================================== TRUST / HUMAN CONTROL BAND */}
      <section aria-labelledby="trust-heading" className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <ShieldCheck className="mx-auto h-5 w-5 text-zinc-500" aria-hidden />
          <h2 id="trust-heading" className="mt-4 text-lg font-semibold tracking-tight text-white sm:text-xl">
            Clear sources. Transparent findings. Human control.
          </h2>
          <p className="mx-auto mt-2.5 max-w-xl text-[13.5px] leading-relaxed text-zinc-500">
            SASI is built to be questioned. Check the sources, weigh the confidence, and make the
            call yourself — that is the point.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            <button
              onClick={() => navigate("how-it-works")}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 text-[13px] font-medium text-zinc-300 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white active:scale-[0.98]"
            >
              How it works
            </button>
            <button
              onClick={() => navigate("security")}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 text-[13px] font-medium text-zinc-300 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white active:scale-[0.98]"
            >
              Security
            </button>
          </div>
        </div>
      </section>

      {/* ================================================== LATEST CIVIC INFORMATION */}
      <section aria-labelledby="latest-heading" className="border-t border-white/5">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:pb-20 sm:pt-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Recent signals
              </p>
              <h2 id="latest-heading" className="mt-1.5 text-lg font-semibold tracking-tight text-white">
                Latest civic information
              </h2>
            </div>
            <DemoBadge label="DEMO DATA" />
          </div>

          <div className="sasi-card mt-6 px-4 py-1.5">
            {LATEST_INCIDENTS.map((incident) => (
              <button
                key={incident.id}
                onClick={() => openIncident(incident.id)}
                className="flex w-full items-center gap-3 border-t border-white/5 px-1 py-3 text-left transition-colors first:border-t-0 hover:bg-white/[0.02]"
                aria-label={`Open incident ${incident.ref}: ${incident.title}`}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full bg-current",
                    SERVICE_TINT[incident.service]
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-zinc-200">
                  {incident.title}
                </span>
                <span className="hidden font-mono text-[10px] tracking-wider text-zinc-600 sm:inline">
                  {incident.ref}
                </span>
                <StatusBadge status={incident.status} size="sm" />
                <span className="w-16 shrink-0 text-right font-mono text-[10.5px] text-zinc-600">
                  {timeAgo(incident.updatedAt, demoNowMs)}
                </span>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-700" aria-hidden />
              </button>
            ))}
          </div>

          <p className="mt-4 text-[11.5px] text-zinc-600">
            Demo environment — every incident above is demonstration data with a demonstrable
            status, not live information.
          </p>
        </div>
      </section>
    </div>
  );
}
