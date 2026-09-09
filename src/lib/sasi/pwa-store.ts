"use client";

/* ============================================================
   SASI — PWA runtime state (offline shell / install / updates)
   Kept in its own tiny store so Settings can render live status
   without touching the main app store's persistence.
   ============================================================ */

import { create } from "zustand";

export type PwaPhase =
  | "unsupported" // no serviceWorker API (very old browser)
  | "registering"
  | "ready" // worker active → offline reloads work
  | "failed";

interface PwaState {
  online: boolean;
  swReady: boolean;
  swPhase: PwaPhase;
  installable: boolean;
  installed: boolean;
  updateReady: boolean;
  /** internal: set by the runtime when beforeinstallprompt fires */
  _installEvent: unknown;
  setOnline: (v: boolean) => void;
  setSwPhase: (p: PwaPhase) => void;
  setInstallable: (evt: unknown) => void;
  clearInstallEvent: () => void;
  setInstalled: () => void;
  setUpdateReady: () => void;
  clearUpdateReady: () => void;
}

export const usePwaStore = create<PwaState>((set) => ({
  online: true,
  swPhase: "registering",
  swReady: false,
  installable: false,
  installed: false,
  updateReady: false,
  _installEvent: null,
  setOnline: (v) => set({ online: v }),
  setSwPhase: (p) => set({ swPhase: p, swReady: p === "ready" }),
  setInstallable: (evt) => set({ installable: true, _installEvent: evt }),
  clearInstallEvent: () => set({ installable: false, _installEvent: null }),
  setInstalled: () =>
    set({ installed: true, installable: false, _installEvent: null }),
  setUpdateReady: () => set({ updateReady: true }),
  clearUpdateReady: () => set({ updateReady: false }),
}));

/* Dev/QA hook — same pattern as __sasiStore. Stripped from production builds. */
if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
  (window as unknown as { __sasiPwa?: typeof usePwaStore }).__sasiPwa =
    usePwaStore;
}
