"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSasiStore } from "@/lib/sasi/store";
import { useT } from "@/lib/sasi/i18n";
import type { View } from "@/lib/sasi/types";
import { SasiLogo } from "./primitives";

const NAV: { view: View; label: string }[] = [
  { view: "services", label: "landing.nav.services" },
  { view: "how-it-works", label: "landing.nav.how" },
  { view: "about", label: "landing.nav.about" },
  { view: "gov", label: "landing.nav.gov" },
  { view: "security", label: "landing.nav.security" },
];

export function PublicShell({ children }: { children: React.ReactNode }) {
  const navigate = useSasiStore((s) => s.navigate);
  const view = useSasiStore((s) => s.view);
  const authed = useSasiStore((s) => s.authed);
  const t = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const isLanding = view === "landing";

  /* Auth views render BARE — split screen fills the viewport, no nav, no footer */
  const isAuthView = view === "login" || view === "signup";

  return (
    <div className="flex min-h-screen flex-col bg-[#050505]">
      {isAuthView ? null : (
      <header
        className={cn(
          "sticky top-0 z-40 border-b border-white/[0.06]",
          "bg-[#050505]/55 backdrop-blur-2xl [backdrop-filter:blur(24px)_saturate(160%)]",
          "shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_12px_32px_-24px_rgba(0,0,0,0.9)]",
          isLanding && "bg-transparent shadow-none"
        )}
      >
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-5 px-4 sm:px-6">
          <button onClick={() => navigate("landing")} aria-label="SASI home">
            <SasiLogo size={28} />
          </button>

          <nav
            className="ml-3 hidden items-center gap-0.5 rounded-full border border-white/[0.06] bg-white/[0.03] p-1 md:flex"
            aria-label="Public"
          >
            {NAV.map((item) => (
              <button
                key={item.view}
                onClick={() => navigate(item.view)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[13px] transition-all duration-200",
                  view === item.view
                    ? "bg-white/[0.09] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                    : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-100"
                )}
              >
                {t(item.label)}
              </button>
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-2 md:flex">
            <button
              onClick={() => navigate(authed ? "dashboard" : "login")}
              className="rounded-full px-3.5 py-1.5 text-[13px] text-zinc-400 transition hover:bg-white/[0.05] hover:text-white"
            >
              {authed ? t("public.go-to-dashboard") : t("public.sign-in")}
            </button>
            <button
              onClick={() => navigate("report")}
              className="sasi-btn-white-glass rounded-full bg-white px-4 py-1.5 text-[13px] font-medium text-black transition-all hover:bg-zinc-100 active:scale-[0.98]"
            >
              {t("landing.cta.report")}
            </button>
          </div>

          <button
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-zinc-300 md:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-white/6 bg-[#070708] px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map((item) => (
                <button
                  key={item.view}
                  onClick={() => {
                    navigate(item.view);
                    setMenuOpen(false);
                  }}
                  className="rounded-lg px-3 py-2.5 text-left text-[14px] text-zinc-300 hover:bg-white/[0.04]"
                >
                  {t(item.label)}
                </button>
              ))}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    navigate(authed ? "dashboard" : "login");
                    setMenuOpen(false);
                  }}
                  className="rounded-full border border-white/10 py-2.5 text-[13px] text-zinc-300"
                >
                  {authed ? t("public.go-to-dashboard") : t("public.sign-in")}
                </button>
                <button
                  onClick={() => {
                    navigate("report");
                    setMenuOpen(false);
                  }}
                  className="rounded-full bg-white py-2.5 text-[13px] font-medium text-black"
                >
                  Report an issue
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
      )}

      <main className="flex-1">{children}</main>

      {isAuthView ? null : (
      <footer className="mt-auto border-t border-white/6 bg-[#060606]">
        <div className="sasi-hairline-rainbow" aria-hidden />
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <div className="flex flex-col gap-10 md:flex-row md:justify-between">
            <div className="max-w-sm">
              <SasiLogo size={30} />
              <p className="mt-4 text-[13px] font-medium text-zinc-300">
                South African Service Intelligence
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-600">
                Independent civic technology platform. SASI is not a government
                website and is not affiliated with any government department.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                  Product
                </p>
                <ul className="space-y-2 text-[13px] text-zinc-500">
                  {NAV.map((item) => (
                    <li key={item.view}>
                      <button
                        onClick={() => navigate(item.view)}
                        className="transition hover:text-zinc-200"
                      >
                        {t(item.label)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                  Trust
                </p>
                <ul className="space-y-2 text-[13px] text-zinc-500">
                  <li>
                    <button onClick={() => navigate("security")} className="transition hover:text-zinc-200">
                      Security
                    </button>
                  </li>
                  <li>
                    <button onClick={() => navigate("privacy")} className="transition hover:text-zinc-200">
                      Privacy
                    </button>
                  </li>
                  <li>
                    <button onClick={() => navigate("terms")} className="transition hover:text-zinc-200">
                      Terms
                    </button>
                  </li>
                  <li>
                    <button onClick={() => navigate("about")} className="transition hover:text-zinc-200">
                      About
                    </button>
                  </li>
                </ul>
              </div>
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
                  Get started
                </p>
                <ul className="space-y-2 text-[13px] text-zinc-500">
                  <li>
                    <button onClick={() => navigate("report")} className="transition hover:text-zinc-200">
                      Report an issue
                    </button>
                  </li>
                  <li>
                    <button onClick={() => navigate("signup")} className="transition hover:text-zinc-200">
                      Create account
                    </button>
                  </li>
                  <li>
                    <button
                      onClick={() => navigate(authed ? "dashboard" : "login")}
                      className="transition hover:text-zinc-200"
                    >
                      {authed ? t("public.go-to-dashboard") : t("public.sign-in")}
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-white/5 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11.5px] text-zinc-700">
              © 2026 SASI · Independent civic technology platform
            </p>
            <p className="font-mono text-[10px] tracking-[0.14em] text-zinc-700">
              HONEST BY DESIGN — NOTHING IS SUBMITTED WITHOUT YOUR APPROVAL
            </p>
          </div>
        </div>
      </footer>
      )}
    </div>
  );
}

/* keep next/link referenced for future deep links */
void Link;
