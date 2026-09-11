"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster, toast } from "sonner";
import { useSasiStore } from "@/lib/sasi/store";
import { usePwaStore } from "@/lib/sasi/pwa-store";
import type { View } from "@/lib/sasi/types";
import { AppShell } from "./app-shell";
import { PublicShell } from "./public-shell";
import { CommandPalette } from "./command-palette";
import { PwaRuntime, applyPwaUpdate } from "./pwa";
import { SasiGsapRuntime } from "./gsap-runtime";
import { SasiLogo } from "./primitives";

import LandingView from "./views/landing";
import AboutView from "./views/about";
import HowItWorksView from "./views/how-it-works";
import ServicesView from "./views/services";
import ServiceDetailView from "./views/service-detail";
import SecurityView from "./views/security";
import PrivacyView from "./views/privacy";
import TermsView from "./views/terms";
import GovView from "./views/gov";
import LoginView from "./views/login";
import SignupView from "./views/signup";
import DashboardView from "./views/dashboard";
import AskSasiView from "./views/ask-sasi";
import InvestigateView from "./views/investigate";
import StartInvestigationView from "./views/start-investigation";
import ReportView from "./views/report";
import CasesView from "./views/cases";
import CaseDetailView from "./views/case-detail";
import IncidentsView from "./views/incidents";
import IncidentDetailView from "./views/incident-detail";
import MapView from "./views/map";
import EvidenceView from "./views/evidence";
import ActivityView from "./views/activity";
import NotificationsView from "./views/notifications";
import SettingsView from "./views/settings";
import ProfileView from "./views/profile";
import AdminView from "./views/admin";

const PUBLIC_VIEWS = new Set<View>([
  "landing",
  "about",
  "how-it-works",
  "services",
  "service-detail",
  "security",
  "privacy",
  "terms",
  "gov",
  "login",
  "signup",
]);

/* Views that are public for visitors but live INSIDE the app shell for a
   signed-in user — opening Services from the sidebar must not feel like a
   logout (no shell swap, no "Sign in" header). */
const APP_ELIGIBLE_PUBLIC = new Set<View>(["services", "service-detail"]);

/* ============================================================
   SPLASH — the phase-3 boot experience: dot matrix, liquid glass
   plate, the national light circulating around the mark, honest
   copy. Exits with a graceful blur-fade into the app.
   ============================================================ */
const BOOT_LETTERS = ["S", "A", "S", "I"];

function SplashScreen() {
  return (
    <motion.div
      key="sasi-boot"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden bg-[#050505]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.045, filter: "blur(6px)" }}
      transition={{ duration: 0.5, ease: [0.32, 0, 0.2, 1] }}
      role="status"
      aria-label="SASI is starting"
    >
      {/* dot matrix — melts toward the edges */}
      <div aria-hidden className="sasi-dot-veil absolute inset-0" />

      {/* breathing national ambience */}
      <div
        aria-hidden
        className="sasi-ambient -left-32 -top-32 h-[420px] w-[420px]"
        style={{ background: "radial-gradient(closest-side, rgba(229,57,53,0.13), transparent)" }}
      />
      <div
        aria-hidden
        className="sasi-ambient -bottom-40 -right-24 h-[460px] w-[460px]"
        style={{ background: "radial-gradient(closest-side, rgba(66,165,245,0.11), transparent)" }}
      />
      <div
        aria-hidden
        className="sasi-ambient left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2"
        style={{ background: "radial-gradient(closest-side, rgba(212,175,55,0.1), transparent)" }}
      />

      <motion.div
        className="relative flex flex-col items-center"
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
      >
        {/* ------- liquid glass boot plate ------- */}
        <div className="sasi-boot-plate flex flex-col items-center px-12 py-10 sm:px-16">
          {/* mark in a circulating national-light orbit */}
          <div className="relative flex h-[92px] w-[92px] items-center justify-center">
            <div aria-hidden className="sasi-boot-orbit -inset-3.5" />
            <div aria-hidden className="sasi-boot-ring -inset-3.5" />
            <div
              aria-hidden
              className="sasi-ambient left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2"
              style={{ background: "radial-gradient(closest-side, rgba(212,175,55,0.16), transparent)" }}
            />
            <div className="sasi-principle-tile !h-16 !w-16 !rounded-[18px]">
              <SasiLogo size={40} withWordmark={false} />
            </div>
          </div>

          {/* wordmark — letters rise in */}
          <div className="mt-6 flex items-center" aria-hidden>
            {BOOT_LETTERS.map((letter, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 + i * 0.08, duration: 0.4, ease: "easeOut" }}
                className="text-[16px] font-semibold tracking-[0.42em] text-white"
              >
                {letter}
              </motion.span>
            ))}
          </div>

          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
            className="sasi-line mt-5 w-40"
            aria-hidden
          />

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.62 }}
            className="sasi-eyebrow mt-5 text-zinc-500"
          >
            Service intelligence
          </motion.p>
        </div>

        {/* ------- national-light boot progress ------- */}
        <motion.div
          className="mt-9 flex w-56 flex-col items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55 }}
        >
          <div className="sasi-boot-bar w-full" aria-hidden />
          <p className="text-center text-[11px] leading-relaxed tracking-wide text-zinc-600">
            Preparing your workspace — everything stays on this device.
          </p>
        </motion.div>
      </motion.div>

      {/* honesty line pinned to the boot floor */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="absolute bottom-6 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.24em] text-zinc-700"
      >
        <span
          aria-hidden
          className="h-1 w-1 rounded-full"
          style={{ background: "linear-gradient(90deg, #ef5350, #64b5f6, #66bb6a, #e3c567)" }}
        />
        Not a government website
      </motion.p>
    </motion.div>
  );
}

