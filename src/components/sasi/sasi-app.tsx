"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster, toast } from "sonner";
import { useSasiStore } from "@/lib/sasi/store";
import { usePwaStore } from "@/lib/sasi/pwa-store";
import { initDataSaver } from "@/lib/sasi/data-saver";
import { writeContextCookie } from "@/lib/sasi/context-metadata";
import type { View } from "@/lib/sasi/types";
import { AppShell } from "./app-shell";
import { PublicShell } from "./public-shell";
import { UniversalSearch } from "./universal-search";
import { PwaRuntime, applyPwaUpdate } from "./pwa";
import { SasiGsapRuntime } from "./gsap-runtime";

import LandingView from "./views/landing";
import AboutView from "./views/about";
import HowItWorksView from "./views/how-it-works";
import ServicesView from "./views/services";
import ServiceDetailView from "./views/service-detail";
import ExploreView from "./views/explore";
import SecurityView from "./views/security";
import PrivacyView from "./views/privacy";
import TermsView from "./views/terms";
import GovView from "./views/gov";
import EmergencyView from "./views/emergency";
import GetAppView from "./views/get-app";
import VerifyView from "./views/verify";
import LoginView from "./views/login";
import SignupView from "./views/signup";
import DashboardView from "./views/dashboard";
import AskSasiView from "./views/ask-sasi";
import JourneysView from "./views/journeys";
import JourneyView from "./views/journey";
import DocumentsView from "./views/documents";
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
  "explore",
  "security",
  "privacy",
  "terms",
  "gov",
  "emergency",
  "get-app",
  "verify",
  "login",
  "signup",
]);

/* Views that are public for visitors but live INSIDE the app shell for a
   signed-in user — opening Services from the sidebar must not feel like a
   logout (no shell swap, no "Sign in" header). */
const APP_ELIGIBLE_PUBLIC = new Set<View>([
  "services",
  "service-detail",
  "explore",
]);

const VIEW_COMPONENTS: Record<View, React.ComponentType> = {
  landing: LandingView,
  about: AboutView,
  "how-it-works": HowItWorksView,
  services: ServicesView,
  "service-detail": ServiceDetailView,
  explore: ExploreView,
  security: SecurityView,
  privacy: PrivacyView,
  terms: TermsView,
  gov: GovView,
  emergency: EmergencyView,
  "get-app": GetAppView,
  verify: VerifyView,
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
  journeys: JourneysView,
  journey: JourneyView,
  documents: DocumentsView,
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
  const param = useSasiStore((s) => s.param);
  const authed = useSasiStore((s) => s.authed);
  const hydrate = useSasiStore((s) => s.hydrate);
  const updateReady = usePwaStore((s) => s.updateReady);
  const clearUpdateReady = usePwaStore((s) => s.clearUpdateReady);

  /* ---------- Contextual AI (Task 30) ----------
     The router publishes WHERE the resident is (service page, journey,
     documents…) in the short-lived sasi_ctx cookie. Ask SASI deliberately
     does NOT overwrite it: a question asked from the chat keeps the
     context of the page it came from ("What documents do I need?" while
     viewing Passport resolves to Passport). Sanitised again server-side. */
  useEffect(() => {
    if (view === "ask-sasi") return;
    writeContextCookie({ view, param: param ?? null });
  }, [view, param]);

  useEffect(() => {
    // restore persisted chat / cases / location in the background —
    // the app renders immediately, hydration lands when it lands
    hydrate().catch(() => undefined);
    // restore the Data Saver choice before anything paints
    initDataSaver();
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
        <UniversalSearch />
        <PwaRuntime />
        <SasiGsapRuntime />
      </>
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
