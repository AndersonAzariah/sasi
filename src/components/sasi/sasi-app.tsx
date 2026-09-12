"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster, toast } from "sonner";
import { useSasiStore } from "@/lib/sasi/store";
import { usePwaStore } from "@/lib/sasi/pwa-store";
import { initDataSaver } from "@/lib/sasi/data-saver";
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
import EmergencyView from "./views/emergency";
import GetAppView from "./views/get-app";
import VerifyView from "./views/verify";
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
  "emergency",
  "get-app",
  "verify",
  "login",
  "signup",
]);

/* Views that are public for visitors but live INSIDE the app shell for a
   signed-in user — opening Services from the sidebar must not feel like a
   logout (no shell swap, no "Sign in" header). */
const APP_ELIGIBLE_PUBLIC = new Set<View>(["services", "service-detail"]);

/* ============================================================
   SPLASH — the boot experience: the mark, big, centered, with
   the national light circulating around it. Below it the
   wordmark assembles itself, then four national lights ignite
   one by one while REAL boot phases complete (session restore,
   sync, map calibration — wired to hydrate(), not a timer
   lie). No loading bars: progress is four dots and one honest
   line. Lasts ~5 seconds; a tap or any key skips it honestly.
   ============================================================ */

const BOOT_MS = 5200;

const BOOT_PHASES = [
  "Restoring your session",
  "Syncing reports & evidence",
  "Calibrating the service map",
  "Ready",
] as const;

const BOOT_DOT_COLORS = ["#ef5350", "#64b5f6", "#66bb6a", "#e3c567"];
const BOOT_PHASE_MS = 850;

function SplashScreen({ onSkip, ready }: { onSkip: () => void; ready: boolean }) {
  const [phase, setPhase] = useState(0);

  /* phases advance on a rhythm, but never claim a stage the app
     hasn't reached — the last one waits for real hydration */
  useEffect(() => {
    const id = window.setInterval(() => {
      setPhase((p) => {
        const cap = ready ? BOOT_PHASES.length - 1 : BOOT_PHASES.length - 2;
        return p < cap ? p + 1 : p;
      });
    }, BOOT_PHASE_MS);
    return () => window.clearInterval(id);
  }, [ready]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  return (
    <motion.div
      key="sasi-boot"
      className="fixed inset-0 z-[80] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-[#050505]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.06, filter: "blur(8px)" }}
      transition={{ duration: 0.55, ease: [0.32, 0, 0.2, 1] }}
      onClick={onSkip}
      role="status"
      aria-label="SASI is starting — tap anywhere to skip"
    >
      {/* dot matrix — melts toward the edges */}
      <div aria-hidden className="sasi-dot-veil absolute inset-0" />

      {/* breathing national ambience */}
      <div
        aria-hidden
        className="sasi-ambient -left-40 -top-40 h-[520px] w-[520px]"
        style={{ background: "radial-gradient(closest-side, rgba(229,57,53,0.14), transparent)" }}
      />
      <div
        aria-hidden
        className="sasi-ambient -bottom-48 -right-32 h-[560px] w-[560px]"
        style={{ background: "radial-gradient(closest-side, rgba(66,165,245,0.12), transparent)" }}
      />
      <div
        aria-hidden
        className="sasi-ambient left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2"
        style={{ background: "radial-gradient(closest-side, rgba(212,175,55,0.12), transparent)" }}
      />

      {/* ------- the mark, scaled big, circulating national light ------- */}
      <motion.div
        className="relative flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.86 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
      >
        <div aria-hidden className="sasi-boot-orbit -inset-7" />
        <div aria-hidden className="sasi-boot-ring -inset-7" />
        <div
          aria-hidden
          className="sasi-ambient left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2"
          style={{ background: "radial-gradient(closest-side, rgba(212,175,55,0.2), transparent)" }}
        />
        <div
          className="sasi-principle-tile !h-[132px] !w-[132px] !rounded-[34px] sm:!h-[152px] sm:!w-[152px]"
          aria-hidden
        >
          <SasiLogo size={96} withWordmark={false} />
        </div>
      </motion.div>

      {/* ------- the wordmark assembles itself under the mark ------- */}
      <motion.div
        className="mt-7 flex flex-col items-center"
        initial="hidden"
        animate="show"
        aria-hidden
      >
        <div className="flex overflow-hidden">
          {("SASI" as const).split("").map((ch, i) => (
            <motion.span
              key={i}
              variants={{
                hidden: { y: 16, opacity: 0, filter: "blur(6px)" },
                show: { y: 0, opacity: 1, filter: "blur(0px)" },
              }}
              transition={{ delay: 0.3 + i * 0.09, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
              className="sasi-serif pr-[0.42em] text-[26px] leading-none tracking-[0.1em] text-white last:pr-0"
            >
              {ch}
            </motion.span>
          ))}
        </div>
        {/* national rule sweeping out under the wordmark */}
        <motion.span
          className="mt-3 h-px w-24 origin-center rounded-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, #ef5350 18%, #64b5f6 42%, #66bb6a 62%, #e3c567 82%, transparent)",
          }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ delay: 0.75, duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
        />
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="mt-3 font-mono text-[9px] font-medium uppercase tracking-[0.34em] text-zinc-600"
        >
          South African Service Intelligence
        </motion.p>
      </motion.div>

      {/* ------- national-light boot phases: four dots, one honest
              line — the old sweeping bar is gone ------- */}
      <motion.div
        className="mt-12 flex w-56 flex-col items-center gap-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center gap-2.5" aria-hidden>
          {BOOT_DOT_COLORS.map((c, i) => (
            <span
              key={c}
              className="sasi-boot-dot"
              data-lit={i <= phase}
              style={
                i <= phase
                  ? { background: c, boxShadow: `0 0 9px ${c}59` }
                  : undefined
              }
            />
          ))}
        </div>
        <div className="h-4" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.p
              key={phase}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.26, ease: "easeOut" }}
              className="text-center font-mono text-[10.5px] tracking-[0.18em] text-zinc-500"
            >
              {BOOT_PHASES[phase].toUpperCase()}
            </motion.p>
          </AnimatePresence>
        </div>
        <p className="text-center text-[11px] tracking-wide text-zinc-600">
          Tap anywhere to skip{" "}
          <kbd className="rounded border border-white/10 bg-white/5 px-1 py-px font-mono text-[9px] text-zinc-500">
            ESC
          </kbd>
        </p>
      </motion.div>

      {/* honesty line pinned to the boot floor */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
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
  const [bootReady, setBootReady] = useState(false);

  useEffect(() => {
    // pull persisted chat / cases / location while the splash is up —
    // the splash's last boot phase waits for this for real
    hydrate()
      .catch(() => undefined)
      .finally(() => setBootReady(true));
    // restore the Data Saver choice before anything paints
    initDataSaver();
    const t = setTimeout(() => setMounted(true), BOOT_MS);
    return () => clearTimeout(t);
  }, [hydrate]);

  const skipBoot = useCallback(() => setMounted(true), []);

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
      <AnimatePresence>{!mounted && <SplashScreen onSkip={skipBoot} ready={bootReady} />}</AnimatePresence>
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
