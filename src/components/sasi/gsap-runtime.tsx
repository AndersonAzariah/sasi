"use client";

/*
 * SASI GSAP SCROLL LAYER
 * ----------------------
 * One client component that wires GSAP + ScrollTrigger to whatever
 * view is currently mounted, so every surface in the app gets motion
 * without each view importing animation code:
 *
 *  1. SCROLL PROGRESS — a 2px national-light hairline across the top
 *     of the viewport, scrubbed by ScrollTrigger over the whole page.
 *  2. CARD RISE-INS — `.sasi-card` elements below the fold fade/rise
 *     in with a small stagger as they enter the viewport (batched,
 *     fire-once). Cards already visible at mount are left untouched,
 *     so there is never a hide-then-flash on first paint, and cards
 *     inside hidden containers (closed tabs, collapsed panels) are
 *     marked but never animated — they can't get stuck invisible.
 *  3. AMBIENT PARALLAX — `.sasi-ambient` glows drift against scroll
 *     direction for depth on long pages (landing hero, splash-adjacent
 *     surfaces). Transform-only, so layout is never disturbed.
 *
 * Everything is guarded by prefers-reduced-motion and re-scans on view
 * change (plus a MutationObserver for late-mounted async lists), with
 * full cleanup via gsap.context().
 */

import { useEffect, useLayoutEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useSasiStore } from "@/lib/sasi/store";

gsap.registerPlugin(ScrollTrigger);

/** useLayoutEffect on the client (runs before paint → no flash),
 *  useEffect on the server (no SSR warning). */
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Elements must settle for this long after a DOM mutation before a
 *  rescan — avoids thrashing while lists stream in. */
const RESCAN_DEBOUNCE_MS = 140;

