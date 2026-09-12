"use client";

/* ============================================================
   AUTH BRAND SHELL (Task 21) — shared fashion for login/signup.
   The left panel is now the SASIAUTH hero photograph (storm sky,
   the S mark, the city at dusk, national light trails) behind
   gradient scrims, with the editorial statement up top and the
   principles plate at the bottom. On <lg screens the photograph
   becomes a compact banner above the form card.
   Logic-free: pure presentation + navigation only.
   ============================================================ */

import { useEffect, useRef } from "react";
import Image from "next/image";
import { gsap } from "gsap";
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

/* ---------- The SASIAUTH photograph, shared by panel + banner ---------- */
const AUTH_IMG = "/sasi-auth.webp";
const AUTH_IMG_FALLBACK = "/SASIAUTH.png";
const AUTH_BLUR =
  "data:image/webp;base64,UklGRpIAAABXRUJQVlA4IIYAAABQBACdASoQABgAPu1iqU2ppaQiMAgBMB2JQBkXCYwWYy//N7r6iojfmEEAAP7xS+8idelocArxCIinc8STQe/RYDk2Pr0bIvycQoysYxA93nuC6b2t/PiA1Vzd1gLvlaMpm3Qp2IbqmSq4eSD33wFRMz/IAwxsO/nw7xYsEChzAgA2oAAAAA==";

/** Gradient scrims so editorial type stays readable over the photo. */
function AuthImageScrims() {
  return (
    <>
      {/* top — storm sky anchor for the eyebrow + headline */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-[46%] bg-gradient-to-b from-[#050505]/88 via-[#050505]/42 to-transparent"
      />
      {/* bottom — deep anchor for the principles plate + brand line */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-t from-[#050505]/94 via-[#050505]/58 to-transparent"
      />
      {/* left edge — seams the photo into the page background */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#050505]/72 to-transparent"
      />
    </>
  );
}

/* ---------- Left brand panel — the SASIAUTH photograph ---------- */
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
  const panelRef = useRef<HTMLElement | null>(null);

  /* GSAP entrance — the statement, plate and brand line rise in
     sequence over the photograph (reduced-motion-safe by guard). */
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (document.documentElement.classList.contains("sasi-data-saver")) return;

    const targets = panel.querySelectorAll("[data-auth-reveal]");
    if (!targets.length) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0, y: 18 },
        {
          opacity: 1,
          y: 0,
          duration: 0.85,
          ease: "power3.out",
          stagger: 0.12,
          delay: 0.1,
          clearProps: "transform",
        }
      );
      /* the photograph itself settles from a gentle 1.04 push-in */
      const photo = panel.querySelector("[data-auth-photo]");
      if (photo) {
        gsap.fromTo(
          photo,
          { scale: 1.045, opacity: 0.4 },
          { scale: 1, opacity: 1, duration: 1.6, ease: "power2.out" }
        );
      }
    }, panel);

    return () => ctx.revert();
  }, []);

  return (
    <aside
      ref={panelRef}
      aria-hidden={false}
      className="relative hidden w-[44%] max-w-[620px] shrink-0 flex-col justify-between overflow-hidden border-r border-white/6 bg-[#070708] p-10 pb-12 pt-24 lg:flex xl:p-14 xl:pt-28"
    >
      {/* the SASIAUTH photograph — full bleed */}
      <div className="absolute inset-0" aria-hidden>
        <Image
          data-auth-photo
          src={AUTH_IMG}
          alt=""
          fill
          priority
          quality={88}
          placeholder="blur"
          blurDataURL={AUTH_BLUR}
          sizes="(min-width: 1280px) 620px, 44vw"
          className="object-cover object-center select-none"
          onError={(e) => {
            const img = e.target as HTMLImageElement;
            if (img.srcset || img.src.includes(AUTH_IMG_FALLBACK)) return;
            img.src = AUTH_IMG_FALLBACK;
          }}
        />
        <AuthImageScrims />
      </div>

      {/* top — editorial eyebrow + statement (over the storm sky) */}
      <div className="relative">
        <div data-auth-reveal className="sasi-eyebrow text-zinc-400">
          <span
            aria-hidden
            className="sasi-breathe h-1.5 w-1.5 rounded-full"
            style={{ background: NATIONAL_DOT_GRADIENT }}
          />
          Service intelligence
        </div>
        <h2
          data-auth-reveal
          className="sasi-serif mt-6 max-w-md text-[36px] font-medium leading-[1.08] tracking-tight text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.65)] xl:text-[42px]"
        >
          Service intelligence for{" "}
          <em className="italic text-white">South Africa.</em>
        </h2>
        <p
          data-auth-reveal
          className="mt-4 max-w-sm text-[13.5px] leading-relaxed text-zinc-300 drop-shadow-[0_1px_10px_rgba(0,0,0,0.9)]"
        >
          Independent civic technology. Not a government website.
        </p>
      </div>

      {/* middle stays open — the S mark and the city light trails breathe */}

      {/* bottom — principles plate + trust chips over the city dusk */}
      <div className="relative">
        <div data-auth-reveal className="sasi-auth-card mt-9 !rounded-3xl p-5">
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

        <div
          data-auth-reveal
          className="mt-6 flex items-center gap-3 drop-shadow-[0_1px_8px_rgba(0,0,0,0.8)]"
        >
          <span
            aria-hidden
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: NATIONAL_DOT_GRADIENT }}
          />
          <p className="text-[10.5px] font-medium uppercase tracking-[0.24em] text-zinc-500">
            South African Service Intelligence
          </p>
        </div>
      </div>
    </aside>
  );
}

/* ---------- Mobile banner — compact SASIAUTH strip above the form ---------- */
export function AuthMobileBanner({ accent }: { accent: "red" | "gold" }) {
  return (
    <div className="sasi-auth-card relative mb-5 h-40 w-full overflow-hidden !rounded-3xl lg:hidden">
      <Image
        src={AUTH_IMG}
        alt="SASI — the S mark over a South African city at dusk, wrapped in national light trails"
        fill
        priority
        quality={80}
        placeholder="blur"
        blurDataURL={AUTH_BLUR}
        sizes="100vw"
        className="object-cover object-[center_26%]"
        onError={(e) => {
          const img = e.target as HTMLImageElement;
          if (img.src.includes(AUTH_IMG_FALLBACK)) return;
          img.src = AUTH_IMG_FALLBACK;
        }}
      />
      {/* scrims + wordmark line */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#050505]/90 via-[#050505]/30 to-transparent"
      />
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-[#050505]/60 to-transparent"
      />
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
        <div>
          <p className="sasi-serif text-[17px] font-medium leading-tight text-white">
            Service intelligence for{" "}
            <em className="italic text-white">South Africa.</em>
          </p>
          <p className="mt-1 text-[10.5px] uppercase tracking-[0.2em] text-zinc-500">
            Not a government website
          </p>
        </div>
        <span
          aria-hidden
          className="mb-1 h-1.5 w-1.5 shrink-0 rounded-full"
          style={{
            background: NATIONAL_DOT_GRADIENT,
            boxShadow:
              accent === "red"
                ? "0 0 10px rgba(229,57,53,0.7)"
                : "0 0 10px rgba(212,175,55,0.7)",
          }}
        />
      </div>
    </div>
  );
}
