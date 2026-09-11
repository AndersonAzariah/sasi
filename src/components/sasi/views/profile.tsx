"use client";

import { useMemo } from "react";
import {
  ArrowRight,
  Bell,
  Camera,
  Globe,
  LogOut,
  MapPin,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { DEMO_USER } from "@/lib/sasi/data";
import { signOut as nextAuthSignOut } from "next-auth/react";
import { formatDate, initials } from "@/lib/sasi/utils";
import {
  DemoBadge,
  GhostButton,
  SectionLabel,
  StatTile,
} from "@/components/sasi/primitives";
import { CaseCard } from "@/components/sasi/domain";
import { cn } from "@/lib/utils";

const ACTIVE_AI_STATES = new Set([
  "UNDERSTANDING",
  "RESEARCHING",
  "CORRELATING",
  "VERIFYING",
  "PREPARING_FINDINGS",
  "WAITING_FOR_APPROVAL",
  "ACTING",
  "VERIFYING_RESULT",
]);

export default function ProfileView() {
  const cases = useSasiStore((s) => s.cases);
  const evidence = useSasiStore((s) => s.evidence);
  const savedLocation = useSasiStore((s) => s.savedLocation);
  const openCase = useSasiStore((s) => s.openCase);
  const navigate = useSasiStore((s) => s.navigate);
  const signOut = useSasiStore((s) => s.signOut);

  const activeInvestigations = useMemo(
    () => cases.filter((c) => ACTIVE_AI_STATES.has(c.aiState)).length,
    [cases]
  );
  const recentCases = useMemo(() => cases.slice(0, 2), [cases]);

  const preferences = [
    { icon: Bell, label: "Notifications", detail: "What SASI tells you about" },
    { icon: Sparkles, label: "AI permissions", detail: "What SASI may do without asking" },
    { icon: Globe, label: "Accessibility", detail: "Motion, contrast and text size" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ---------- Header card ---------- */}
      <section aria-labelledby="profile-heading" className="sasi-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[20px] font-semibold tracking-wide text-white"
            aria-hidden
          >
            {initials(DEMO_USER.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 id="profile-heading" className="text-lg font-semibold tracking-tight text-white">
                {DEMO_USER.name}
              </h1>
              <DemoBadge label="DEMO ACCOUNT" />
            </div>
            <p className="mt-0.5 truncate text-[13px] text-zinc-400">{DEMO_USER.email}</p>
            <p className="mt-1 text-[12px] text-zinc-600">
              Member since {formatDate(DEMO_USER.memberSince)}
            </p>
          </div>
          <p className="flex items-center gap-1.5 self-start rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-[12px] text-zinc-300 sm:self-center">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#ef5350]" aria-hidden />
            {savedLocation.suburb ? `${savedLocation.suburb}, ` : ""}
            {savedLocation.city}, {savedLocation.province}
          </p>
        </div>
      </section>

      {/* ---------- Your activity ---------- */}
      <section aria-labelledby="profile-activity" className="mt-8">
        <SectionLabel className="mb-3">Your activity</SectionLabel>
        <h2 id="profile-activity" className="sr-only">
          Your activity
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile label="Cases" value={cases.length} hint="Reported through SASI" />
          <StatTile
            label="Evidence items"
            value={evidence.length}
            hint="Photos, notes and links you attached"
          />
          <StatTile
            label="Investigations"
            value={activeInvestigations}
            hint="Currently being worked by SASI"
            tone={activeInvestigations > 0 ? "gold" : "default"}
          />
        </div>
      </section>

      {/* ---------- Your cases ---------- */}
      <section aria-labelledby="profile-cases" className="mt-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <SectionLabel>Your cases</SectionLabel>
          <GhostButton onClick={() => navigate("cases")} className="h-7 px-2.5 text-[11.5px]">
            View all
            <ArrowRight className="h-3 w-3" aria-hidden />
          </GhostButton>
        </div>
        <h2 id="profile-cases" className="sr-only">
          Your cases
        </h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {recentCases.map((c) => (
            <CaseCard key={c.id} c={c} onOpen={() => openCase(c.ref)} />
          ))}
        </div>
      </section>

      {/* ---------- Saved locations ---------- */}
      <section aria-labelledby="profile-locations" className="mt-8">
        <SectionLabel className="mb-3">Saved locations</SectionLabel>
        <h2 id="profile-locations" className="sr-only">
          Saved locations
        </h2>
        <div className="sasi-card flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]">
              <MapPin className="h-4 w-4 text-[#ef5350]" aria-hidden />
            </span>
            <div>
              <p className="text-[13.5px] font-medium text-white">
                {savedLocation.suburb ? `${savedLocation.suburb}, ` : ""}
                {savedLocation.city}
              </p>
              <p className="mt-0.5 text-[12px] text-zinc-500">
                {savedLocation.province} · used to localise incidents and defaults
              </p>
            </div>
          </div>
          <GhostButton onClick={() => navigate("settings")} className="shrink-0">
            Edit in Settings
          </GhostButton>
        </div>
      </section>

      {/* ---------- Session ---------- */}
      <section aria-labelledby="profile-session" className="mt-8 pb-4">
        <SectionLabel className="mb-3">Session</SectionLabel>
        <h2 id="profile-session" className="sr-only">
          Session
        </h2>
        <div className="sasi-card flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]">
              <LogOut className="h-4 w-4 text-zinc-400" aria-hidden />
            </span>
            <div>
              <p className="text-[13.5px] font-medium text-white">Sign out of SASI</p>
              <p className="mt-0.5 max-w-md text-[12px] leading-relaxed text-zinc-500">
                Ends this demo session on this browser. Your cases, evidence and chat
                history stay saved here and will be waiting when you return.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              /* clear BOTH the NextAuth JWT cookie session and the UI flag */
              void nextAuthSignOut({ redirect: false });
              signOut();
              navigate("landing");
            }}
            className="group inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-[#ef5350]/25 bg-[#ef5350]/[0.06] px-3.5 text-[12.5px] font-medium text-[#fda4a0] transition-colors hover:border-[#ef5350]/40 hover:bg-[#ef5350]/[0.1] active:scale-[0.98]"
            aria-label="Sign out of SASI"
          >
            <LogOut className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden />
            Sign out
          </button>
        </div>
      </section>

      {/* ---------- Preferences ---------- */}
      <section aria-labelledby="profile-preferences" className="mt-8 pb-4">
        <SectionLabel className="mb-3">Preferences</SectionLabel>
        <h2 id="profile-preferences" className="sr-only">
          Preferences
        </h2>
        <ul className="sasi-card divide-y divide-white/5 overflow-hidden p-0">
          {preferences.map((pref) => (
            <li key={pref.label}>
              <button
                onClick={() => navigate("settings")}
                className="group flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]"
                aria-label={`${pref.label} — open in Settings`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]">
                  <pref.icon className="h-3.5 w-3.5 text-zinc-300" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium text-white">{pref.label}</span>
                  <span className="block truncate text-[12px] text-zinc-500">{pref.detail}</span>
                </span>
                <ArrowRight
                  className={cn(
                    "h-4 w-4 shrink-0 text-zinc-700 transition-colors group-hover:text-zinc-300"
                  )}
                  aria-hidden
                />
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-center gap-2 text-[12px] text-zinc-600">
          <Camera className="h-3.5 w-3.5" aria-hidden />
          Evidence storage and AI permissions live in Settings.
          <ShieldAlert className="ml-1 h-3.5 w-3.5" aria-hidden />
          Nothing is submitted without your approval.
        </p>
      </section>
    </div>
  );
}
