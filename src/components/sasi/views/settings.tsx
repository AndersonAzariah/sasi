"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Camera,
  CheckCircle2,
  CloudOff,
  Database,
  Download,
  FileText,
  FolderSearch,
  Globe,
  HardDrive,
  Info,
  Languages,
  Lock,
  MapPin,
  Minus,
  MonitorSmartphone,
  Newspaper,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Smartphone,
  Sparkles,
  Stamp,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useSasiStore } from "@/lib/sasi/store";
import { usePwaStore } from "@/lib/sasi/pwa-store";
import { applyPwaUpdate, promptPwaInstall } from "@/components/sasi/pwa";
import { DEMO_USER, GAUTENG_MUNICIPALITIES } from "@/lib/sasi/data";
import { LANGUAGES, PLANNED_LANGUAGES, useT } from "@/lib/sasi/i18n";
import type { Lang } from "@/lib/sasi/types";
import { locationLabel, timeAgo } from "@/lib/sasi/utils";
import {
  DemoBadge,
  SectionLabel,
} from "@/components/sasi/primitives";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GhostButton, PrimaryButton } from "@/components/sasi/primitives";
import { cn } from "@/lib/utils";

/* ============================================================
   SETTINGS — honest, functional where feasible
   ============================================================ */

type SectionId =
  | "account"
  | "privacy"
  | "notifications"
  | "location"
  | "language"
  | "accessibility"
  | "ai"
  | "security"
  | "app"
  | "data";

const NAV: { id: SectionId; label: string; icon: typeof User }[] = [
  { id: "account", label: "Account", icon: User },
  { id: "privacy", label: "Privacy", icon: Lock },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "location", label: "Location", icon: MapPin },
  { id: "language", label: "Language", icon: Languages },
  { id: "accessibility", label: "Accessibility", icon: Globe },
  { id: "ai", label: "AI permissions", icon: Sparkles },
  { id: "security", label: "Security", icon: ShieldCheck },
  { id: "app", label: "App & offline", icon: Smartphone },
  { id: "data", label: "Data", icon: Database },
];

const TEXT_SIZES = [14, 15, 16, 17, 18];

/* ============================================================
   App & offline — live status of the installable offline shell.
   Reads the PWA runtime store (pwa-store.ts) so the section is
   always truthful: what is installed, whether the service worker
   is keeping an offline copy, and what still needs a connection.
   ============================================================ */

function StatusRow({
  icon: Icon,
  label,
  state,
  tone,
  action,
}: {
  icon: typeof Smartphone;
  label: string;
  state: string;
  tone: "good" | "warn" | "muted";
  action?: React.ReactNode;
}) {
  const toneCls =
    tone === "good"
      ? "border-[#66bb6a]/25 bg-[#66bb6a]/[0.07] text-[#a5d6a7]"
      : tone === "warn"
        ? "border-[#ffa726]/25 bg-[#ffa726]/[0.07] text-[#ffcc80]"
        : "border-white/8 bg-white/[0.03] text-zinc-500";
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.015] p-3.5 transition-colors hover:border-white/10">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#e3c567]/15 bg-[#e3c567]/[0.06]">
          <Icon className="h-3.5 w-3.5 text-[#e3c567]" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-medium text-zinc-200">{label}</span>
          <span className="block text-[11.5px] text-zinc-500">{state}</span>
        </span>
      </div>
      {action ?? (
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
            toneCls
          )}
        >
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              tone === "good" ? "bg-[#66bb6a]" : tone === "warn" ? "sasi-breathe bg-[#ffa726]" : "bg-zinc-600"
            )}
            aria-hidden
          />
          {tone === "good" ? "Active" : tone === "warn" ? "Waiting" : "—"}
        </span>
      )}
    </div>
  );
}

/** one quiet count tile in the "On this device" snapshot card */
function SnapshotTile({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3 transition-colors hover:border-white/10">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5 text-[17px] font-semibold text-zinc-100">
        {value}
        {unit && unit !== "—" && (
          <span className="text-[10.5px] font-medium uppercase tracking-[0.12em] text-[#a5d6a7]">{unit}</span>
        )}
        {unit === "—" && <span className="text-[12px] font-normal text-zinc-600">not cached</span>}
      </p>
    </div>
  );
}

/* ============================================================
   Per-view translation coverage — hand-maintained to stay honest.
   "full" = the view's user-facing strings resolve through the
   dictionary; "partial" = chrome/labels only; "none" = English
   for now. Mirrors the coverage notes in src/lib/sasi/i18n.ts.
   ============================================================ */
