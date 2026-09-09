"use client";

/* ============================================================
   SASI — i18n scaffolding
   South Africa has 12 official languages; this scaffold makes
   interface translation REAL for the app shell, landing page and
   shared controls in three of them (English, isiZulu, Afrikaans),
   with the remaining languages stubbed honestly in Settings.

   Design:
   - Keys are flat strings; `en` is always present (fallback).
   - `useT()` binds the active language from the Zustand store and
     returns t(key) — components never read localStorage directly.
   - Missing zu/af values fall back to English rather than breaking.
   Coverage today: app shell (sidebar, topbar, mobile nav), landing
   hero + primary CTAs, public header CTAs, notification panel chrome.
   Views keep English (noted honestly in Settings).
   ============================================================ */

import { useSasiStore } from "./store";
import type { Lang } from "./types";

export type { Lang } from "./types";

export const LANGUAGES: {
  code: Lang;
  /** native name */
  label: string;
  /** english name for a11y labels */
  english: string;
  /** honest coverage note shown in Settings */
  note: string;
}[] = [
  { code: "en", label: "English", english: "English", note: "Full interface." },
  {
    code: "zu",
    label: "isiZulu",
    english: "Zulu",
    note: "Shell, landing and shared controls.",
  },
  {
    code: "af",
    label: "Afrikaans",
    english: "Afrikaans",
    note: "Shell, landing and shared controls.",
  },
];

/** Codes offered in Settings but not yet translated (stub kept honest). */
export const PLANNED_LANGUAGES: { code: string; label: string }[] = [
  { code: "xh", label: "isiXhosa" },
  { code: "st", label: "Sesotho" },
  { code: "tn", label: "Setswana" },
  { code: "nso", label: "Sepedi" },
];

type Dict = Record<string, Partial<Record<Lang, string>> & { en: string }>;

