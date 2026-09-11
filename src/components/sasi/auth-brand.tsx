"use client";

/* ============================================================
   AUTH BRAND SHELL (Task 14) — shared fashion for login/signup:
   dot-veiled brand panel with the circulating hero word, a
   floating glass top bar, and the shared glow field shell.
   Logic-free: pure presentation + navigation only.
   ============================================================ */

import { ArrowLeft, BadgeCheck, Megaphone, SearchCheck } from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { SasiLogo } from "@/components/sasi/primitives";

export const NATIONAL_DOT_GRADIENT =
  "linear-gradient(90deg, #ef5350, #64b5f6, #66bb6a, #e3c567)";

/* Shared field shell — circulating national glow ring appears on focus */
export function AuthGlowField({ children }: { children: React.ReactNode }) {
  return (
    <div className="sasi-search-glow rounded-xl border border-white/10 bg-white/[0.03] transition-colors focus-within:border-white/20">
      {children}
    </div>
  );
}

export const AUTH_FIELD_INPUT =
  "h-11 rounded-xl border-0 bg-transparent text-[13px] shadow-none focus-visible:shadow-none focus-visible:ring-0";

/* ---------- Floating glass top bar (spans both auth panels) ---------- */
export function AuthTopBar() {
  const navigate = useSasiStore((s) => s.navigate);
  return (
    <div className="sasi-auth-nav absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-between px-5 sm:px-8">
      <button
        onClick={() => navigate("landing")}
        aria-label="SASI — back to home"
        className="-ml-1 inline-flex h-11 items-center rounded-xl px-1 transition-opacity hover:opacity-80"
      >
        <SasiLogo size={26} />
      </button>

      <div className="flex items-center gap-4">
        <span
          aria-hidden={false}
          className="hidden items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-zinc-600 sm:flex"
        >
          <span
            aria-hidden
            className="h-1 w-1 rounded-full"
            style={{ background: NATIONAL_DOT_GRADIENT }}
          />
          Not a government website
        </span>
        <button
          onClick={() => navigate("landing")}
          className="sasi-btn-glass inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[12px] font-medium text-zinc-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to home
        </button>
      </div>
    </div>
  );
}

/* ---------- Left brand panel — dots, hero word, principles plate ---------- */
const PRINCIPLES = [
  {
    icon: Megaphone,
    title: "Report",
    body: "Log a service failure in your own words, with photos.",
  },
  {
    icon: SearchCheck,
    title: "Investigate",
    body: "SASI assembles a timeline and evidence you control.",
  },
  {
    icon: BadgeCheck,
    title: "Approve",
    body: "Nothing is ever submitted without your sign-off.",
  },
] as const;

export function AuthBrandPanel({ accent }: { accent: "red" | "gold" }) {
  const ambients =
    accent === "red"
      ? {
          top: "radial-gradient(closest-side, rgba(229,57,53,0.11), transparent)",
          bottom:
            "radial-gradient(closest-side, rgba(66,165,245,0.10), transparent)",
        }
      : {
          top: "radial-gradient(closest-side, rgba(227,197,103,0.10), transparent)",
          bottom:
            "radial-gradient(closest-side, rgba(102,187,106,0.09), transparent)",
        };

  return (
    <aside
      aria-hidden={false}
      className="relative hidden w-[44%] max-w-[620px] shrink-0 flex-col justify-between overflow-hidden border-r border-white/6 bg-[#070708] p-10 pb-12 pt-24 lg:flex xl:p-14 xl:pt-28"
    >
      {/* phase-3 dot matrix, melted at the edges */}
      <div aria-hidden className="sasi-dot-veil absolute inset-0 opacity-70" />

      {/* giant outlined background word with circulating national light */}
      <div aria-hidden className="sasi-hero-word">
        SASI
      </div>

      {/* breathing national ambience */}
      <div
        aria-hidden
        className="sasi-ambient -left-24 -top-24 h-96 w-96"
        style={{ background: ambients.top }}
      />
      <div
        aria-hidden
        className="sasi-ambient -bottom-32 right-[-10%] h-[420px] w-[420px]"
        style={{ background: ambients.bottom }}
      />

      {/* top — editorial eyebrow */}
      <div className="relative">
        <div className="sasi-eyebrow text-zinc-400">
          <span
            aria-hidden
            className="sasi-breathe h-1.5 w-1.5 rounded-full"
            style={{ background: NATIONAL_DOT_GRADIENT }}
          />
          Service intelligence
        </div>
      </div>

      {/* middle — serif statement + liquid glass principles plate */}
      <div className="relative max-w-md">
        <h2 className="sasi-serif text-[38px] font-medium leading-[1.1] tracking-tight text-white xl:text-[44px]">
          Service intelligence for South&nbsp;Africa.
        </h2>
        <p className="mt-5 max-w-sm text-[13.5px] leading-relaxed text-zinc-500">
          Independent civic technology. Not a government website.
        </p>

        <div className="sasi-auth-card mt-9 space-y-4 !rounded-3xl p-5">
          {PRINCIPLES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex items-start gap-3.5">
              <span className="sasi-principle-tile" aria-hidden>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold tracking-wide text-zinc-100">
                  {title}
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* bottom — national accent dot */}
      <div className="relative flex items-center gap-3">
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: NATIONAL_DOT_GRADIENT }}
        />
        <p className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-zinc-600">
          South African Service Intelligence
        </p>
      </div>
    </aside>
  );
}
