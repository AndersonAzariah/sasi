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

function SplashScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505]">
      <div className="relative">
        <div
          className="sasi-ambient left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2"
          style={{
            background:
              "radial-gradient(circle, rgba(229,72,77,0.14), rgba(100,181,246,0.1) 45%, rgba(102,187,106,0.08) 65%, rgba(227,197,103,0.1) 85%, transparent)",
          }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative"
        >
          <SasiLogo size={52} withWordmark={false} className="justify-center" />
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mt-4 text-center text-[13px] font-medium tracking-[0.32em] text-zinc-400"
          >
            SASI
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-1.5 text-center text-[11px] tracking-wide text-zinc-700"
          >
            Service intelligence for South Africa
          </motion.p>
        </motion.div>
      </div>
    </div>
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
    const t = setTimeout(() => setMounted(true), 650);
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

  if (!mounted) return <SplashScreen />;

  const isPublic =
    PUBLIC_VIEWS.has(view) && !(authed && APP_ELIGIBLE_PUBLIC.has(view));

  return (
    <div className="min-h-screen bg-[#050505] text-white">
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