export function SasiGsapRuntime() {
  const view = useSasiStore((s) => s.view);
  const barRef = useRef<HTMLDivElement | null>(null);

  useIsoLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const bar = barRef.current;

    /** Mark + animate any not-yet-claimed `.sasi-card` in `main`.
     *  `initial` = first scan right after the view mounts. */
    const scanCards = (initial: boolean) => {
      const cards = gsap.utils.toArray<HTMLElement>(
        "main .sasi-card:not([data-sasi-rise])"
      );
      if (!cards.length) return;

      const vh = window.innerHeight;
      const belowFold: HTMLElement[] = [];

      cards.forEach((el) => {
        el.setAttribute("data-sasi-rise", "1");
        // display:none (closed tab / collapsed panel) → claim it but
        // never animate; it can simply stay at its natural state.
        if (el.offsetParent === null) return;
        if (el.getBoundingClientRect().top > vh * 0.96) belowFold.push(el);
      });

      if (!belowFold.length) {
        if (initial) ScrollTrigger.refresh();
        return;
      }

      gsap.set(belowFold, { opacity: 0, y: 22 });
      ScrollTrigger.batch(belowFold, {
        start: "top 92%",
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power3.out",
            stagger: 0.07,
            overwrite: "auto",
          }),
      });
      if (initial) ScrollTrigger.refresh();
    };

    /** teardown for the CGO v3 delegated listeners + hot tweens
     *  (assigned inside the context callback; ctx itself is still
     *  initialising there, so ctx.add() would be a TDZ crash) */
    let cgoCleanup: (() => void) | null = null;

    const ctx = gsap.context(() => {
      // 1 — reading progress across the whole document
      if (bar) {
        ScrollTrigger.create({
          start: 0,
          end: "max",
          onUpdate: (self) => {
            if (bar) bar.style.transform = `scaleX(${self.progress.toFixed(4)})`;
          },
        });
      }

      // 2 — cards already in the DOM when the view mounts
      scanCards(true);

      // 3 — ambient glows drift against scroll (depth on long pages)
      gsap.utils.toArray<HTMLElement>(".sasi-ambient").forEach((el, i) => {
        gsap.fromTo(
          el,
          { yPercent: i % 2 === 0 ? -7 : 7 },
          {
            yPercent: i % 2 === 0 ? 9 : -9,
            ease: "none",
            scrollTrigger: {
              trigger: el.parentElement ?? el,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.6,
            },
          }
        );
      });

      // 4 — editorial word reveals: [data-sasi-words] headlines split
      // into masked words that rise as they enter the viewport.
      // Plain-text nodes only; child elements are never touched.
      gsap.utils.toArray<HTMLElement>("main [data-sasi-words]").forEach((el) => {
        if (el.dataset.sasiWordsDone) return;
        const text = (el.textContent ?? "").trim();
        if (!text || el.querySelector("*")) {
          el.dataset.sasiWordsDone = "skip";
          return;
        }
        el.dataset.sasiWordsDone = "1";
        el.setAttribute("aria-label", text);
        const words = text.split(/\s+/);
        el.innerHTML = words
          .map(
            (w) =>
              `<span class="sasi-wmask" aria-hidden="true"><span class="sasi-word">${w}</span></span>`
          )
          .join(" ");
        if (el.offsetParent === null) return; // hidden container → never animate
        const targets = el.querySelectorAll(".sasi-word");
        gsap.set(targets, { yPercent: 115 });
        gsap.to(targets, {
          yPercent: 0,
          duration: 0.85,
          ease: "power3.out",
          stagger: 0.055,
          scrollTrigger: { trigger: el, start: "top 92%", once: true },
        });
      });

      // 5 — hairlines grow from the left as they enter
      gsap.utils.toArray<HTMLElement>("main .sasi-line").forEach((el) => {
        if (el.dataset.sasiLineDone) return;
        el.dataset.sasiLineDone = "1";
        if (el.offsetParent === null) return;
        gsap.set(el, { scaleX: 0 });
        gsap.to(el, {
          scaleX: 1,
          duration: 0.9,
          ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 94%", once: true },
        });
      });

      // 6 — slow editorial parallax for oversized decorative type
      gsap.utils.toArray<HTMLElement>(".sasi-parallax-slow").forEach((el) => {
        gsap.fromTo(
          el,
          { yPercent: -14 },
          {
            yPercent: 14,
            ease: "none",
            scrollTrigger: {
              trigger: el.closest("section") ?? el.parentElement ?? el,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.8,
            },
          }
        );
      });

      /* ----------------------------------------------------------
         7 — CGO v3 (Task 21): GSAP-owned circulating glow outlines.
         Every glow-ring host (search shells, cards, buttons, boot
         rings) hands its rotation to GSAP on hover/focus: the CSS
         keyframe stands down (.sasi-cgo-gsap) and GSAP writes the
         --sasi-glow-angle custom property every frame — plus a
         --sasi-glow-boost breathing tween so the ring visibly
         brightens instead of sitting at one fixed opacity.
         Hero surfaces (.sasi-search-glow-live, .sasi-boot-ring)
         run ALWAYS-ON so the national light never fully sleeps.
         Delegated listeners mean zero rescans when views change.
         ---------------------------------------------------------- */
      const CGO_HOST_SELECTOR =
        '.sasi-search-glow, .sasi-command-focus, .sasi-card, .sasi-auth-card, .sasi-btn-glass, .sasi-btn-white-glass, .sasi-btn-ring, [data-slot="button"], .sasi-boot-ring';
      const CGO_LIVE_SELECTOR = ".sasi-search-glow-live, .sasi-boot-ring";

      const dataSaverOn = () =>
        document.documentElement.classList.contains("sasi-data-saver");

      const hot = new Map<
        HTMLElement,
        { rot: gsap.core.Tween; boost: gsap.core.Tween | null }
      >();

      const startCgo = (el: HTMLElement, opts?: { live?: boolean }) => {
        if (hot.has(el) || dataSaverOn()) return;
        el.classList.add("sasi-cgo-gsap");
        /* rotation: fast and endless — noticeably livelier than the
           CSS keyframe it replaces (which ran 4.5–9s per lap) */
        const rot = gsap.fromTo(
          el,
          { "--sasi-glow-angle": "0deg" },
          {
            "--sasi-glow-angle": "360deg",
            duration: opts?.live ? 5.5 : 1.9,
            ease: "none",
            repeat: -1,
            overwrite: "auto",
          }
        );
        /* boost: a slow breathing brightening, 1 → 1.45 → 1, so the
           ring pulses like a heartbeat while the host is hot */
        const boost = opts?.live
          ? null
          : gsap.fromTo(
              el,
              { "--sasi-glow-boost": 1 },
              {
                "--sasi-glow-boost": 1.45,
                duration: 0.85,
                ease: "sine.inOut",
                yoyo: true,
                repeat: -1,
                repeatDelay: 1.1,
                delay: 0.3,
              }
            );
        hot.set(el, { rot, boost });
      };

      const stopCgo = (el: HTMLElement) => {
        const t = hot.get(el);
        if (!t) return;
        t.rot.kill();
        t.boost?.kill();
        el.style.removeProperty("--sasi-glow-angle");
        el.style.removeProperty("--sasi-glow-boost");
        el.classList.remove("sasi-cgo-gsap");
        hot.delete(el);
      };

      const hostFromEvent = (target: EventTarget | null): HTMLElement | null => {
        if (!(target instanceof Element)) return null;
        const host = target.closest(CGO_HOST_SELECTOR);
        return host instanceof HTMLElement ? host : null;
      };

      const onPointerOver = (e: PointerEvent) => {
        const host = hostFromEvent(e.target);
        if (host) startCgo(host);
      };
      const onPointerOut = (e: PointerEvent) => {
        const host = hostFromEvent(e.target);
        if (host && !host.contains(e.relatedTarget as Node)) stopCgo(host);
      };
      const onFocusIn = (e: FocusEvent) => {
        const host = hostFromEvent(e.target);
        if (host) startCgo(host);
      };
      const onFocusOut = (e: FocusEvent) => {
        const host = hostFromEvent(e.target);
        if (host && !host.contains(e.relatedTarget as Node)) stopCgo(host);
      };

      /* Hover-driven CGO only exists where hover exists — on touch-only
         devices pointerover fires on every tap and would leave "hot"
         glow rings stuck to whatever was last pressed (Task 23). */
      const canHover = window.matchMedia("(hover: hover)").matches;
      if (canHover) {
        document.addEventListener("pointerover", onPointerOver, { passive: true });
        document.addEventListener("pointerout", onPointerOut, { passive: true });
      }
      document.addEventListener("focusin", onFocusIn, true);
      document.addEventListener("focusout", onFocusOut, true);

      /* CGO listeners/tweens live outside gsap.context — the effect's
         cleanup (below) tears them down; ctx is still initialising in
         here, so ctx.add() would be a TDZ crash. */
      cgoCleanup = () => {
        document.removeEventListener("pointerover", onPointerOver);
        document.removeEventListener("pointerout", onPointerOut);
        document.removeEventListener("focusin", onFocusIn, true);
        document.removeEventListener("focusout", onFocusOut, true);
        hot.forEach((_t, el) => stopCgo(el));
      };
      /* always-on national light: hero search + boot rings rotate
         from mount, even unhovered (few elements, no layout cost) */
      gsap.utils
        .toArray<HTMLElement>(CGO_LIVE_SELECTOR)
        .forEach((el) => startCgo(el, { live: true }));
    });
    // late-mounted cards (async lists, chat history, search results)
    let timer: number | undefined;
    const mo = new MutationObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        scanCards(false);
        ScrollTrigger.refresh();
      }, RESCAN_DEBOUNCE_MS);
    });
    const main = document.querySelector("main") ?? document.body;
    mo.observe(main, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(timer);
      mo.disconnect();
      cgoCleanup?.();
      ctx.revert();
    };
  }, [view]);

  return <div ref={barRef} aria-hidden className="sasi-scroll-progress" />;
}
