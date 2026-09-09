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
   dashboard / cases / notifications / incidents / map views, settings
   language section.
   Remaining views (case detail, report wizard, etc.) keep English
   (noted honestly in Settings).
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
    note: "Shell, landing, dashboard, cases, notifications, incidents, map and shared controls.",
  },
  {
    code: "af",
    label: "Afrikaans",
    english: "Afrikaans",
    note: "Shell, landing, dashboard, cases, notifications, incidents, map and shared controls.",
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