type CoverageState = "full" | "partial" | "none";
const I18N_COVERAGE: { view: string; cov: [CoverageState, CoverageState, CoverageState] }[] = [
  { view: "App shell & navigation", cov: ["full", "full", "full"] },
  { view: "Landing page", cov: ["full", "full", "full"] },
  { view: "Dashboard & briefing", cov: ["full", "full", "full"] },
  { view: "Report wizard", cov: ["full", "full", "full"] },
  { view: "Cases & case detail", cov: ["full", "full", "full"] },
  { view: "Incidents & incident detail", cov: ["full", "full", "full"] },
  { view: "Civic map", cov: ["full", "full", "full"] },
  { view: "Notifications", cov: ["full", "full", "full"] },
  { view: "Activity feed", cov: ["full", "full", "full"] },
  { view: "Evidence", cov: ["full", "full", "full"] },
  { view: "Ask SASI (interface)", cov: ["full", "partial", "partial"] },
  { view: "Settings (most sections)", cov: ["full", "partial", "partial"] },
  { view: "Services & service detail", cov: ["full", "none", "none"] },
  { view: "About / Security / Privacy / Terms", cov: ["full", "none", "none"] },
  { view: "Sign in / Sign up", cov: ["full", "none", "none"] },
  { view: "Investigate views", cov: ["full", "none", "none"] },
  { view: "Admin & profile", cov: ["full", "none", "none"] },
];

const COVERAGE_LEGEND: { state: CoverageState; label: string }[] = [
  { state: "full", label: "Translated" },
  { state: "partial", label: "Chrome / labels only" },
  { state: "none", label: "English for now" },
];

function coverageDotClass(state: CoverageState): string {
  return state === "full"
    ? "bg-[#66bb6a]"
    : state === "partial"
      ? "bg-[#ffa726]/70"
      : "bg-zinc-700";
}

