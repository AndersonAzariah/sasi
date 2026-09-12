"use client";

/* ============================================================
   GetAppView — "Get the SASI app" (public, shareable).

   The honest download page for the installable PWA:
   - Android / desktop Chrome-Edge: a REAL one-tap install via the
     captured beforeinstallprompt (no fake buttons — if the browser
     has not offered the prompt, we say so and give the menu path).
   - iOS Safari: Apple allows no scripted install prompt, so the
     page shows the exact two-step Share → Add to Home Screen path.
   - Firefox / other desktop browsers: the manual menu path.
   - Already installed: a clear "you are running the app" state with
     a straight route to the dashboard.

   Data honesty: SASI is NOT distributed through app stores. It is
   installed straight from this page by the browser itself — the
   page never pretends a store listing exists.
   ============================================================ */

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Download,
  Gauge,
  Globe,
  MonitorSmartphone,
  Share,
  Smartphone,
  SquarePlus,
  WifiOff,
} from "lucide-react";
import { useSasiStore } from "@/lib/sasi/store";
import { usePwaStore, type PwaPhase } from "@/lib/sasi/pwa-store";
import { promptPwaInstall } from "@/components/sasi/pwa";
import { SasiLogo, TrustNotice } from "@/components/sasi/primitives";
import { toast } from "sonner";

type Platform = "ios" | "android" | "desktop-chromium" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIos) return "ios";
  if (/Android/i.test(ua)) return "android";
  /* desktop Chromium family (Chrome / Edge / Brave / Opera / Samsung Internet
     on desktop) — the only desktop family that fires beforeinstallprompt */
  if (/Chrome|Chromium|Edg\//.test(ua) && !/Firefox|Safari\/[\d.]+$/.test(ua.replace(/Chrome\/[\d.]+ /, "")))
    return "desktop-chromium";
  return "other";
}

const SW_LABEL: Record<PwaPhase, string> = {
  unsupported: "This browser can't keep an offline copy of SASI",
  registering: "Preparing the offline copy…",
  ready: "Offline copy saved on this device",
  failed: "The offline copy could not be saved here",
};

