"use client";

/* ============================================================
   PwaRuntime — mounts once inside SasiApp and wires the browser
   plumbing that the offline shell needs:
   1. Registers /sw.js (dev → ?mode=dev so HMR stays fresh).
   2. Mirrors online/offline into the PWA store (offline chip).
   3. Captures beforeinstallprompt (Settings → App can offer install).
   4. Detects a waiting worker → "Update ready" state → toast.

   Renders nothing by itself (the offline chip lives here too).
   ============================================================ */

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WifiOff } from "lucide-react";
import { usePwaStore } from "@/lib/sasi/pwa-store";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/* module-level handle so Settings can call prompt() later */
let deferredInstall: BeforeInstallPromptEvent | null = null;

export async function promptPwaInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredInstall) return "unavailable";
  const evt = deferredInstall;
  deferredInstall = null;
  await evt.prompt();
  const choice = await evt.userChoice;
  usePwaStore.getState().clearInstallEvent();
  if (choice.outcome === "accepted") usePwaStore.getState().setInstalled();
  return choice.outcome;
}

export async function applyPwaUpdate() {
  const reg = await navigator.serviceWorker.getRegistration();
  reg?.waiting?.postMessage("SKIP_WAITING");
}

export function PwaRuntime() {
  const setOnline = usePwaStore((s) => s.setOnline);
  const setSwPhase = usePwaStore((s) => s.setSwPhase);
  const setInstallable = usePwaStore((s) => s.setInstallable);
  const setInstalled = usePwaStore((s) => s.setInstalled);
  const setUpdateReady = usePwaStore((s) => s.setUpdateReady);
  const online = usePwaStore((s) => s.online);

  useEffect(() => {
    /* ---------- 1. online / offline mirror ---------- */
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);

    /* ---------- 2. service worker registration ---------- */
    const sw = navigator.serviceWorker;
    if (!sw) {
      setSwPhase("unsupported");
    } else {
      const isDev = process.env.NODE_ENV !== "production";
      /* A PRODUCTION worker registered earlier (e.g. the browser profile
         previously visited a built deployment on this origin) keeps its
         app-shell caches and serves STALE assets over a dev server —
         deep links and HMR silently break. In dev, replace it. */
      const replaceStaleProdWorker = async () => {
        if (!isDev) return;
        const existing = await sw.getRegistration();
        if (existing && !existing.active?.scriptURL.includes("mode=dev")) {
          await existing.unregister();
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.filter((k) => k.startsWith("sasi-")).map((k) => caches.delete(k)));
          }
        }
      };
      replaceStaleProdWorker()
        .catch(() => undefined)
        .then(() =>
          sw
            .register(isDev ? "/sw.js?mode=dev" : "/sw.js")
            .then((reg) => {
              /* a worker already controlling this page → offline is live */
              if (sw.controller || reg.active) setSwPhase("ready");
              reg.addEventListener("updatefound", () => {
                const next = reg.installing;
                next?.addEventListener("statechange", () => {
                  /* installed & waiting while a page is controlled = update ready */
                  if (next.state === "installed" && sw.controller) {
                    usePwaStore.getState().setUpdateReady();
                  }
                });
              });
            })
            .catch(() => setSwPhase("failed"))
        );
    }

    /* ---------- 3. install prompt capture ---------- */
    const onInstallPrompt = (e: Event) => {
      e.preventDefault(); // keep SASI's own install affordance, not the mini-infobar
      deferredInstall = e as BeforeInstallPromptEvent;
      setInstallable(e);
    };
    window.addEventListener("beforeinstallprompt", onInstallPrompt);

    const onInstalled = () => setInstalled();
    window.addEventListener("appinstalled", onInstalled);

    /* running standalone already? (installed PWA launch) */
    if (window.matchMedia("(display-mode: standalone)").matches) setInstalled();

    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [setInstallable, setInstalled, setOnline, setSwPhase, setUpdateReady]);

  /* ---------- 4. quiet offline chip (bottom-left, above toaster z) ---------- */
  return (
    <AnimatePresence>
      {!online && (
        <motion.div
          key="sasi-offline-chip"
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          className="sasi-offline-chip"
          role="status"
          aria-live="polite"
        >
          <WifiOff className="h-3.5 w-3.5 shrink-0 text-[#ffa726]" aria-hidden />
          <span className="font-medium">Offline</span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-400">browsing your cached data — nothing is being sent</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