function CoverageTable() {
  const fullZu = I18N_COVERAGE.filter((r) => r.cov[1] === "full").length;
  const fullAf = I18N_COVERAGE.filter((r) => r.cov[2] === "full").length;
  return (
    <div className="mt-3">
      <div
        className="grid grid-cols-[1fr_auto] gap-x-3 border-b border-white/8 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600"
        role="row"
      >
        <span role="columnheader">Surface</span>
        <span className="grid grid-cols-3 gap-2 text-center" role="columnheader">
          <span>EN</span>
          <span>ZU</span>
          <span>AF</span>
        </span>
      </div>
      <ul className="sasi-coverage-list mt-1.5 space-y-px">
        {I18N_COVERAGE.map((row) => (
          <li
            key={row.view}
            className="grid grid-cols-[1fr_auto] items-center gap-x-3 rounded px-1 py-[3px] transition-colors hover:bg-white/[0.03]"
          >
            <span className="truncate text-[11.5px] text-zinc-400">{row.view}</span>
            <span className="grid grid-cols-3 gap-2">
              {row.cov.map((state, i) => (
                <span key={i} className="flex justify-center">
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", coverageDotClass(state))}
                    aria-label={`${LANGUAGES[i].label}: ${COVERAGE_LEGEND.find((l) => l.state === state)?.label}`}
                    title={`${LANGUAGES[i].label}: ${COVERAGE_LEGEND.find((l) => l.state === state)?.label}`}
                  />
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/8 pt-2">
        {COVERAGE_LEGEND.map((l) => (
          <span key={l.state} className="flex items-center gap-1.5 text-[10.5px] text-zinc-500">
            <span className={cn("h-1.5 w-1.5 rounded-full", coverageDotClass(l.state))} aria-hidden />
            {l.label}
          </span>
        ))}
        <span className="ml-auto font-mono text-[10px] text-zinc-600">
          isiZulu {fullZu}/{I18N_COVERAGE.length} · Afrikaans {fullAf}/{I18N_COVERAGE.length}
        </span>
      </div>
    </div>
  );
}

function AppOfflineSection() {
  const online = usePwaStore((s) => s.online);
  const swPhase = usePwaStore((s) => s.swPhase);
  const swReady = usePwaStore((s) => s.swReady);
  const installable = usePwaStore((s) => s.installable);
  const installed = usePwaStore((s) => s.installed);
  const updateReady = usePwaStore((s) => s.updateReady);

  /* on-device snapshot (IndexedDB) — counts + freshness for the card below */
  const deviceSnapshot = useSasiStore((s) => s.deviceSnapshot);
  const restoredOffline = useSasiStore((s) => s.restoredOffline);
  const refreshDeviceSnapshot = useSasiStore((s) => s.refreshDeviceSnapshot);

  /* iOS Safari offers no beforeinstallprompt — show honest manual steps instead */
  const [isIos] = useState(() => {
    if (typeof navigator === "undefined") return false;
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
  });

  useEffect(() => {
    void refreshDeviceSnapshot();
  }, [refreshDeviceSnapshot]);

  const handleInstall = async () => {
    const outcome = await promptPwaInstall();
    if (outcome === "unavailable") {
      toast("Install is not available right now", {
        description:
          "Your browser did not offer an install prompt. On Android/Chrome use the menu → “Add to Home screen”; on iOS use Share → “Add to Home Screen”.",
      });
    } else if (outcome === "accepted") {
      toast.success("SASI installed", {
        description: "Launch it from your home screen — it opens as its own app.",
      });
    }
  };

  const handleUpdate = () => {
    void applyPwaUpdate();
    toast("Updating…", { description: "Reloading into the new version." });
    setTimeout(() => window.location.reload(), 600);
  };

  const swState =
    swPhase === "unsupported"
      ? "This browser can't keep an offline copy"
      : swPhase === "ready"
        ? "An offline copy of SASI is saved on this device"
        : swPhase === "failed"
          ? "The offline copy could not be saved here"
          : "Preparing the offline copy…";

  return (
    <section aria-labelledby="settings-app" className="space-y-4">
      <div className="sasi-card p-5">
        <SectionLabel>App &amp; offline</SectionLabel>
        <h2 id="settings-app" className="mt-1 flex items-center gap-2 text-[15px] font-semibold text-white">
          <MonitorSmartphone className="h-4 w-4 text-[#e3c567]" aria-hidden />
          SASI as an app
        </h2>
        <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-zinc-400">
          SASI can be installed as its own app and keeps an offline copy of your last session —
          your cases, briefings and the map stay readable with no network. Nothing is ever
          submitted while you are offline.
        </p>

        <div className="mt-4 space-y-2">
          <StatusRow
            icon={CloudOff}
            label={online ? "Connection" : "You are offline"}
            state={
              online
                ? "Live — everything syncs as usual"
                : "Browsing cached data. Reports, chats and briefings wait for the network."
            }
            tone={online ? "muted" : "warn"}
            action={
              <span
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
                  online
                    ? "border-white/8 bg-white/[0.03] text-zinc-500"
                    : "border-[#ffa726]/25 bg-[#ffa726]/[0.07] text-[#ffcc80]"
                )}
              >
                <span
                  className={cn("h-1.5 w-1.5 rounded-full", online ? "bg-[#66bb6a]" : "sasi-breathe bg-[#ffa726]")}
                  aria-hidden
                />
                {online ? "Online" : "Offline"}
              </span>
            }
          />
          <StatusRow icon={Smartphone} label="Installed as an app" state={installed ? "Running from your home screen" : "Runs in the browser tab"} tone={installed ? "good" : "muted"} />
          <StatusRow
            icon={Database}
            label="Offline copy (service worker)"
            state={swState}
            tone={swReady ? "good" : swPhase === "failed" || swPhase === "unsupported" ? "muted" : "warn"}
          />
          {installable && !installed && (
            <StatusRow
              icon={Download}
              label="Install SASI"
              state="Your browser can install SASI as a standalone app"
              tone="warn"
              action={
                <PrimaryButton onClick={() => void handleInstall()} className="h-8 shrink-0 px-3 text-[12px]" aria-label="Install SASI as an app">
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Install
                </PrimaryButton>
              }
            />
          )}
          {updateReady && (
            <StatusRow
              icon={RefreshCw}
              label="Update ready"
              state="A new version finished downloading in the background"
              tone="warn"
              action={
                <PrimaryButton onClick={handleUpdate} className="h-8 shrink-0 px-3 text-[12px]" aria-label="Reload to update SASI">
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Reload
                </PrimaryButton>
              }
            />
          )}
          {isIos && !installed && !installable && (
            <StatusRow
              icon={Smartphone}
              label="iPhone / iPad install"
              state="Safari on iOS installs via the Share menu — see the steps below"
              tone="muted"
            />
          )}
        </div>
      </div>

      {isIos && !installed && (
        <div className="sasi-card p-5">
          <p className="flex items-center gap-2 text-[13px] font-medium text-zinc-200">
            <Smartphone className="h-3.5 w-3.5 text-[#e3c567]" aria-hidden />
            Install on iPhone or iPad
          </p>
          <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-zinc-400">
            Apple does not let Safari show a one-tap install prompt, so this is the
            honest two-step way — it takes about ten seconds:
          </p>
          <ol className="mt-3 space-y-2 text-[12.5px] text-zinc-300">
            <li className="sasi-ios-step flex items-start gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[#e3c567]/25 bg-[#e3c567]/[0.08] text-[11px] font-semibold text-[#e3c567]" aria-hidden>1</span>
              Open this page in Safari and tap the <strong className="font-medium text-white">Share</strong> icon (the square with the arrow).
            </li>
            <li className="sasi-ios-step flex items-start gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-[#e3c567]/25 bg-[#e3c567]/[0.08] text-[11px] font-semibold text-[#e3c567]" aria-hidden>2</span>
              Choose <strong className="font-medium text-white">Add to Home Screen</strong>, then tap Add — SASI opens full-screen from your home screen from then on.
            </li>
          </ol>
        </div>
      )}

      <div className="sasi-card p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[13px] font-medium text-zinc-200">
              <HardDrive className="h-3.5 w-3.5 text-[#e3c567]" aria-hidden />
              On this device
            </p>
            <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-zinc-400">
              SASI keeps a private snapshot of your data in this browser (IndexedDB) so an
              offline reload still shows your work. It never leaves this device — when the
              network returns, the server copy takes over again.
            </p>
          </div>
          <GhostButton
            onClick={() => void refreshDeviceSnapshot()}
            className="h-8 shrink-0 px-2.5 text-[11.5px]"
            aria-label="Refresh device snapshot counts"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Refresh
          </GhostButton>
        </div>

        {deviceSnapshot && (deviceSnapshot.cases > 0 || deviceSnapshot.chat > 0 || deviceSnapshot.notifications > 0 || deviceSnapshot.evidence > 0 || deviceSnapshot.briefing) ? (
          <>
            <div className="sasi-snapshot-grid mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <SnapshotTile label="Your reports" value={deviceSnapshot.cases} />
              <SnapshotTile label="Chat messages" value={deviceSnapshot.chat} />
              <SnapshotTile label="Notifications" value={deviceSnapshot.notifications} />
              <SnapshotTile label="Evidence items" value={deviceSnapshot.evidence} />
              <SnapshotTile label="City briefing" value={deviceSnapshot.briefing ? 1 : 0} unit={deviceSnapshot.briefing ? "cached" : "—"} />
            </div>
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-zinc-500">
              <Database className="h-3 w-3" aria-hidden />
              {deviceSnapshot.savedAt
                ? `Snapshot last written ${timeAgo(deviceSnapshot.savedAt)}`
                : "Snapshot not written yet"}
            </p>
            {restoredOffline && (
              <p className="sasi-restored-note mt-2 rounded-lg border border-[#ffa726]/20 bg-[#ffa726]/[0.05] py-2 pl-4 pr-3 text-[12px] leading-relaxed text-[#ffcc80]">
                This visit started offline — the counts above were restored from this device,
                not from the network. Everything syncs again on the next visit with a connection.
              </p>
            )}
          </>
        ) : (
          <p className="mt-3 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2.5 text-[12px] leading-relaxed text-zinc-500">
            Nothing saved yet — report an issue or ask SASI something, and your data will
            start saving here (it stays even when you reload with no network).
          </p>
        )}
      </div>

      <div className="sasi-card p-5">
        <p className="flex items-center gap-2 text-[13px] font-medium text-zinc-200">
          <Info className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
          What works offline — and what waits
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-[#66bb6a]/15 bg-[#66bb6a]/[0.04] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#a5d6a7]">Works offline</p>
            <ul className="mt-1.5 space-y-1 text-[12px] leading-relaxed text-zinc-400">
              <li>· Reading your cases, evidence and past briefings</li>
              <li>· The map, incidents and everything already loaded</li>
              <li>· Your notifications, settings and saved location</li>
            </ul>
          </div>
          <div className="rounded-lg border border-[#ffa726]/15 bg-[#ffa726]/[0.04] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#ffcc80]">Needs a connection</p>
            <ul className="mt-1.5 space-y-1 text-[12px] leading-relaxed text-zinc-400">
              <li>· Asking SASI or writing a new briefing (AI needs the network)</li>
              <li>· Submitting reports and approving actions</li>
              <li>· Fresh incident data — everything resumes when you reconnect</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}


function ToggleRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled = false,
  tag,
  subNote,
  icon: Icon,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  tag?: string;
  subNote?: string;
  /** optional identity glyph shown in a quiet tile beside the label */
  icon?: typeof Bell;
}) {
  /* confirm-flash: the row breathes gold once whenever the user flips it */
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    []
  );
  const handleChange = (v: boolean) => {
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 700);
    onCheckedChange(v);
  };

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 rounded-lg border border-white/5 bg-white/[0.015] p-3.5 transition-colors hover:border-white/10 hover:bg-white/[0.025]",
        flash && "sasi-pref-flash"
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon && (
          <span
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
              checked
                ? "border-[#e3c567]/25 bg-[#e3c567]/[0.08] text-[#e3c567]"
                : "border-white/8 bg-white/[0.03] text-zinc-600"
            )}
            aria-hidden
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-zinc-100">
            {title}
            {tag && <DemoBadge label={tag} />}
          </p>
          {description && (
            <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">{description}</p>
          )}
          {subNote && (
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">{subNote}</p>
          )}
        </div>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={handleChange}
        disabled={disabled}
        aria-label={title}
        className="mt-0.5 data-[state=checked]:bg-white data-[state=unchecked]:bg-white/15 data-[state=checked]:text-black"
      />
    </div>
  );
}

