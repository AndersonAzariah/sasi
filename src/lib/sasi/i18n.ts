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
   hero + primary CTAs, public header CTAs, notification panel chrome,
   dashboard / cases / notifications / incidents / map views, case
   detail + incident detail views, settings language section.
   Remaining views (report wizard, activity, evidence, admin, etc.)
   keep English (noted honestly in Settings).
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
    note: "Shell, landing, dashboard, cases, case + incident detail, notifications, incidents, map and shared controls.",
  },
  {
    code: "af",
    label: "Afrikaans",
    english: "Afrikaans",
    note: "Shell, landing, dashboard, cases, case + incident detail, notifications, incidents, map and shared controls.",
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

  /* ============================================================
     DASHBOARD view
     ============================================================ */
  "dash.greeting.morning": {
    en: "Good morning",
    zu: "Sawubona (ekuseni)",
    af: "Goeie more",
  },
  "dash.greeting.afternoon": {
    en: "Good afternoon",
    zu: "Sawubona (ntambama)",
    af: "Goeie middag",
  },
  "dash.greeting.evening": {
    en: "Good evening",
    zu: "Sawubona (ebusuku)",
    af: "Goeie aand",
  },
  "dash.picture.for": {
    en: "Here is your civic picture for",
    zu: "Nansi isithombe sakho sezompfhakathi se",
    af: "Hier is jou burgerlike prentjie vir",
  },
  "dash.start-investigation": {
    en: "Start an investigation",
    zu: "Qala uphenyo",
    af: "Begin 'n ondersoek",
  },
  "dash.command.placeholder": {
    en: "What do you need help with?",
    zu: "Ofuna usizo ngani?",
    af: "Waarmee kan ek help?",
  },
  "dash.stat.active-cases": {
    en: "Active cases",
    zu: "Amacala asebenzayo",
    af: "Aktiewe sake",
  },
  "dash.stat.investigating": {
    en: "Investigating",
    zu: "Kuyaphenanywa",
    af: "Onder soek",
  },
  "dash.stat.action-required": {
    en: "Action required",
    zu: "Kudingeka isenzo",
    af: "Aksie vereis",
  },
  "dash.stat.nearby-incidents": {
    en: "Nearby incidents",
    zu: "Izigameko eziseduze",
    af: "Voorvalle naby",
  },
  "dash.hint.demo-dataset": {
    en: "Demo dataset",
    zu: "Idatha yedemo",
    af: "Demo-datastel",
  },
  "dash.current-cases": {
    en: "Current cases",
    zu: "Amacalaamanje",
    af: "Huidige sake",
  },
  "dash.on-record": {
    en: "ON RECORD",
    zu: "EKIREKHODINI",
    af: "OP REKORD",
  },
  "dash.view-all-cases": {
    en: "View all cases",
    zu: "Bona wonke amacala",
    af: "Sien alle sake",
  },
  "dash.nearby": { en: "Nearby", zu: "Eduze nami", af: "Naby my" },
  "dash.civic-intelligence": {
    en: "Civic intelligence",
    zu: "Ukwazi komphakathi",
    af: "Burgerlike intelligensie",
  },
  "dash.next-steps": {
    en: "Next steps",
    zu: "Izinyathelo ezilandelayo",
    af: "Volgende stappe",
  },
  "dash.approval-needed": {
    en: "Approval needed",
    zu: "Kudingeka imvume",
    af: "Goedkeuring nodig",
  },
  "dash.action-in-progress": {
    en: "Action in progress",
    zu: "Isenzo siyaqhubeka",
    af: "Aksie aan die gang",
  },
  "dash.action-completed": {
    en: "Action completed",
    zu: "Isenzo siqediwe",
    af: "Aksie voltooi",
  },
  "dash.review": { en: "Review", zu: "Bheka", af: "Hersien" },
  "dash.no-action-waiting": {
    en: "No action is waiting on you right now. A few places to start:",
    zu: "Alukho isenzo silindele wena manje. Indawo ezimbalwa zokuqala:",
    af: "Geen aksie wag op jou nie. 'n Paar plekke om te begin:",
  },
  "dash.tip.report": {
    en: "Report a new issue",
    zu: "Bika udaba olusha",
    af: "Rapporteer 'n nuwe probleem",
  },
  "dash.tip.investigate": {
    en: "Start an investigation",
    zu: "Qala uphenyo",
    af: "Begin 'n ondersoek",
  },
  "dash.tip.incidents": {
    en: "Browse nearby incidents",
    zu: "Hlola izigameko eziseduze",
    af: "Blaai deur voorvalle naby",
  },
  "dash.service-shortcuts": {
    en: "Service shortcuts",
    zu: "Izinqamuleli zensizakalo",
    af: "Dienskortpaaie",
  },
  "dash.recent-activity": {
    en: "Recent activity",
    zu: "Umsebenzi wakamuva",
    af: "Onlangse aktiwiteit",
  },
  "dash.view-all-activity": {
    en: "View all activity",
    zu: "Bona wonke umsebenzi",
    af: "Sien alle aktiwiteit",
  },

  /* ============================================================
     CASES view
     ============================================================ */
  "cases.title": { en: "Cases", zu: "Amacala", af: "Sake" },
  "cases.subtitle": {
    en: "Every issue you have reported to SASI, with its investigation state.",
    zu: "Udaba olubike ku-SASI ngalunye, nezimo zophenyo lwalo.",
    af: "Elke probleem wat jy by SASI gerapporteer het, met sy ondersoekstatus.",
  },
  "cases.report-issue": {
    en: "Report an issue",
    zu: "Bika udaba",
    af: "Rapporteer 'n probleem",
  },
  "cases.filter.all": { en: "All", zu: "Konke", af: "Alles" },
  "cases.filter.open": { en: "Open", zu: "Kuvuliwe", af: "Oop" },
  "cases.filter.investigating": {
    en: "Investigating",
    zu: "Kuyaphenanywa",
    af: "Ondersoek",
  },
  "cases.filter.action-required": {
    en: "Action required",
    zu: "Kudingeka isenzo",
    af: "Aksie vereis",
  },
  "cases.filter.waiting": { en: "Waiting", zu: "Kulindile", af: "Wag" },
  "cases.filter.resolved": {
    en: "Resolved",
    zu: "Kuxazululiwe",
    af: "Opgelos",
  },
  "cases.all-services": {
    en: "All services",
    zu: "Zonke izinsizakalo",
    af: "Alle dienste",
  },
  "cases.all-locations": {
    en: "All locations",
    zu: "Zonke izindawo",
    af: "Alle plekke",
  },
  "cases.all-priorities": {
    en: "All priorities",
    zu: "Zonke izinga lobubanzi",
    af: "Alle prioriteite",
  },
  "cases.empty.title": {
    en: "No cases match these filters",
    zu: "Awukho amacala ahambisana nalokhu kucoca",
    af: "Geen sake pas hierdie filters nie",
  },
  "cases.empty.description": {
    en: "Try a different status, service or location — or clear the filters to see every case on record.",
    zu: "Zama isimo eshlukile, insizakalo noma indawo — noma susa izihlungi ukuze ubone wonke amacala.",
    af: "Probeer 'n ander status, diens of plek — of maak die filters oop om elke saak te sien.",
  },
  "cases.clear-filters": {
    en: "Clear filters",
    zu: "Susa izihlungi",
    af: "Maak filters skoon",
  },

  /* ============================================================
     NOTIFICATIONS view
     ============================================================ */
  "ntf.title": { en: "Notifications", zu: "Izaziso", af: "Kennisgewings" },
  "ntf.subtitle": {
    en: "Approvals, findings and updates about your cases.",
    zu: "Izimvume, izitholakalo nezibonelelo mayelana amacala akho.",
    af: "Goedkeurings, bevindinge en opdaterings oor jou sake.",
  },
  "ntf.unread": {
    en: "unread",
    zu: "okungafundwanga",
    af: "ongelees",
  },
  "ntf.mark-all-read": {
    en: "Mark all read",
    zu: "Maka konke kufundwe",
    af: "Merk alles as gelees",
  },
  "ntf.digest.live-events": {
    en: "Live events",
    zu: "Izehlakalo eziphilayo",
    af: "Lewende gebeurtenisse",
  },
  "ntf.digest.latest": {
    en: "Latest:",
    zu: "Okusha kakhulu:",
    af: "Nuutste:",
  },
  "ntf.digest.nothing-yet": {
    en: "Nothing yet this session",
    zu: "Alukho lutho lesiseshini",
    af: "Nog niks hierdie sessie nie",
  },
  "ntf.digest.your-reports": {
    en: "Your reports",
    zu: "Imibiko yakho",
    af: "Jou rapporte",
  },
  "ntf.digest.created-browser": {
    en: "Created through this browser",
    zu: "Yenziwe ngalelisiphequluli",
    af: "Geskep deur hierdie blaaier",
  },
  "ntf.digest.city-briefing": {
    en: "City briefing",
    zu: "Imfihlakalo yedoloba",
    af: "Stadsoorsig",
  },
  "ntf.digest.not-written": {
    en: "Not written yet",
    zu: "Ibhalwanga manje",
    af: "Nog nie geskryf nie",
  },
  "ntf.digest.opens-dashboard": {
    en: "Opens on the dashboard",
    zu: "Ivula kudashibodi",
    af: "Maak op die dashbord oop",
  },
  "ntf.digest.what-changed": {
    en: "What changed today?",
    zu: "Kwaguquka ngani namuhla?",
    af: "Wat het vandag verander?",
  },
  "ntf.filter.all": { en: "All", zu: "Konke", af: "Alles" },
  "ntf.filter.cases": { en: "Cases", zu: "Amacala", af: "Sake" },
  "ntf.filter.investigations": {
    en: "Investigations",
    zu: "Uphenyo",
    af: "Ondersoeke",
  },
  "ntf.filter.actions": { en: "Actions", zu: "Izenzo", af: "Aksies" },
  "ntf.filter.updates": { en: "Updates", zu: "Izibonelelo", af: "Opdaterings" },
  "ntf.empty.title": {
    en: "You're all caught up.",
    zu: "Uqediwe konke.",
    af: "Jy is heeltemal op datum.",
  },
  "ntf.empty.description": {
    en: "No notifications in this category. New signals about your cases will appear here.",
    zu: "Alukho naziphi izaziso kulesigaba. Izinkomba ezisha mayelana amacala akho zizovela lapha.",
    af: "Geen kennisgewings in hierdie kategorie nie. Nuwe seine oor jou sake sal hier verskyn.",
  },
  "ntf.all-caught-up": {
    en: "All caught up — every notification has been read.",
    zu: "Konke kuqediwe — yonke izaziso ziphofundiwe.",
    af: "Heeltemal op datum — elke kennisgewing is gelees.",
  },

  /* ============================================================
     SHARED status + severity labels (incidents + map views)
     ============================================================ */
  "status.confirmed": { en: "Confirmed", zu: "Kuqinisekisiwe", af: "Bevestig" },
  "status.reported": { en: "Reported", zu: "Kubikiwe", af: "Gerapporteer" },
  "status.urgent": { en: "Urgent", zu: "Okuphuthumayo", af: "Dringend" },
  "status.resolved": { en: "Resolved", zu: "Kuxazululiwe", af: "Opgelos" },
  "sev.low": { en: "Low", zu: "Ephansi", af: "Laag" },
  "sev.medium": { en: "Medium", zu: "Esemaphakathi", af: "Medium" },
  "sev.high": { en: "High", zu: "Ephezulu", af: "Hoog" },
  "sev.critical": { en: "Critical", zu: "Okubucayi", af: "Kritiek" },

  /* ============================================================
     MAP view
     Placeholders: {shown} {total} {n} {t} — replaced with .replace()
     ============================================================ */
  "map.filters": { en: "Map filters", zu: "Izihlungi zemephu", af: "Kaartfilters" },
  "map.filters.description": {
    en: "Filter the demo incidents shown on the map.",
    zu: "Coca izigameko zedemo eziboniswa emephu.",
    af: "Filtreer die demo-voorvalle wat op die kaart gewys word.",
  },
  "map.search": { en: "Search incidents…", zu: "Sesha izigameko…", af: "Deursoek voorvalle…" },
  "map.search-aria": {
    en: "Search incidents on map",
    zu: "Sesha izigameko emephu",
    af: "Deursoek voorvalle op kaart",
  },
  "map.service": { en: "Service", zu: "Insizakalo", af: "Diens" },
  "map.status": { en: "Status", zu: "Isimo", af: "Status" },
  "map.shown": {
    en: "{shown} of {total} demo incidents shown",
    zu: "Kubonisiwe izigameko ezingu-{shown} kwezingu-{total} zedemo",
    af: "{shown} van {total} demo-voorvalle gewys",
  },
  "map.select-marker": { en: "Select a marker", zu: "Khetha uphawu", af: "Kies 'n marker" },
  "map.select-hint": {
    en: "Markers are colour-coded by trust status. Choose one to see the incident summary here.",
    zu: "Uphawu lumelwa ngesimo sokuthembeka. Khetha olulodwa ukuze ubone isifinyezo sesigameko lapha.",
    af: "Markers is kleurgekodeer volgens vertrouensstatus. Kies een om die voorvalopsomming hier te sien.",
  },
  "map.open-incident": { en: "Open incident", zu: "Vula isigameko", af: "Maak voorval oop" },
  "map.open-case": { en: "Open case", zu: "Vula icala", af: "Maak saak oop" },
  "map.none-title": {
    en: "No incidents match these filters",
    zu: "Ayikho isigameko ehambisana nalokhu kucoca",
    af: "Geen voorvalle pas hierdie filters nie",
  },
  "map.none-hint": {
    en: "Widen the service or status filters.",
    zu: "Khulisa izihlungi zensizakalo noma zesimo.",
    af: "Wyd die diens- of statusfilters uit.",
  },
  "map.clear-all": {
    en: "Clear all filters",
    zu: "Susa zonke izihlungi",
    af: "Maak alle filters skoon",
  },
  "map.show-one": { en: "Show 1 incident", zu: "Bonisa isigameko esi-1", af: "Wys 1 voorval" },
  "map.show-many": {
    en: "Show {n} incidents",
    zu: "Bonisa izingameko ezingu-{n}",
    af: "Wys {n} voorvalle",
  },
  "map.from-briefing": {
    en: "From your city briefing",
    zu: "Kusuka kwinfihlakalo yedoloba yakho",
    af: "Van jou stadsoorsig",
  },
  "map.clear": { en: "Clear", zu: "Susa", af: "Maak skoon" },
  "map.your-reports": { en: "Your reports", zu: "Imibiko yakho", af: "Jou rapporte" },
  "map.your-report-tag": { en: "Your report", zu: "Umbiko wakho", af: "Jou rapport" },
  "map.updated": { en: "Updated {t}", zu: "Kubuyekeziwe {t}", af: "Opgedateer {t}" },
  "map.sources-one": {
    en: "{n} public source",
    zu: "Umthombo womphakathi oyedwa",
    af: "{n} openbare bron",
  },
  "map.sources-many": {
    en: "{n} public sources",
    zu: "Imithombo yomphakathi engu-{n}",
    af: "{n} openbare bronne",
  },
  "map.you-are-here": { en: "You are here", zu: "Ulapha", af: "Jy is hier" },
  "map.saved-note": {
    en: "Your reports are placed near your saved location.",
    zu: "Imibiko yakho ibekwe eduze nendawo yakho egciniwe.",
    af: "Jou rapporte is naby jou bergplek geplaas.",
  },
  "map.filed": { en: "Filed {t}", zu: "Ifayiliwe {t}", af: "Gelewer {t}" },

  /* ============================================================
     INCIDENTS view
     ============================================================ */
  "inc.title": { en: "Civic incidents", zu: "Izigameko zomphakathi", af: "Burgerlike voorvalle" },
  "inc.subtitle": {
    en: "Reported and confirmed service incidents across Gauteng.",
    zu: "Izigameko zensizakalo ezibikiwe nezinqinisekisiwe kwaGauteng.",
    af: "Gerapporteerde en bevestigde diensvoorvalle oor Gauteng.",
  },
  "inc.stat-confirmed": { en: "Confirmed", zu: "Kuqinisekisiwe", af: "Bevestig" },
  "inc.stat-confirmed-hint": {
    en: "Verified against sources",
    zu: "Kuqinisekisiwe ngemithombo",
    af: "Teen bronne geverifieer",
  },
  "inc.stat-reported": { en: "Reported", zu: "Kubikiwe", af: "Gerapporteer" },
  "inc.stat-reported-hint": {
    en: "Awaiting confirmation",
    zu: "Kulindele ukuqinisekiswa",
    af: "Wag vir bevestiging",
  },
  "inc.stat-urgent": { en: "Urgent", zu: "Okuphuthumayo", af: "Dringend" },
  "inc.stat-urgent-hint": {
    en: "Immediate attention",
    zu: "Dinga ukunakwa ngokushesha",
    af: "Onmiddellike aandag nodig",
  },
  "inc.stat-resolved": { en: "Resolved", zu: "Kuxazululiwe", af: "Opgelos" },
  "inc.stat-resolved-hint": {
    en: "Closed in demo dataset",
    zu: "Kuvaliwe kusethi yedemo",
    af: "Gesluit in demodatastel",
  },
  "inc.search": {
    en: "Search title, suburb or city…",
    zu: "Sesha isihloko, idolobhana noma idolobha…",
    af: "Deursoek titel, voorstad of stad…",
  },
  "inc.search-aria": {
    en: "Search incidents by title, suburb or city",
    zu: "Sesha izigameko ngesihloko, idolobhana noma idolobha",
    af: "Deursoek voorvalle volgens titel, voorstad of stad",
  },
  "inc.view-card": {
    en: "Card list view",
    zu: "Buka ngamakhadi",
    af: "Kaartlys-aansig",
  },
  "inc.view-dense": {
    en: "Dense list view",
    zu: "Buka uhlu oluminyene",
    af: "Digter lysaansig",
  },
  "inc.filter-service": { en: "Service", zu: "Insizakalo", af: "Diens" },
  "inc.filter-status": { en: "Status", zu: "Isimo", af: "Status" },
  "inc.filter-severity": { en: "Severity", zu: "Isinga", af: "Ernstigheid" },
  "inc.filter-municipality": {
    en: "Municipality",
    zu: "Umasipala",
    af: "Munisipaliteit",
  },
  "inc.filter-all": { en: "All", zu: "Konke", af: "Alles" },
  "inc.all-municipalities": {
    en: "All municipalities",
    zu: "Wonke amamasipala",
    af: "Alle munisipaliteite",
  },
  "inc.municipality-aria": {
    en: "Filter by municipality",
    zu: "Coca ngomasipala",
    af: "Filtreer volgens munisipaliteit",
  },
  "inc.clear-filters": {
    en: "Clear filters",
    zu: "Susa izihlungi",
    af: "Maak filters skoon",
  },
  "inc.count-one": { en: "1 incident", zu: "Isigameko esi-1", af: "1 voorval" },
  "inc.count-many": { en: "{n} incidents", zu: "Izingameko ezingu-{n}", af: "{n} voorvalle" },
  "inc.empty-title": {
    en: "No incidents match these filters",
    zu: "Ayikho isigameko ehambisana nalokhu kucoca",
    af: "Geen voorvalle pas hierdie filters nie",
  },
  "inc.empty-description": {
    en: "Adjust filters to widen the search across the demo dataset.",
    zu: "Lungisa izihlungi ukuze wandisa usesho kusethi yedemo.",
    af: "Pas filters aan om die soektog oor die demodatastel te wy.",
  },
  "inc.empty-clear": {
    en: "Clear all filters",
    zu: "Susa zonke izihlungi",
    af: "Maak alle filters skoon",
  },

  /* ============================================================
     CASE DETAIL view
     ============================================================ */
  "cd.back": { en: "All cases", zu: "Wonke amacala", af: "Alle sake" },
  "cd.back-aria": {
    en: "Back to all cases",
    zu: "Buyela emacaleni wonke",
    af: "Terug na alle sake",
  },
  "cd.notfound.title": { en: "Case not found", zu: "Icala alitholakali", af: "Saak nie gevind nie" },
  "cd.notfound.desc": {
    en: "This case is not in the demo record. It may have been cleared, or the reference is incorrect.",
    zu: "Le cala alikho kurekhodi yedemo. Kungenzeka susiwe, noma ireferensi ayilona.",
    af: "Hierdie saak is nie in die demorekord nie. Dit is dalk uitgevee, of die verwysing is verkeerd.",
  },
  "cd.share": { en: "Share", zu: "Yabelana", af: "Deel" },
  "cd.share-dialog": {
    en: "Share case",
    zu: "Yabelanangecala",
    af: "Deel saak",
  },
  "cd.share.copy": { en: "Copy case summary", zu: "Kopisha isifingqo secala", af: "Kopie saakopsomming" },
  "cd.share.copied": { en: "Summary copied", zu: "Isifingqo sikopishiwe", af: "Opsomming gekopieer" },
  "cd.share.print": {
    en: "Print / save as PDF",
    zu: "Phrinta / gcina njenge-PDF",
    af: "Druk / stoor as PDF",
  },
  "cd.share.note": {
    en: "Direct link sharing is not available in this demo.",
    zu: "Ukwabelana ngesixhumanisi esiqondile akutholakala kule demo.",
    af: "Direkte skakel-deling is nie in hierdie demo beskikbaar nie.",
  },
  "cd.open-investigation": {
    en: "Open investigation",
    zu: "Vula uphenyo",
    af: "Maar ondersoek oop",
  },
  "cd.tab.overview": { en: "Overview", zu: "Uhlolojikelele", af: "Oorsig" },
  "cd.tab.investigation": { en: "Investigation", zu: "Uphenyo", af: "Ondersoek" },
  "cd.tab.evidence": { en: "Evidence", zu: "Ubufakazi", af: "Bewys" },
  "cd.tab.sources": { en: "Sources", zu: "Imithombo", af: "Bronne" },
  "cd.tab.actions": { en: "Actions", zu: "Izenzo", af: "Aksies" },
  "cd.tab.activity": { en: "Activity", zu: "Umsebenzi", af: "Aktiwiteit" },
  "cd.summary": { en: "Summary", zu: "Isifingqo", af: "Opsomming" },
  "cd.impact": { en: "Impact", zu: "Umthelela", af: "Impak" },
  "cd.details": { en: "Details", zu: "Imininingwane", af: "Details" },
  "cd.facts.service": { en: "Service", zu: "Insizakalo", af: "Diens" },
  "cd.facts.location": { en: "Location", zu: "Indawo", af: "Ligging" },
  "cd.facts.created": { en: "Created", zu: "Idaliwe", af: "Geskep" },
  "cd.facts.updated": { en: "Updated", zu: "Ibuyekezisiwe", af: "Opgedateer" },
  "cd.facts.priority": { en: "Priority", zu: "Okubalulekile", af: "Prioriteit" },
  "cd.facts.status": { en: "Status", zu: "Isimo", af: "Status" },
  "cd.progress": { en: "Case progress", zu: "Ukuqhubeka secala", af: "Saakvordering" },
  "cd.progress-aria": {
    en: "Case progress",
    zu: "Ukuqhubeka secala",
    af: "Saakvordering",
  },
  "cd.hint.OPEN": {
    en: "Report received — SASI is preparing to investigate.",
    zu: "Umbiko wamukelwe — i-SASI ilungiselela ukuphenya.",
    af: "Verslag ontvang — SASI berei voor om te ondersoek.",
  },
  "cd.hint.INVESTIGATING": {
    en: "SASI is researching sources and building findings.",
    zu: "I-SASI iphenya imithombo futhi yakha izitholakalo.",
    af: "SASI ondersoek bronne en bou bevindinge.",
  },
  "cd.hint.ACTION_REQUIRED": {
    en: "An action is prepared and waiting for your approval.",
    zu: "Isenzo silungile silinde ukuvunywa kwakho.",
    af: "’n Aksie is voorberei en wag vir jou goedkeuring.",
  },
  "cd.hint.WAITING": {
    en: "SASI is monitoring for updates from the responsible service.",
    zu: "I-SASI ilandelela izibuyekezo kunsizakalo ebhekene nalo.",
    af: "SASI monitor opdaterings van die verantwoordelike diens.",
  },
  "cd.hint.RESOLVED": {
    en: "Resolved and verified.",
    zu: "Kuxazululiwe futhi kuqinisekisiwe.",
    af: "Opgelos en geverifieer.",
  },
  "cd.hint.CLOSED": { en: "Closed.", zu: "Kuvaliwe.", af: "Gesluit." },
  "cd.cando.title": {
    en: "What SASI can and cannot do",
    zu: "Okungakwenza nokungeke kwenze i-SASI",
    af: "Wat SASI kan en nie kan doen nie",
  },
  "cd.can.1": {
    en: "Search official notices, open data and credible news for your issue.",
    zu: "Sesha izaziso ezisemthethweni, idatha evulekile kanye nezindaba ezithembekile.",
    af: "Deursoek amptelike kennisgewings, oop data en betroubare nuus vir jou saak.",
  },
  "cd.can.2": {
    en: "Correlate your evidence with public records and community reports.",
    zu: "Hlanganisa ubufakazi bakho nemirekhomiqembu nemibiko yomphakathi.",
    af: "Korreleer jou bewys met openbare rekords en gemeenskapsverslae.",
  },
  "cd.can.3": {
    en: "Prepare a submission or enquiry — for your approval before anything is sent.",
    zu: "Lungisa ukuthunyelwa nombuzo — kuqale kuwuvunywe wena.",
    af: "Berei ’n indiening of navraag voor — vir jou goedkeuring voordat iets gestuur word.",
  },
  "cd.can.4": {
    en: "Re-check after an approved action to verify the outcome.",
    zu: "Hlola futhi emva kwesenzo esivunyiwe ukuze uqinisekise umphumela.",
    af: "Her Kontroleer na goedgekeurde aksie om die uitkoms te verifieer.",
  },
  "cd.cannot.1": {
    en: "Submit anything to government without your explicit approval.",
    zu: "Thumela lutho kukahulumende ngaphandle kokuvuma kwakho okucacile.",
    af: "Dien niks by die regering in sonder jou uitdruklike goedkeuring nie.",
  },
  "cd.cannot.2": {
    en: "Guarantee response times or outcomes from any institution.",
    zu: "Silahlekelwe isikhathi sokusabela noma imiphumela ezinsizeni.",
    af: "Waarborg nie reaksietye of uitkomste van enige instansie nie.",
  },
  "cd.cannot.3": {
    en: "Provide legal advice or represent you in any process.",
    zu: "Nikeza usizo olwesabelo noma meluleko yobunjiniyela.",
    af: "Verskaf nie regsluiting of verteenwoordiging in enige proses nie.",
  },
  "cd.cannot.4": {
    en: "Act on your behalf without a record in the case timeline.",
    zu: "Enza ngokwakho ngaphandle kokubhalwa emgudweni wecala.",
    af: "Handel nie namens jou sonder ’n rekord in die saaktydlyn nie.",
  },
  "cd.timeline.title": {
    en: "Investigation timeline",
    zu: "Umugqa wephenyo",
    af: "Ondersoektydlyn",
  },
  "cd.findings": { en: "Findings", zu: "Izitholakalo", af: "Bevindinge" },
  "cd.empty.findings": {
    en: "No findings yet",
    zu: "Azikho izitholakalo okusalungile",
    af: "Nog geen bevindinge nie",
  },
  "cd.empty.findings.desc": {
    en: "SASI has not generated findings for this case yet. They will appear here as the investigation progresses.",
    zu: "I-SASI ikhishile izitholakalo yalesi sigaba. Zizovela lapha uphenyo luqhubeka.",
    af: "SASI het nog geen bevindinge vir hierdie saak gegenereer nie. Dit sal hier verskyn soos die ondersoek vorder.",
  },
  "cd.evidence.count": {
    en: "{n} items · linked to this case",
    zu: "Izinto ezingu-{n} · zixhumekene nale cala",
    af: "{n} items · aan hierdie saak gekoppel",
  },
  "cd.add-evidence": { en: "Add evidence", zu: "Engeza ubufakazi", af: "Voeg bewys by" },
  "cd.empty.evidence": {
    en: "No evidence linked",
    zu: "Abukho bufakazi obuxhumekile",
    af: "Geen bewys gekoppel nie",
  },
  "cd.empty.evidence.desc": {
    en: "Add photos, notes or links to strengthen this case. Evidence helps SASI verify what is happening.",
    zu: "Engeza izithombe, amanothi noma izixhumanisi ukuze uqinisekise le cala.",
    af: "Voeg foto’s, notities of skakels by om hierdie saak te versterk.",
  },
  "cd.sources.count": {
    en: "{n} sources · {off} official",
    zu: "Imithombo engu-{n} · {off} isemthethweni",
    af: "{n} bronne · {off} amptelik",
  },
  "cd.empty.sources": {
    en: "No sources found yet",
    zu: "Ayikho imithombo etholakele",
    af: "Nog geen bronne gevind nie",
  },
  "cd.empty.sources.desc": {
    en: "SASI has not matched any official or public sources to this case yet.",
    zu: "I-SASI ayikatholakali imithombo esemthethweni yobulungisa le cala.",
    af: "SASI het nog geen amptelike of openbare bronne met hierdie saak gepas nie.",
  },
  "cd.empty.action": {
    en: "No action prepared yet",
    zu: "Asikho isenzo silungile",
    af: "Nog geen aksie voorberei nie",
  },
  "cd.empty.action.desc": {
    en: "When SASI has a recommended next step for this case, it will appear here for your approval first.",
    zu: "Uma i-SASI inesiphakamiso esilandelayo, sizovela lapha siqale kuwuvunywe wena.",
    af: "Wanneer SASI ’n aanbevole volgende stap het, verskyn dit hier vir jou goedkeuring eerste.",
  },
  "cd.why.title": {
    en: "Why approval is required",
    zu: "Ukuvunywa kudingeka ngani",
    af: "Hoekom goedkeuring vereis word",
  },
  "cd.why.body": {
    en: "SASI never takes consequential external action silently. Anything that leaves the platform — a submission, an enquiry, a formal report — is prepared as a draft and waits for your explicit approval.",
    zu: "I-SASI ayenzizi izenzo ezibalulekile ngokuthula. Noma yini ephuma kulesi sikhwama — ilungisa bese ilinde wena.",
    af: "SASI neem nooit belangrike eksterne aksie stilswyend nie. Enigiets wat die platform verlaat word as ’n konsep voorberei en wag vir jou goedkeuring.",
  },
  "cd.why.1": {
    en: "You approve the exact content before it leaves the platform.",
    zu: "Wena wavuma okuqukethwe ngaphambi kokuphuma.",
    af: "Jy keur die presiese inhoud goed voordat dit die platform verlaat.",
  },
  "cd.why.2": {
    en: "You can see the recipient and what information is shared.",
    zu: "Uyabona owamukelayo nalokho okwabelwana ngakho.",
    af: "Jy kan die ontvanger sien en watter inligting gedeel word.",
  },
  "cd.why.3": {
    en: "Nothing is submitted in the background or on a delay.",
    zu: "Akukho okuthunyelwa ngemuva noma ukulinda.",
    af: "Niks word op die agtergrond of met vertraag ingedien nie.",
  },
  "cd.why.note": {
    en: "Every approval and rejection is recorded in the case timeline.",
    zu: "Ukuvunywa nokwenqaba kubhalwa emgudweni wecala.",
    af: "Elke goedkeuring en weiering word in die saaktydlyn aangeteken.",
  },
  "cd.activity.title": {
    en: "Full case activity",
    zu: "Umsebenzi wecala wonke",
    af: "Volle saakaktiwiteit",
  },
  "cd.activity.count": {
    en: "{n} events",
    zu: "Izehlakalo ezingu-{n}",
    af: "{n} gebeurtenisse",
  },

  /* ============================================================
     INCIDENT DETAIL view
     ============================================================ */
  "id.back": {
    en: "Back to incidents",
    zu: "Buyela ezigamekweni",
    af: "Terug na voorvalle",
  },
  "id.back-aria": {
    en: "Back to incidents explorer",
    zu: "Buyela kumhloli wezigameko",
    af: "Terug na voorvalverkenner",
  },
  "id.notfound.title": {
    en: "Incident not found",
    zu: "Isigameko asitholakali",
    af: "Voorval nie gevind nie",
  },
  "id.notfound.desc": {
    en: "This incident reference does not exist in the demo dataset. It may have been opened from an outdated link.",
    zu: "Le referensi yesigameko ayikho kusethi yedemo. Kungenzeka kavuliwe ngesixhumanisi esidala.",
    af: "Hierdie voorvalverwysing bestaan nie in die demodatastel nie. Dit is dalk van ’n verouderde skakel geopen.",
  },
  "id.browse-all": {
    en: "Browse all incidents",
    zu: "Zulazula ezigamekweni zonke",
    af: "Deurblaai alle voorvalle",
  },
  "id.share": { en: "Share", zu: "Yabelana", af: "Deel" },
  "id.share-dialog": {
    en: "Share incident",
    zu: "Yabelana ngesigameko",
    af: "Deel voorval",
  },
  "id.share.copy": {
    en: "Copy incident summary",
    zu: "Kopisha isifingqo sesigameko",
    af: "Kopie voorvalopsomming",
  },
  "id.share.copied": { en: "Summary copied", zu: "Isifingqo sikopishiwe", af: "Opsomming gekopieer" },
  "id.share.print": {
    en: "Print / save as PDF",
    zu: "Phrinta / gcina njenge-PDF",
    af: "Druk / stoor as PDF",
  },
  "id.share.note": {
    en: "Direct link sharing is not available in this demo.",
    zu: "Ukwabelana ngesixhumanisi esiqondile akutholakala kule demo.",
    af: "Direkte skakel-deling is nie in hierdie demo beskikbaar nie.",
  },
  "id.share.hint": {
    en: "Export this incident as a plain-text brief or a one-page PDF.",
    zu: "Thekelela lesi sigameko njengesifingqo noma i-PDF yesigaba.",
    af: "Voer hierdie voorval uit as ’n teksopsomming of eenblad-PDF.",
  },
  "id.summary": { en: "Summary", zu: "Isifingqo", af: "Opsomming" },
  "id.details": { en: "Details", zu: "Imininingwane", af: "Details" },
  "id.facts.service": { en: "Service", zu: "Insizakalo", af: "Diens" },
  "id.facts.province": { en: "Province", zu: "Isifundazwe", af: "Provinsie" },
  "id.facts.municipality": {
    en: "Municipality",
    zu: "Umasipala",
    af: "Munisipaliteit",
  },
  "id.facts.city": {
    en: "City / suburb",
    zu: "Idolobha / idolobhana",
    af: "Stad / voorstad",
  },
  "id.facts.area": {
    en: "Affected area",
    zu: "Indawo ethintekile",
    af: "Geaffekteerde gebied",
  },
  "id.facts.reported": { en: "Reported", zu: "Kubikiwe", af: "Gerapporteer" },
  "id.facts.last-update": {
    en: "Last update",
    zu: "Isibuyekezo sokugcina",
    af: "Laaste opdatering",
  },
  "id.facts.sources": { en: "Sources", zu: "Imithombo", af: "Bronne" },
  "id.sources-none": {
    en: "None attached yet",
    zu: "Akukho naxhumekile",
    af: "Nog nie gekoppel nie",
  },
  "id.updates": {
    en: "Recent updates",
    zu: "Izibuyekezo zakamuva",
    af: "Onlangse opdaterings",
  },
  "id.updates.note": {
    en: "Reconstructed from demo incident data — not a live event feed.",
    zu: "Yakhiwe kabusha kusethi yedemo — ayona imigqa yezehlakalo ephilayo.",
    af: "Geherkonstrueer uit demovoorvaldata — nie ’n lewende gebeurtenisstroom nie.",
  },
  "id.sources": {
    en: "Public sources",
    zu: "Imithombo yomphakathi",
    af: "Openbare bronne",
  },
  "id.attached": { en: "{n} attached", zu: "Kuxhumekile okungu-{n}", af: "{n} gekoppel" },
  "id.sources.empty": {
    en: "No public sources attached yet — reports from residents keep this incident flagged. When an official notice or news report matches, it will appear here with its own trust status.",
    zu: "Ayikho imithombo yomphakathi exhumekile — imibiko yabahlali igcina lesi sigameko siphawule.",
    af: "Nog geen openbare bronne gekoppel nie — verslae van inwoners hou hierdie voorval gemerk.",
  },
  "id.location": { en: "Location", zu: "Indawo", af: "Ligging" },
  "id.coords": {
    en: "STYLISED POSITION · DEMO COORDINATES",
    zu: "INDAWO YE-STAYILI · IZIXHUMANO ZEDEMO",
    af: "GESTILISEERDE POSISIE · DEMOKOÖRDINATE",
  },
  "id.actions.title": {
    en: "Related actions",
    zu: "Izenzo ezihlobene",
    af: "Verwante aksies",
  },
  "id.investigate": {
    en: "Investigate this incident",
    zu: "Phenya lesi sigameko",
    af: "Ondersoek hierdie voorval",
  },
  "id.report-similar": {
    en: "Report a similar issue",
    zu: "Bika udaba olufana nalolu",
    af: "Rapporteer ’n soortgelyke probleem",
  },
  "id.actions.note": {
    en: "SASI prepares everything for your review first — nothing is submitted to government without your approval.",
    zu: "I-SASI ilungisa konkuqale kuwubuke we — akukho okuthunyelwa kukahulumende ngaphandle kokuvuma kwakho.",
    af: "SASI berei alles eerste vir jou hersiening voor — niks word sonder jou goedkeuring aan die regering ingedien nie.",
  },
  "id.related": {
    en: "Related cases",
    zu: "Amacala ahlobene",
    af: "Verwante sake",
  },
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
