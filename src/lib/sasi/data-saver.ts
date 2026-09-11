"use client";

/* ============================================================
   DATA SAVER (Task 16)
   One switch in Settings that drops the expensive paint —
   blur layers, ambient animation, glow rings — so the app
   uses less mobile data, less battery and less CPU on cheap
   Android phones. Content and saved data are NEVER changed.

   Stored in localStorage so the choice survives reloads.
   The <html> element gets `sasi-data-saver` and globals.css
   does the rest (see TASK 16 — DATA SAVER layer).
   ============================================================ */

const KEY = "sasi.data-saver";
const CLASS = "sasi-data-saver";

export function readDataSaver(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false; // private mode — default to the full experience
  }
}

export function applyDataSaverClass(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    document.documentElement.classList.toggle(CLASS, on);
  } catch {
    /* no document — nothing to do */
  }
}

export function writeDataSaver(on: boolean) {
  try {
    window.localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* storage blocked — choice is session-only */
  }
  applyDataSaverClass(on);
}

/** Apply the stored choice once at boot (call from the app root). */
export function initDataSaver() {
  applyDataSaverClass(readDataSaver());
}