export default function SettingsView() {
  const savedLocation = useSasiStore((s) => s.savedLocation);
  const setSavedLocation = useSasiStore((s) => s.setSavedLocation);
  const cases = useSasiStore((s) => s.cases);
  const evidence = useSasiStore((s) => s.evidence);
  const t = useT();
  const navigate = useSasiStore((s) => s.navigate);

  /* the active section lives in the store so the command palette
     (and future deep links) can land on a specific section —
     derived directly from the store, so any surface that writes
     settingsSection re-renders this view with no effect needed */
  const storeSection = useSasiStore((s) => s.settingsSection);
  const active = (
    NAV.some((n) => n.id === storeSection) ? storeSection : "account"
  ) as SectionId;
  const setActive = (id: SectionId) => {
    useSasiStore.setState({ settingsSection: id });
  };


  /* --- privacy --- */
  const [storeEvidence, setStoreEvidence] = useState(true);
  const [shareAnonymized, setShareAnonymized] = useState(false);
  const [exportNote, setExportNote] = useState(false);

  /* --- notifications (REAL prefs — gated in store.pushNotification) --- */
  const ntfPrefs = useSasiStore((s) => s.ntfPrefs);
  const setNtfPref = useSasiStore((s) => s.setNtfPref);
  const ntfOnCount = Object.values(ntfPrefs).filter(Boolean).length;

  /* --- location --- */
  const [municipality, setMunicipality] = useState(DEMO_USER.location.municipality);
  const [city, setCity] = useState(savedLocation.city);

  /* --- language (real i18n — see lib/sasi/i18n.ts) --- */
  const lang = useSasiStore((s) => s.lang);
  const setLang = useSasiStore((s) => s.setLang);

  /* --- accessibility --- */
  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [sizeIndex, setSizeIndex] = useState(2);

  /* --- ai permissions --- */
  const [aiPrepare, setAiPrepare] = useState(true);
  const [aiMonitor, setAiMonitor] = useState(true);
  const [aiShareEvidence, setAiShareEvidence] = useState(true);

  /* --- data --- */
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const applyTextSize = (idx: number) => {
    const clamped = Math.max(0, Math.min(TEXT_SIZES.length - 1, idx));
    setSizeIndex(clamped);
    document.documentElement.style.fontSize = `${TEXT_SIZES[clamped]}px`;
  };

  const toggleReduceMotion = (v: boolean) => {
    setReduceMotion(v);
    document.documentElement.classList.toggle("sasi-reduce-motion", v);
  };

  const toggleHighContrast = (v: boolean) => {
    setHighContrast(v);
    document.documentElement.classList.toggle("sasi-hc", v);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight text-white">Settings</h1>
        <p className="mt-1 text-[13px] text-zinc-500">
          Preferences for your SASI account. Everything here is local to the demo.
        </p>
      </header>

      <div className="flex flex-col gap-6 md:flex-row">
        {/* ---------- Nav: desktop ---------- */}
        <nav aria-label="Settings sections" className="hidden md:block md:w-56 md:shrink-0">
          <ul className="sticky top-6 space-y-1">
            {NAV.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => setActive(item.id)}
                  aria-current={active === item.id ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors",
                    active === item.id
                      ? "bg-white/[0.06] font-medium text-white"
                      : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" aria-hidden />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* ---------- Nav: mobile chips ---------- */}
        <nav
          aria-label="Settings sections"
          className="sasi-scroll -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:hidden"
        >
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              aria-current={active === item.id ? "page" : undefined}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] transition-colors",
                active === item.id
                  ? "border-white/25 bg-white/[0.08] font-medium text-white"
                  : "border-white/10 bg-white/[0.02] text-zinc-400"
              )}
            >
              <item.icon className="h-3.5 w-3.5" aria-hidden />
              {item.label}
            </button>
          ))}
        </nav>

        {/* ---------- Content ---------- */}
        <div className="min-w-0 flex-1 space-y-4">
        {active === "account" && (
          <section aria-labelledby="settings-account" className="sasi-card p-5">
            <SectionLabel>Account</SectionLabel>
            <h2 id="settings-account" className="mt-1 text-[15px] font-semibold text-white">Your account</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="account-name" className="mb-1.5 block text-[12px] font-medium text-zinc-400">
                  Full name
                </label>
                <Input id="account-name" value={DEMO_USER.name} readOnly disabled aria-readonly="true" className="text-[13px]" />
              </div>
              <div>
                <label htmlFor="account-email" className="mb-1.5 block text-[12px] font-medium text-zinc-400">
                  Email
                </label>
                <Input id="account-email" type="email" value={DEMO_USER.email} readOnly disabled aria-readonly="true" className="text-[13px]" />
              </div>
            </div>
            <p className="mt-4 flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] p-3 text-[12px] text-zinc-400">
              <Info className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
              Demo account — editing is disabled in demo.
            </p>
          </section>
        )}

        {active === "privacy" && (
          <section aria-labelledby="settings-privacy" className="space-y-4">
            <div className="sasi-card p-5">
              <SectionLabel>Privacy</SectionLabel>
              <h2 id="settings-privacy" className="mt-1 text-[15px] font-semibold text-white">What SASI stores</h2>
              <ul className="mt-4 space-y-2.5">
                {[
                  { icon: FileText, label: "Your cases and case history" },
                  { icon: Camera, label: "Evidence you attach — photos, notes, links" },
                  { icon: MapPin, label: "Your saved location, to localise incidents" },
                  { icon: Sparkles, label: "AI memory — context that helps investigations continue" },
                ].map((row) => (
                  <li key={row.label} className="flex items-center gap-2.5 text-[13px] text-zinc-300">
                    <row.icon className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                    {row.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <ToggleRow
                title="Store evidence locally"
                description="Keep photos and notes you attach on this device."
                checked={storeEvidence}
                onCheckedChange={setStoreEvidence}
              />
              <ToggleRow
                title="Share anonymized incident reports"
                description="Contribute your report, stripped of personal details, to community incident data."
                checked={shareAnonymized}
                onCheckedChange={setShareAnonymized}
                disabled
                tag="COMING SOON"
              />
            </div>

            <div className="sasi-card p-5">
              <p className="text-[13px] font-medium text-zinc-100">Export your data</p>
              <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
                Download everything SASI holds about your account.
              </p>
              <GhostButton
                onClick={() => setExportNote(true)}
                className="mt-3"
                aria-label="Export your data"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                Export data
              </GhostButton>
              {exportNote && (
                <p
                  role="status"
                  className="mt-3 flex items-center gap-2 rounded-lg border border-[#e3c567]/20 bg-[#e3c567]/5 p-3 text-[12px] text-[#efe0a8]"
                >
                  <Info className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Data export is coming soon (demo).
                </p>
              )}
            </div>
          </section>
        )}

        {active === "notifications" && (
          <section aria-labelledby="settings-notifications" className="space-y-4">
            <div className="sasi-card p-5">
              <SectionLabel>Notifications</SectionLabel>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <h2 id="settings-notifications" className="text-[15px] font-semibold text-white">What SASI tells you about</h2>
                <span
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/8 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] tracking-[0.08em] text-zinc-400"
                  aria-live="polite"
                >
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      ntfOnCount > 0 ? "sasi-breathe bg-[#e3c567]" : "bg-zinc-600"
                    )}
                    aria-hidden
                  />
                  {ntfOnCount} OF 5 CHANNELS ON
                </span>
              </div>
              <div className="mt-4 space-y-3">
                <ToggleRow
                  icon={FileText}
                  title="Case updates"
                  description="Status changes and new events on your cases."
                  checked={ntfPrefs.case}
                  onCheckedChange={(v) => setNtfPref("case", v)}
                />
                <ToggleRow
                  icon={FolderSearch}
                  title="Investigation findings"
                  description="When the investigation produces a finding or a recommended next step."
                  checked={ntfPrefs.investigation}
                  onCheckedChange={(v) => setNtfPref("investigation", v)}
                />
                <ToggleRow
                  icon={Stamp}
                  title="Action approvals"
                  description="When SASI needs your approval before doing anything on your behalf."
                  checked={ntfPrefs.action}
                  onCheckedChange={(v) => setNtfPref("action", v)}
                  subNote="Recommended: keep on — approvals never fire while this is off."
                />
                <ToggleRow
                  icon={Siren}
                  title="Service alerts"
                  description="Urgent, confirmed incidents near your saved location, batched into one quiet alert."
                  checked={ntfPrefs.service}
                  onCheckedChange={(v) => setNtfPref("service", v)}
                  tag="NEW"
                />
                <ToggleRow
                  icon={Newspaper}
                  title="Briefing digest"
                  description="When today's city briefing (or a chat summary) has been written."
                  checked={ntfPrefs.digest}
                  onCheckedChange={(v) => setNtfPref("digest", v)}
                  subNote="The digest heartbeat — the briefing itself still lands on the dashboard, only the alert is quieted."
                />
              </div>
            </div>
            <p className="flex items-start gap-2 rounded-lg border border-white/8 bg-white/[0.02] p-3.5 text-[12px] leading-relaxed text-zinc-400">
              <Bell className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
              Preferences apply instantly and survive a reload. SASI batches everything and
              only interrupts you for approvals and urgent, confirmed incidents — every family
              above can be quieted without losing the underlying data on the dashboard.
            </p>
          </section>
        )}

        {active === "location" && (
          <section aria-labelledby="settings-location" className="space-y-4">
            <div className="sasi-card p-5">
              <SectionLabel>Location</SectionLabel>
              <h2 id="settings-location" className="mt-1 text-[15px] font-semibold text-white">Saved location</h2>
              <p className="mt-2 flex items-center gap-2 text-[13px] text-zinc-300">
                <MapPin className="h-3.5 w-3.5 text-[#ef5350]" aria-hidden />
                {savedLocation.suburb ? `${savedLocation.suburb}, ` : ""}
                {savedLocation.city}, {savedLocation.province}
              </p>
              <p className="mt-1 text-[12px] text-zinc-600">
                Used to localise incidents and reporting defaults.
              </p>
            </div>

            <div className="sasi-card p-5">
              <p className="text-[13px] font-medium text-zinc-100">Adjust your area</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="loc-province" className="mb-1.5 block text-[12px] font-medium text-zinc-400">
                    Province
                  </label>
                  <Input id="loc-province" value="Gauteng" readOnly disabled className="text-[13px]" />
                </div>
                <div>
                  <label htmlFor="loc-municipality" className="mb-1.5 block text-[12px] font-medium text-zinc-400">
                    Municipality
                  </label>
                  <Select value={municipality} onValueChange={(v) => setMunicipality(v)}>
                    <SelectTrigger id="loc-municipality" className="w-full text-[13px]" aria-label="Municipality">
                      <SelectValue placeholder="Select municipality" />
                    </SelectTrigger>
                    <SelectContent>
                      {GAUTENG_MUNICIPALITIES.map((m) => (
                        <SelectItem key={m} value={m} className="text-[13px]">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="loc-city" className="mb-1.5 block text-[12px] font-medium text-zinc-400">
                    City or town
                  </label>
                  <Input
                    id="loc-city"
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setSavedLocation({ city: e.target.value });
                    }}
                    className="text-[13px]"
                  />
                </div>
              </div>
              <p className="mt-4 text-[12px] text-zinc-600">
                Province is fixed to Gauteng in this demo. Municipality selection is kept for this
                demo session; city changes save to your location immediately.
              </p>
            </div>
          </section>
        )}

        {active === "language" && (
          <section aria-labelledby="settings-language" className="sasi-card p-5">
            <SectionLabel>Language</SectionLabel>
            <h2 id="settings-language" className="mt-1 text-[15px] font-semibold text-white">{t("settings.language.interface")}</h2>
            <div className="mt-4 max-w-sm">
              <label htmlFor="language-select" className="mb-1.5 block text-[12px] font-medium text-zinc-400">
                {t("settings.language.label")}
              </label>
              <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
                <SelectTrigger id="language-select" className="w-full text-[13px]" aria-label="Language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code} className="text-[13px]">
                      {l.label}
                      <span className="ml-1.5 text-[10.5px] text-zinc-600">· {l.note}</span>
                    </SelectItem>
                  ))}
                  {PLANNED_LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code} disabled className="text-[13px]">
                      {l.label} — {t("settings.language.coming")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="mt-3 rounded-lg border border-white/8 bg-white/[0.02] p-3">
                <p className="text-[11.5px] font-medium text-zinc-300">Honest coverage</p>
                <p className="mt-1 text-[12px] leading-relaxed text-zinc-500">
                  Switching is instant — every surface marked green below responds immediately.
                  SASI accepts reports written in any language, and deeper translation is planned.
                </p>
                <CoverageTable />
              </div>
              {lang !== "en" && (
                <button
                  onClick={() => setLang("en")}
                  className="mt-2.5 text-[12px] font-medium text-[#e3c567] transition-colors hover:text-[#f0d98c]"
                >
                  Back to English
                </button>
              )}
            </div>
          </section>
        )}

        {active === "accessibility" && (
          <section aria-labelledby="settings-accessibility" className="space-y-3">
            <div className="sasi-card p-5">
              <SectionLabel>Accessibility</SectionLabel>
              <h2 id="settings-accessibility" className="mt-1 text-[15px] font-semibold text-white">Motion and contrast</h2>
              <div className="mt-4 space-y-3">
                <ToggleRow
                  title="Reduce motion"
                  description="Toggles the sasi-reduce-motion flag on the document. Site animations — pulses, shimmer and transitions — respect this flag, including within this view."
                  checked={reduceMotion}
                  onCheckedChange={toggleReduceMotion}
                />
                <ToggleRow
                  title="High contrast"
                  description="Toggles the sasi-hc flag on the document for stronger text and edge contrast. Full high-contrast styling is coming soon."
                  checked={highContrast}
                  onCheckedChange={toggleHighContrast}
                />
              </div>
            </div>

            <div className="sasi-card p-5">
              <p className="text-[13px] font-medium text-zinc-100">Text size</p>
              <p className="mt-1 text-[12px] text-zinc-500">
                Adjusts the base size for the whole app. Currently {TEXT_SIZES[sizeIndex]}px.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <GhostButton
                  onClick={() => applyTextSize(sizeIndex - 1)}
                  disabled={sizeIndex === 0}
                  className="h-9 w-9 px-0"
                  aria-label="Decrease text size"
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden />
                </GhostButton>
                <span
                  className="min-w-10 text-center font-mono text-[13px] text-zinc-300"
                  aria-live="polite"
                >
                  A
                </span>
                <GhostButton
                  onClick={() => applyTextSize(sizeIndex + 1)}
                  disabled={sizeIndex === TEXT_SIZES.length - 1}
                  className="h-9 w-9 px-0"
                  aria-label="Increase text size"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                </GhostButton>
                <span className="ml-1 text-[11px] text-zinc-600">
                  A- / A+ · 14–18px base size
                </span>
              </div>
            </div>
          </section>
        )}

        {active === "ai" && (
          <section aria-labelledby="settings-ai" className="space-y-4">
            <div className="sasi-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <SectionLabel>AI permissions</SectionLabel>
                  <h2 id="settings-ai" className="mt-1 text-[15px] font-semibold text-white">What SASI may do</h2>
                </div>
                <DemoBadge label="DEMO SETTINGS" />
              </div>

              <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-lg border border-[#66bb6a]/15 bg-[#66bb6a]/[0.03] p-4">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#8ee09a]">
                    What SASI can do without asking
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {[
                      "Understand your reports",
                      "Research public sources",
                      "Organize evidence",
                      "Prepare recommendations",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2.5 text-[13px] text-zinc-200">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#66bb6a]" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-[#e3c567]/15 bg-[#e3c567]/[0.03] p-4">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#efe0a8]">
                    What SASI only does with your explicit approval
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {[
                      "Submit information externally",
                      "Contact an organization",
                      "Share evidence",
                      "Take consequential action",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2.5 text-[13px] text-zinc-200">
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-[#e3c567]" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <ToggleRow
                title="Prepare actions for my review"
                description="SASI drafts submissions and next steps, then waits for you."
                checked={aiPrepare}
                onCheckedChange={setAiPrepare}
              />
              <ToggleRow
                title="Monitor cases every 48h"
                description="Automatic checks for responses and changes related to your open cases."
                checked={aiMonitor}
                onCheckedChange={setAiMonitor}
              />
              <ToggleRow
                title="Share evidence with authorities after I approve"
                description="Evidence you attached is only included in a submission once you have approved that specific action."
                subNote="You can revoke this per case at any time."
                checked={aiShareEvidence}
                onCheckedChange={setAiShareEvidence}
              />
            </div>
          </section>
        )}

        {active === "security" && (
          <section aria-labelledby="settings-security" className="sasi-card p-5">
            <SectionLabel>Security</SectionLabel>
            <h2 id="settings-security" className="mt-1 text-[15px] font-semibold text-white">How SASI protects your account</h2>
            <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-zinc-400">
              SASI never submits anything on your behalf without an explicit approval, keeps
              evidence tied to your account only, and logs every AI action in an audit trail you
              can review.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <GhostButton onClick={() => navigate("security")} aria-label="Read the security overview">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Read the security overview
              </GhostButton>
              <GhostButton onClick={() => navigate("privacy")} aria-label="Read the privacy statement">
                Read the privacy statement
              </GhostButton>
            </div>
          </section>
        )}

        {active === "app" && <AppOfflineSection />}

        {active === "data" && (
          <section aria-labelledby="settings-data" className="space-y-4">
            <div className="sasi-card p-5">
              <SectionLabel>Data</SectionLabel>
              <h2 id="settings-data" className="mt-1 text-[15px] font-semibold text-white">Your data in this demo</h2>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3.5">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Cases</p>
                  <p className="mt-1.5 text-[22px] font-semibold text-white">{cases.length}</p>
                </div>
                <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3.5">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Evidence items</p>
                  <p className="mt-1.5 text-[22px] font-semibold text-white">{evidence.length}</p>
                </div>
                <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3.5">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-zinc-500">Saved location</p>
                  <p className="mt-1.5 text-[13px] font-medium leading-snug text-zinc-200">
                    {locationLabel({ ...savedLocation }, "full")}
                  </p>
                </div>
              </div>
            </div>

            <div className="sasi-card border-[#ef5350]/15 p-5">
              <p className="flex items-center gap-2 text-[13px] font-medium text-[#fda4a0]">
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Danger zone
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-zinc-500">
                Delete all demo data — cases, evidence and AI memory created in this session.
              </p>
              {!confirmDelete ? (
                <GhostButton
                  onClick={() => setConfirmDelete(true)}
                  className="mt-3 hover:border-[#ef5350]/40 hover:text-[#fda4a0]"
                  aria-label="Delete all demo data"
                >
                  Delete all demo data
                </GhostButton>
              ) : (
                <div
                  role="alertdialog"
                  aria-label="Confirm delete all demo data"
                  className="mt-3 rounded-lg border border-[#ef5350]/25 bg-[#ef5350]/5 p-3.5"
                >
                  <p className="text-[12.5px] font-medium text-[#fda4a0]">
                    Are you sure? This clears your demo session data.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <PrimaryButton
                      onClick={() => {
                        setDeleted(true);
                        setConfirmDelete(false);
                      }}
                      className="bg-[#ef5350] text-white hover:bg-[#e57373]"
                    >
                      Yes, delete
                    </PrimaryButton>
                    <GhostButton onClick={() => setConfirmDelete(false)}>Cancel</GhostButton>
                  </div>
                </div>
              )}
              {deleted && (
                <p
                  role="status"
                  className="mt-3 flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] p-3 text-[12px] text-zinc-400"
                >
                  <Info className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
                  Demo data resets when the app reloads.
                </p>
              )}
            </div>
          </section>
        )}
        </div>
      </div>
    </div>
  );
}
