"use client";

/* ============================================================
   SASI — native-feel mobile capabilities, used honestly.
   ------------------------------------------------------------
   - haptic(): navigator.vibrate wrapper. Works on Android/Chrome
     (the primary Android target); silently no-ops on iOS Safari
     (no vibrate API) and desktop — never throws.
   - shareOrCopy(): Web Share API → native Android share sheet.
     Falls back to clipboard copy where share is unavailable
     (desktop, iOS in some contexts). Never throws.
   - isAndroidLike(): cheap UA/pointer sniff used ONLY to pick
     which honest install instructions to show. No behaviour is
     gated on it beyond guidance copy.
   ============================================================ */

/** Vibration patterns (milliseconds). Short = confirmation tick. */
export const HAPTIC = {
  /** light tick — navigation, toggles */
  tap: 8,
  /** double-tick — success states (report filed, install accepted) */
  success: [12, 40, 18] as number[],
  /** long buzz — warnings (offline submit blocked) */
  warning: [24, 60, 24] as number[],
} as const;

export function haptic(pattern: number | number[] = HAPTIC.tap): void {
  if (typeof navigator === "undefined") return;
  const nv = navigator as Navigator & {
    vibrate?: (p: number | number[]) => boolean;
  };
  try {
    nv.vibrate?.(pattern);
  } catch {
    /* vibrate never blocks UX */
  }
}

export interface SharePayload {
  title: string;
  text: string;
  /** defaults to the current page URL */
  url?: string;
}

export type ShareOutcome =
  | "shared" // native sheet completed (or user dismissed it — their call)
  | "copied" // fell back to clipboard
  | "failed"; // both paths unavailable — caller toasts an honest error

/** Web Share API with a clipboard fallback. User-cancelling counts as "shared" (nothing to report). */
export async function shareOrCopy(payload: SharePayload): Promise<ShareOutcome> {
  if (typeof navigator === "undefined") return "failed";
  const url = payload.url ?? window.location.href;
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };

  if (typeof nav.share === "function") {
    try {
      await nav.share({ title: payload.title, text: payload.text, url });
      return "shared";
    } catch (err) {
      // user closed the sheet — treat as done, not an error
      if (err instanceof DOMException && err.name === "AbortError") return "shared";
      // share existed but refused (e.g. unsupported payload) → try clipboard
    }
  }

  try {
    await navigator.clipboard.writeText(
      `${payload.title}\n${payload.text}\n${url}`.trim()
    );
    return "copied";
  } catch {
    return "failed";
  }
}

/** Android detection — only used to choose honest install guidance copy. */
export function isAndroidLike(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}

/** Small-screen / touch-first device — used to gate the quiet install banner. */
export function isTouchFirst(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}