const DICT: Dict = {
  /* ---------- shell: sidebar sections ---------- */
  "nav.overview": { en: "Overview", zu: "Uhlolojikelele", af: "Oorsig" },
  "nav.investigate": { en: "Investigate", zu: "Uphenyo", af: "Ondersoek" },
  "nav.evidence": { en: "Evidence", zu: "Ubufakazi", af: "Bewys" },
  "nav.system": { en: "System", zu: "Isistimu", af: "Stelsel" },
  "nav.services": { en: "Services", zu: "Izinsizakalo", af: "Dienste" },

  /* ---------- shell: nav items ---------- */
  "nav.dashboard": { en: "Dashboard", zu: "Idashibodi", af: "Dashbord" },
  "nav.ask-sasi": { en: "Ask SASI", zu: "Buza i-SASI", af: "Vra SASI" },
  "nav.investigate.item": {
    en: "Investigate",
    zu: "Phenya",
    af: "Ondersoek",
  },
  "nav.cases": { en: "Cases", zu: "Amacala", af: "Sake" },
  "nav.incidents": { en: "Incidents", zu: "Izigameko", af: "Voorvalle" },
  "nav.map": { en: "Map", zu: "Imephu", af: "Kaart" },
  "nav.evidence.item": { en: "Evidence", zu: "Ubufakazi", af: "Bewys" },
  "nav.activity": { en: "Activity", zu: "Umsebenzi", af: "Aktiwiteit" },
  "nav.notifications": {
    en: "Notifications",
    zu: "Izaziso",
    af: "Kennisgewings",
  },
  "nav.settings": { en: "Settings", zu: "Izilungiselelo", af: "Instellings" },
  "nav.admin": { en: "Admin foundation", zu: "Isisekelo se-Admin", af: "Admin-fundament" },

  /* ---------- shell: mobile nav ---------- */
  "nav.home": { en: "Home", zu: "Ikhaya", af: "Tuis" },
  "nav.profile": { en: "Profile", zu: "Iphrofayili", af: "Profiel" },

  /* ---------- shell: topbar ---------- */
  "shell.search": {
    en: "Search services, cases, incidents or ask SASI…",
    zu: "Sesha izinsizakalo, amacala, izigameko noma buza i-SASI…",
    af: "Deursoek dienste, sake, voorvalle of vra SASI…",
  },
  "shell.saved-location": {
    en: "Saved location",
    zu: "Indawo egciniwe",
    af: "Bergplek",
  },
  "shell.notifications": {
    en: "Notifications",
    zu: "Izaziso",
    af: "Kennisgewings",
  },
  "shell.mark-all-read": {
    en: "Mark all read",
    zu: "Maka konke kufundwe",
    af: "Merk alles as gelees",
  },
  "shell.view-all-notifications": {
    en: "View all notifications",
    zu: "Bona zonke izaziso",
    af: "Sien alle kennisgewings",
  },
  "shell.floating-ask": {
    en: "Ask SASI",
    zu: "Buza i-SASI",
    af: "Vra SASI",
  },

  /* ---------- public header ---------- */
  "public.sign-in": { en: "Sign in", zu: "Ngena", af: "Meld aan" },
  "public.go-to-dashboard": {
    en: "Go to dashboard",
    zu: "Yendisa kudashibodi",
    af: "Gaan na die dashbord",
  },

  /* ---------- landing ---------- */
  "landing.hero.a": { en: "Civic intelligence for", zu: "Ukwazi komphakathi", af: "Burgerlike intelligensie vir" },
  "landing.hero.b": { en: "South Africa", zu: "eNingizimu Afrika", af: "Suid-Afrika" },
  "landing.hero.sub": {
    en: "Understand what is happening. Build the evidence. Take the next step.",
    zu: "Qonda okwenzakalayo. Yaka ubufakazi. Thatha isinyathelo esilandelayo.",
    af: "Verstaan wat gebeur. Bou die bewys. Neem die volgende stap.",
  },
  "landing.cta.report": {
    en: "Tell SASI what is happening",
    zu: "Tshela i-SASI okwenzakalayo",
    af: "Vertel SASI wat gebeur",
  },
  "landing.cta.services": {
    en: "Explore civic services",
    zu: "Hlolola izinsizakalo",
    af: "Verken burgerlike dienste",
  },
  "landing.command.placeholder": {
    en: "Open the SASI command bar to search or ask",
    zu: "Vula ibha yomyalo we-SASI ukuze useshe noma buze",
    af: "Maak die SASI-opdragbalk om te soek of te vra",
  },
  "landing.quick.water": {
    en: "Why is my water off?",
    zu: "Kungani amanzi ami avaliwe?",
    af: "Hoekom is my water af?",
  },
  "landing.quick.pipe": {
    en: "Report a burst pipe",
    zu: "Bika ipayipi elephukile",
    af: "Rapporteer 'n gebuiste pyp",
  },
  "landing.quick.near": {
    en: "Show incidents near me",
    zu: "Bonisa izigameko eduze nami",
    af: "Wys voorvalle naby my",
  },

  /* ---------- landing nav links ---------- */
  "landing.nav.services": { en: "Services", zu: "Izinsizakalo", af: "Dienste" },
  "landing.nav.how": {
    en: "How it works",
    zu: "Indlela esebenza ngayo",
    af: "Hoe dit werk",
  },
  "landing.nav.about": { en: "About", zu: "Mayelana", af: "Agor" },
  "landing.nav.security": { en: "Security", zu: "Ukuphepha", af: "Sekuriteit" },

  /* ---------- settings / language ---------- */
  "settings.language.interface": {
    en: "Interface language",
    zu: "Ulimi lwe-interface",
    af: "Koppelvlaktaal",
  },
  "settings.language.label": { en: "Language", zu: "Ulimi", af: "Taal" },
  "settings.language.covered": {
    en: "Translated now",
    zu: "Kuhunyushwe manje",
    af: "Nou vertaal",
  },
  "settings.language.planned": {
    en: "Planned",
    zu: "Kuhlelewe",
    af: "Beplan",
  },
  "settings.language.coming": {
    en: "coming soon",
    zu: "kuzofika maduze",
    af: "kom binnekort",
  },

  /* ---------- map focus ---------- */
  "map.focus.from": {
    en: "From your city briefing",
    zu: "Kusuka emfihlakalweni yedoloba",
    af: "Van jou stadsoorsig",
  },
  "map.focus.clear": { en: "Clear", zu: "Susa", af: "Skoonmaak" },
};

export type TKey = keyof typeof DICT | (string & {});

/** Translate a key for a language, falling back to English, then the key. */
export function translate(lang: Lang, key: TKey): string {
  const entry = DICT[key as string];
  if (!entry) return key as string;
  return entry[lang] ?? entry.en;
}

/** Hook: bind t() to the active language from the store. */
export function useT() {
  const lang = useSasiStore((s) => s.lang);
  return (key: TKey) => translate(lang, key);
}