const VIEW_COMPONENTS: Record<View, React.ComponentType> = {
  landing: LandingView,
  about: AboutView,
  "how-it-works": HowItWorksView,
  services: ServicesView,
  "service-detail": ServiceDetailView,
  security: SecurityView,
  privacy: PrivacyView,
  terms: TermsView,
  gov: GovView,
  login: LoginView,
  signup: SignupView,
  dashboard: DashboardView,
  "ask-sasi": AskSasiView,
  investigate: InvestigateView,
  "start-investigation": StartInvestigationView,
  report: ReportView,
  cases: CasesView,
  "case-detail": CaseDetailView,
  incidents: IncidentsView,
  "incident-detail": IncidentDetailView,
  map: MapView,
  evidence: EvidenceView,
  activity: ActivityView,
  notifications: NotificationsView,
  settings: SettingsView,
  profile: ProfileView,
  admin: AdminView,
};

function ViewRenderer() {
  const view = useSasiStore((s) => s.view);
  const Active = VIEW_COMPONENTS[view] ?? LandingView;
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
      >
        <Active />
      </motion.div>
    </AnimatePresence>
  );
}

export function SasiApp() {
  const view = useSasiStore((s) => s.view);
  const authed = useSasiStore((s) => s.authed);
  const hydrate = useSasiStore((s) => s.hydrate);
  const updateReady = usePwaStore((s) => s.updateReady);
  const clearUpdateReady = usePwaStore((s) => s.clearUpdateReady);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // pull persisted chat / cases / location while the splash is up
    void hydrate();
    const t = setTimeout(() => setMounted(true), 950);
    return () => clearTimeout(t);
  }, [hydrate]);

  /* a new service worker finished installing in the background → offer the swap */
  useEffect(() => {
    if (!updateReady) return;
    toast("A new version of SASI is ready", {
      description: "Reload to pick it up. Your data stays.",
      duration: Infinity,
      id: "sasi-pwa-update",
      action: {
        label: "Reload",
        onClick: () => {
          clearUpdateReady();
          void applyPwaUpdate(); // skipWaiting → controllerchange → clean reload
          setTimeout(() => window.location.reload(), 400);
        },
      },
    });
  }, [updateReady, clearUpdateReady]);

  const isPublic =
    PUBLIC_VIEWS.has(view) && !(authed && APP_ELIGIBLE_PUBLIC.has(view));

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* the app mounts beneath the splash so the boot exit reveals it */}
      {!mounted ? null : (
        <>
          {isPublic ? (
            <PublicShell>
              <ViewRenderer />
            </PublicShell>
          ) : (
            <AppShell>
              <ViewRenderer />
            </AppShell>
          )}
          <CommandPalette />
          <PwaRuntime />
          <SasiGsapRuntime />
        </>
      )}
      <AnimatePresence>{!mounted && <SplashScreen />}</AnimatePresence>
      <Toaster
        position="bottom-right"
        theme="dark"
        gap={8}
        toastOptions={{
          classNames: {
            toast:
              "!bg-zinc-950 !border !border-white/10 !text-zinc-100 !shadow-[0_12px_40px_-12px_rgba(0,0,0,0.9)] !rounded-xl",
            title: "!text-[13px] !font-semibold",
            description: "!text-zinc-400 !text-[12px]",
            actionButton: "!bg-[#E5484D] !text-white",
          },
        }}
      />
    </div>
  );
}
