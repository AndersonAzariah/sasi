"use client";

/* ============================================================
   AUTH BRAND SHELL (Task 14) — shared fashion for login/signup:
   dot-veiled brand panel with the circulating hero word, a
   floating glass top bar, and the shared glow field shell.
   Logic-free: pure presentation + navigation only.
   ============================================================ */

import { ArrowLeft, BadgeCheck, Megaphone, SearchCheck, ShieldCheck, Lock, Sparkles } from "lucide-react";
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
    n: "01",
    icon: Megaphone,
    accent: "#ef5350",
    title: "Report",
    body: "Log a service failure in your own words, with photos.",
  },
  {
    n: "02",
    icon: SearchCheck,
    accent: "#64b5f6",
    title: "Investigate",
    body: "SASI assembles a timeline and evidence you control.",
  },
  {
    n: "03",
    icon: BadgeCheck,
    accent: "#e3c567",
    title: "Approve",
    body: "Nothing is ever submitted without your sign-off.",
  },
] as const;

const TRUST_CHIPS = [
  { icon: ShieldCheck, label: "Local-first" },
  { icon: Lock, label: "Approval-gated" },
  { icon: Sparkles, label: "AI-assisted \u2014 unverified" },
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

      {/* corner orbit ornament — faint static track + slow national ring */}
      <div aria-hidden className="sasi-boot-orbit right-[-70px] top-[-70px] h-44 w-44" />
      <div
        aria-hidden
        className="sasi-boot-ring right-[-58px] top-[-58px] h-20 w-20 opacity-50"
        style={{ animationDuration: "9s" }}
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
          Service intelligence for{" "}
          <em
            className="bg-clip-text text-transparent"
            style={{
              fontStyle: "italic",
              backgroundImage:
                "linear-gradient(100deg, #f28b87, #90caf9 42%, #a5d6a7 68%, #eed582)",
            }}
          >
            South Africa.
          </em>
        </h2>
        <p className="mt-5 max-w-sm text-[13.5px] leading-relaxed text-zinc-500">
          Independent civic technology. Not a government website.
        </p>

        <div className="sasi-auth-card mt-9 !rounded-3xl p-5">
          <div className="space-y-1">
            {PRINCIPLES.map(({ n, icon: Icon, accent, title, body }) => (
              <div
                key={title}
                className="group flex items-start gap-3.5 rounded-2xl p-2 transition-colors duration-300 hover:bg-white/[0.04]"
              >
                <span className="sasi-serif w-6 shrink-0 pt-1 text-[13px] font-medium text-zinc-600 transition-colors duration-300 group-hover:text-zinc-300">
                  {n}
                </span>
                <span
                  className="sasi-principle-tile transition-transform duration-300 group-hover:scale-105"
                  style={{
                    color: accent,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.14), 0 0 18px -6px ${accent}55`,
                  }}
                  aria-hidden
                >
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

          {/* trust chips — honest by design */}
          <div
            className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/6 pt-4"
            aria-label="Design principles"
          >
            {TRUST_CHIPS.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10.5px] font-medium tracking-wide text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
              >
                <Icon className="h-3 w-3 text-zinc-500" aria-hidden />
                {label}
              </span>
            ))}
          </div>
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