export default function GetAppView() {
  const navigate = useSasiStore((s) => s.navigate);
  const authed = useSasiStore((s) => s.authed);

  const installable = usePwaStore((s) => s.installable);
  const installed = usePwaStore((s) => s.installed);
  const swPhase = usePwaStore((s) => s.swPhase);
  const online = usePwaStore((s) => s.online);

  const [platform] = useState<Platform>(detectPlatform);
  const [installing, setInstalling] = useState(false);

  /* appinstalled → the runtime flips the store; reflect it with a toast */
  const [wasInstalled] = useState(() => installed);
  useEffect(() => {
    if (!wasInstalled && installed) {
      toast.success("SASI installed", {
        description: "Launch it from your home screen — it opens as its own app.",
      });
    }
  }, [installed, wasInstalled]);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const outcome = await promptPwaInstall();
      if (outcome === "unavailable") {
        toast("Install is not available right now", {
          description:
            "Your browser has not offered an install prompt yet. Use the browser menu → “Install app” / “Add to Home screen”.",
        });
      }
      /* accepted / dismissed are surfaced by the store + toast above */
    } finally {
      setInstalling(false);
    }
  };

  const goHome = () => {
    if (authed) navigate("dashboard");
    else navigate("login");
  };

  /* ---------- per-platform primary block ---------- */

  const primaryBlock = (() => {
    if (installed) {
      return (
        <div className="sasi-card border-[#66bb6a]/20 p-6">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-white">
            <BadgeCheck className="h-4.5 w-4.5 text-[#66bb6a]" aria-hidden />
            SASI is installed on this device
          </p>
          <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-zinc-400">
            You are running SASI as its own app. It opens straight to your dashboard —
            and keeps an offline copy of your last session for when the network drops.
          </p>
          <button
            onClick={goHome}
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 text-[13.5px] font-semibold text-black transition hover:bg-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
          >
            {authed ? "Open my dashboard" : "Sign in to SASI"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      );
    }

    if (platform === "ios") {
      return (
        <div className="sasi-card p-6">
          <p className="flex items-center gap-2 text-[14px] font-semibold text-white">
            <Smartphone className="h-4.5 w-4.5 text-[#e3c567]" aria-hidden />
            Install on iPhone or iPad
          </p>
          <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-zinc-400">
            Apple does not let any website show a one-tap install on iOS — so this is
            the real, exact path. It takes about ten seconds:
          </p>
          <ol className="mt-4 space-y-2.5">
            {[
              <>
                Open this page in <strong className="font-medium text-white">Safari</strong> and
                tap the <Share className="inline h-3.5 w-3.5 -translate-y-px text-[#e3c567]" aria-label="Share icon" />{" "}
                <strong className="font-medium text-white">Share</strong> icon (the square with the arrow).
              </>,
              <>
                Scroll and choose{" "}
                <strong className="font-medium text-white">Add to Home Screen</strong>.
              </>,
              <>
                Tap <strong className="font-medium text-white">Add</strong> — SASI now opens
                full-screen from your home screen, like any other app.
              </>,
            ].map((step, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-[13px] leading-relaxed text-zinc-300"
              >
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#e3c567]/25 bg-[#e3c567]/[0.08] text-[11px] font-semibold text-[#e3c567]"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <button
            onClick={goHome}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-[12.5px] font-medium text-zinc-200 transition hover:border-white/25 hover:text-white"
          >
            {authed ? "Continue to my dashboard" : "Sign in or create an account"}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      );
    }

    /* android + desktop-chromium get the REAL prompt; "other" gets the menu path */
    const canPrompt = installable && (platform === "android" || platform === "desktop-chromium");
    return (
      <div className="sasi-card p-6">
        <p className="flex items-center gap-2 text-[14px] font-semibold text-white">
          <Download className="h-4.5 w-4.5 text-[#e3c567]" aria-hidden />
          {platform === "android"
            ? "Install on this Android device"
            : platform === "desktop-chromium"
              ? "Install on this computer"
              : "Install SASI"}
        </p>
        {canPrompt ? (
          <>
            <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-zinc-400">
              One tap — your browser will confirm the install. SASI then opens as its
              own app, straight to your dashboard.
            </p>
            <button
              onClick={handleInstall}
              disabled={installing}
              className="mt-4 inline-flex h-12 items-center gap-2 rounded-lg bg-white px-6 text-[14px] font-semibold text-black transition hover:bg-zinc-200 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
            >
              <Download className="h-4 w-4" aria-hidden />
              {installing ? "Waiting for your browser…" : "Install SASI"}
            </button>
          </>
        ) : (
          <>
            <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-zinc-400">
              SASI is not in any app store — it installs straight from the browser.
              {platform === "other"
                ? " Your browser did not offer a one-tap install prompt, so use the menu path:"
                : " The one-tap prompt has not appeared yet, so use the menu path:"}
            </p>
            <ol className="mt-3 space-y-2 text-[13px] text-zinc-300">
              <li className="flex items-start gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[#e3c567]/25 bg-[#e3c567]/[0.08] text-[11px] font-semibold text-[#e3c567]" aria-hidden>1</span>
                Open the browser menu ( <strong className="font-medium text-white">⋮</strong> or <strong className="font-medium text-white">⋯</strong> ).
              </li>
              <li className="flex items-start gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[#e3c567]/25 bg-[#e3c567]/[0.08] text-[11px] font-semibold text-[#e3c567]" aria-hidden>2</span>
                Choose <strong className="font-medium text-white">Install app</strong> /{" "}
                <strong className="font-medium text-white">Add to Home screen</strong>.
              </li>
            </ol>
          </>
        )}
      </div>
    );
  })();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      {/* ---------- header ---------- */}
      <header className="flex flex-col items-start gap-4">
        <span className="inline-flex items-center gap-2 rounded-md border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
          <MonitorSmartphone className="h-3 w-3 text-[#e3c567]" aria-hidden />
          Install SASI
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Put SASI on your home screen.
        </h1>
        <p className="max-w-xl text-[14px] leading-relaxed text-zinc-400">
          SASI installs as its own app — full screen, no browser bars, one tap from
          your home screen or desktop. Your cases, briefings and the map stay
          readable even when the network drops. Nothing is ever submitted while you
          are offline.
        </p>
      </header>

      {/* ---------- primary install block ---------- */}
      <div className="mt-6">{primaryBlock}</div>

      {/* ---------- what you get (honest, no marketing fluff) ---------- */}
      <section aria-label="What the installed app gives you" className="mt-8">
        <h2 className="text-[15px] font-semibold text-white">What the app gives you</h2>
        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {[
            {
              icon: Gauge,
              title: "Opens straight to your dashboard",
              body: "No marketing page in between — sign in once, then it is your cases, briefings and map immediately.",
            },
            {
              icon: WifiOff,
              title: "Works when the network drops",
              body: SW_LABEL[swPhase] + " — read your last session with no connection.",
            },
            {
              icon: Bell,
              title: "Real notifications about your own activity",
              body: "Reports received, investigations complete, briefings written — never government alerts.",
            },
            {
              icon: Globe,
              title: "No app store, no waiting",
              body: "Installed by your browser straight from this page — updates arrive the same way.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
              <p className="flex items-center gap-2 text-[13px] font-medium text-white">
                <Icon className="h-4 w-4 shrink-0 text-[#e3c567]" aria-hidden />
                {title}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- privacy / trust ---------- */}
      <div className="mt-8">
        <TrustNotice>
          SASI is an independent civic tool — not a government service and not
          distributed through app stores. Installing only places a copy of the app
          on your device; it never shares your data with any authority. Offline,
          nothing leaves your device at all.
        </TrustNotice>
      </div>

      {/* ---------- sign-in bridge: the installed flow ---------- */}
      {!installed && (
        <section aria-label="After you install" className="mt-8 rounded-xl border border-white/5 p-5">
          <h2 className="text-[15px] font-semibold text-white">After you install</h2>
          <ol className="mt-3 space-y-2.5 text-[13px] leading-relaxed text-zinc-400">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[11px] font-semibold text-zinc-300" aria-hidden>1</span>
              <span>
                Open SASI from your home screen — if you already have an account you
                land straight on <strong className="font-medium text-zinc-200">your dashboard</strong>.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-[11px] font-semibold text-zinc-300" aria-hidden>2</span>
              <span>
                If you are new, the app asks you to{" "}
                <strong className="font-medium text-zinc-200">sign in or create an account</strong>{" "}
                first — then takes you straight to the dashboard. One sign-in, and the
                app remembers you.
              </span>
            </li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => navigate("login")}
              className="inline-flex h-10 items-center rounded-lg border border-white/10 bg-white/[0.03] px-4 text-[12.5px] font-medium text-zinc-200 transition hover:border-white/25 hover:text-white"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate("signup")}
              className="inline-flex h-10 items-center rounded-lg border border-white/10 bg-white/[0.03] px-4 text-[12.5px] font-medium text-zinc-200 transition hover:border-white/25 hover:text-white"
            >
              Create an account
            </button>
          </div>
        </section>
      )}

      {/* ---------- tiny brand footer ---------- */}
      <footer className="mt-10 flex items-center gap-2 text-[11.5px] text-zinc-600">
        <SasiLogo size={14} withWordmark={false} />
        SASI — South African Service Intelligence · not a government website
      </footer>
    </div>
  );
}
