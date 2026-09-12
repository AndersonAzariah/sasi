"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  Bell,
  Bot,
  ChevronDown,
  CircleUser,
  Command as CommandIcon,
  FolderLock,
  Landmark,
  LayoutDashboard,
  Map,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  Siren,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSasiStore } from "@/lib/sasi/store";
import { useT } from "@/lib/sasi/i18n";
import type { View } from "@/lib/sasi/types";
import { SasiLogo } from "./primitives";
import { NotificationRow } from "./domain";

/* Neutral identity fallback — no fabricated persona: the app says "You"
   until the real account name is available. */
function identityInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? "Y"}${parts[1]?.[0] ?? ""}`.toUpperCase();
}

/* ============================================================
   NAV MODEL — labels are i18n keys (see lib/sasi/i18n.ts)
   ============================================================ */

const NAV_SECTIONS: {
  label: string;
  items: { view: View; label: string; icon: typeof Search }[];
}[] = [
  {
    label: "nav.overview",
    items: [
      { view: "dashboard", label: "nav.dashboard", icon: LayoutDashboard },
      { view: "ask-sasi", label: "nav.ask-sasi", icon: Bot },
    ],
  },
  {
    label: "nav.investigate",
    items: [
      { view: "investigate", label: "nav.investigate.item", icon: Sparkles },
      { view: "cases", label: "nav.cases", icon: FolderLock },
      { view: "incidents", label: "nav.incidents", icon: Zap },
      { view: "map", label: "nav.map", icon: Map },
    ],
  },
  {
    label: "nav.evidence",
    items: [
      { view: "evidence", label: "nav.evidence.item", icon: FolderLock },
      { view: "activity", label: "nav.activity", icon: Activity },
    ],
  },
  {
    label: "nav.system",
    items: [
      { view: "notifications", label: "nav.notifications", icon: Bell },
      { view: "emergency", label: "nav.emergency", icon: Siren },
      { view: "settings", label: "nav.settings", icon: Settings },
    ],
  },
];

const SERVICES_SHORTCUT = { view: "services" as View, label: "nav.services", icon: ShieldCheck };
const GOV_SHORTCUT = { view: "gov" as View, label: "nav.government", icon: Landmark };

/* ============================================================
   SIDEBAR COLLAPSE — persists per browser ("get work done"
   muscle memory: once tucked away, it stays tucked away)
   ============================================================ */

const SIDEBAR_COLLAPSED_KEY = "sasi-sidebar-collapsed";

function readSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSidebarCollapsed(collapsed: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* private mode — the choice simply won't persist */
  }
}

/* ============================================================
   RAIL TOOLTIP — glass label rendered through a portal at body
   level, so the nav's overflow-y-auto can never clip it. CSS
   transition (not framer) so reduced-motion handling is trivial.
   ============================================================ */

function useRailTip(collapsed: boolean) {
  const [tip, setTip] = useState<{ open: boolean; rect: DOMRect | null }>({
    open: false,
    rect: null,
  });
  const bind = collapsed
    ? {
        onMouseEnter: (e: React.SyntheticEvent<HTMLElement>) =>
          setTip({ open: true, rect: e.currentTarget.getBoundingClientRect() }),
        onMouseLeave: () => setTip((s) => ({ ...s, open: false })),
        onFocus: (e: React.SyntheticEvent<HTMLElement>) =>
          setTip({ open: true, rect: e.currentTarget.getBoundingClientRect() }),
        onBlur: () => setTip((s) => ({ ...s, open: false })),
      }
    : {};
  return { bind, tip };
}

function RailTip({
  open,
  anchor,
  label,
  badge,
}: {
  open: boolean;
  anchor: DOMRect | null;
  label: string;
  badge?: number;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <span
      role="tooltip"
      aria-hidden={!open}
      className={cn("sasi-rail-tip fixed", open && "sasi-tip-on")}
      style={
        anchor
          ? { left: anchor.right + 10, top: anchor.top + anchor.height / 2 }
          : { left: -9999, top: -9999 }
      }
    >
      {label}
      {badge ? <span className="sasi-tip-badge">{badge}</span> : null}
    </span>,
    document.body
  );
}

/* ============================================================
   SIDEBAR LINK — expands to a labelled row, collapses to a
   centered 44px "lit key" with a glass portal tooltip
   ============================================================ */

function SidebarLink({
  view,
  label,
  icon: Icon,
  active,
  badge,
  collapsed = false,
}: {
  view: View;
  label: string;
  icon: typeof Search;
  active: boolean;
  badge?: number;
  collapsed?: boolean;
}) {
  const navigate = useSasiStore((s) => s.navigate);
  const { bind, tip } = useRailTip(collapsed);
  return (
    <button
      onClick={() => navigate(view)}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      {...bind}
      className={cn(
        "group relative flex w-full items-center rounded-lg text-[13px] transition-colors",
        collapsed ? "mx-auto h-11 w-11 justify-center" : "gap-2.5 px-2.5 py-[7px]",
        active
          ? collapsed
            ? "sasi-sidebar-rail-active text-white"
            : "bg-white/[0.05] text-white"
          : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200"
      )}
    >
      {!collapsed && (
        <span
          className={cn(
            "absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full transition-all",
            active
              ? "bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.25)]"
              : "bg-transparent"
          )}
        />
      )}
      <Icon
        className={cn(
          "h-[15px] w-[15px] shrink-0 transition-colors",
          active ? "text-white" : "text-zinc-600 group-hover:text-zinc-300"
        )}
        aria-hidden
      />
      {!collapsed && <span className="flex-1 text-left">{label}</span>}
      {!collapsed && badge ? (
        <span className="rounded-full bg-white/8 px-1.5 py-px font-mono text-[9.5px] text-zinc-300">
          {badge}
        </span>
      ) : null}
      {collapsed && badge ? (
        <span
          className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#e3c567] shadow-[0_0_6px_1px_rgba(227,197,103,0.5)]"
          aria-label={`${badge} unread`}
        />
      ) : null}
      {collapsed && <RailTip open={tip.open} anchor={tip.rect} label={label} badge={badge} />}
    </button>
  );
}

function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const view = useSasiStore((s) => s.view);
  const notifications = useSasiStore((s) => s.notifications);
  const navigate = useSasiStore((s) => s.navigate);
  const t = useT();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col lg:flex",
        "transition-[width] duration-300 ease-in-out motion-reduce:transition-none",
        collapsed
          ? "sasi-sidebar-rail w-[64px]"
          : "w-[228px] border-r border-white/6 bg-[#080808]"
      )}
    >
      {/* header — brand when open, brand mark when a rail; toggle sits in
          the footer while collapsed so the mark owns the top slot */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center",
          collapsed ? "justify-center" : "justify-between px-4"
        )}
      >
        {collapsed ? (
          <button
            onClick={() => navigate("landing")}
            aria-label="SASI home"
            className="group flex h-11 w-11 items-center justify-center rounded-xl transition hover:bg-white/[0.05]"
          >
            <SasiLogo size={28} withWordmark={false} />
          </button>
        ) : (
          <button
            onClick={() => navigate("landing")}
            aria-label="SASI home"
            className="rounded-md"
          >
            <SasiLogo size={26} />
          </button>
        )}
        {!collapsed && (
          <button
            onClick={onToggle}
            aria-label="Collapse sidebar"
            aria-expanded={!collapsed}
            title="Collapse sidebar"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-white"
          >
            <PanelLeftClose className="h-[17px] w-[17px]" aria-hidden />
          </button>
        )}
      </div>

      <nav
        className={cn(
          "sasi-scroll flex-1 overflow-y-auto pb-4",
          collapsed ? "space-y-4 px-2" : "space-y-5 px-3"
        )}
        aria-label="Primary"
      >
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {collapsed ? (
              <div className="sasi-sidebar-rail-divider mx-auto mb-2" aria-hidden />
            ) : (
              <p className="mb-1.5 px-2.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-zinc-700">
                {t(section.label)}
              </p>
            )}
            <div className="space-y-px">
              {section.items.map((item) => (
                <SidebarLink
                  key={item.view}
                  {...item}
                  label={t(item.label)}
                  active={view === item.view}
                  badge={item.view === "notifications" ? unread : undefined}
                  collapsed={collapsed}
                />
              ))}
            </div>
          </div>
        ))}
        <div>
          {collapsed ? (
            <div className="sasi-sidebar-rail-divider mx-auto mb-2" aria-hidden />
          ) : (
            <p className="mb-1.5 px-2.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-zinc-700">
              {t("nav.services")}
            </p>
          )}
          <SidebarLink
            {...SERVICES_SHORTCUT}
            label={t(SERVICES_SHORTCUT.label)}
            active={view === "services" || view === "service-detail"}
            collapsed={collapsed}
          />
          <SidebarLink
            {...GOV_SHORTCUT}
            label={t(GOV_SHORTCUT.label)}
            active={view === "gov"}
            collapsed={collapsed}
          />
        </div>
      </nav>

      <div className={cn("shrink-0", collapsed ? "border-t border-transparent p-2" : "border-t border-white/6 p-3")}>
        {collapsed && (
          <RailToggleButton collapsed onToggle={onToggle} />
        )}
        <ProfileButton collapsed={collapsed} active={view === "profile"} />
        <AdminButton collapsed={collapsed} active={view === "admin"} label={t("nav.admin")} />
      </div>
    </aside>
  );
}

/* ---------- footer pieces (rail tooltips + collapsed variants) ---------- */

function RailToggleButton({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { bind, tip } = useRailTip(collapsed);
  return (
    <button
      onClick={onToggle}
      aria-label="Expand sidebar"
      aria-expanded={!collapsed}
      {...bind}
      className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.05] hover:text-white"
    >
      <PanelLeftOpen className="h-[18px] w-[18px]" aria-hidden />
      {collapsed && <RailTip open={tip.open} anchor={tip.rect} label="Expand sidebar" />}
    </button>
  );
}

function ProfileButton({ collapsed, active }: { collapsed: boolean; active: boolean }) {
  const navigate = useSasiStore((s) => s.navigate);
  const accountName = useSasiStore((s) => s.accountName);
  const savedLocation = useSasiStore((s) => s.savedLocation);
  const { bind, tip } = useRailTip(collapsed);
  const displayName = accountName?.trim() || "You";
  const initials = identityInitials(displayName);
  return (
    <button
      onClick={() => navigate("profile")}
      aria-label={collapsed ? `Profile — ${displayName}` : undefined}
      {...bind}
      className={cn(
        "flex w-full items-center rounded-lg text-left transition-colors",
        collapsed ? "h-11 justify-center" : "gap-2.5 px-2 py-2",
        active ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[10.5px] font-semibold text-zinc-300">
        {initials}
      </span>
      {!collapsed && (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium text-zinc-200">
            {displayName}
          </span>
          <span className="block truncate text-[10.5px] text-zinc-600">
            {savedLocation.city}
          </span>
        </span>
      )}
      {!collapsed && <CircleUser className="h-4 w-4 text-zinc-700" aria-hidden />}
      {collapsed && <RailTip open={tip.open} anchor={tip.rect} label={displayName} />}
    </button>
  );
}

function AdminButton({
  collapsed,
  active,
  label,
}: {
  collapsed: boolean;
  active: boolean;
  label: string;
}) {
  const navigate = useSasiStore((s) => s.navigate);
  const { bind, tip } = useRailTip(collapsed);
  return (
    <button
      onClick={() => navigate("admin")}
      aria-label={collapsed ? label : undefined}
      {...bind}
      className={cn(
        "flex w-full items-center rounded-lg transition-colors",
        collapsed
          ? "mx-auto h-11 w-11 justify-center text-zinc-600 hover:bg-white/[0.04] hover:text-zinc-300"
          : "mt-1 gap-2 px-2 py-1.5 text-[11.5px]",
        !collapsed && (active ? "text-zinc-200" : "text-zinc-600 hover:text-zinc-400")
      )}
    >
      <Settings className={cn("shrink-0", collapsed ? "h-4 w-4" : "h-3.5 w-3.5")} aria-hidden />
      {!collapsed && label}
      {collapsed && <RailTip open={tip.open} anchor={tip.rect} label={label} />}
    </button>
  );
}

/* ============================================================
   KEYBOARD NAV (Task 23) — ⌘K palette + "g" prefix jumps + "?"
   help overlay. Skips while typing in any field.
   ============================================================ */

const G_KEYS: Record<string, View> = {
  d: "dashboard",
  c: "cases",
  m: "map",
  i: "investigate",
  e: "evidence",
  a: "ask-sasi",
  n: "notifications",
  s: "settings",
  h: "landing",
  r: "report",
};

const SHORTCUT_ROWS: { keys: string; action: string }[] = [
  { keys: "⌘K / Ctrl K", action: "Command palette" },
  { keys: "G then D", action: "Dashboard" },
  { keys: "G then C", action: "Cases" },
  { keys: "G then M", action: "Map" },
  { keys: "G then I", action: "Investigation workspace" },
  { keys: "G then E", action: "Evidence vault" },
  { keys: "G then A", action: "Ask SASI" },
  { keys: "G then R", action: "File a report" },
  { keys: "G then N", action: "Notifications" },
  { keys: "G then S", action: "Settings" },
  { keys: "G then H", action: "SASI home" },
  { keys: "?", action: "This shortcut sheet" },
  { keys: "Esc", action: "Close panels and overlays" },
];

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.isContentEditable
  );
}

function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
    >
      <div
        className="sasi-card sasi-pop w-full max-w-md overflow-hidden bg-[#0b0b0c] shadow-2xl shadow-black/70"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/6 px-5 py-3.5">
          <p className="text-[13px] font-semibold tracking-wide text-white">
            KEYBOARD SHORTCUTS
          </p>
          <button
            onClick={onClose}
            aria-label="Close shortcuts"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-white/[0.05] hover:text-white"
          >
            <PanelLeftClose className="h-4 w-4 rotate-90" aria-hidden />
          </button>
        </div>
        <div className="sasi-scroll max-h-[60vh] overflow-y-auto px-5 py-3">
          {SHORTCUT_ROWS.map((row) => (
            <div
              key={row.keys}
              className="flex items-center justify-between gap-4 border-b border-white/[0.04] py-2 last:border-0"
            >
              <span className="text-[12.5px] text-zinc-300">{row.action}</span>
              <kbd className="shrink-0 rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10.5px] text-zinc-400">
                {row.keys}
              </kbd>
            </div>
          ))}
        </div>
        <p className="border-t border-white/6 px-5 py-2.5 text-[10.5px] text-zinc-600">
          Works everywhere except while typing in a field.
        </p>
      </div>
    </div>
  );
}

/* ============================================================
   TOPBAR
   ============================================================ */

function Topbar() {
  const navigate = useSasiStore((s) => s.navigate);
  const setCommandOpen = useSasiStore((s) => s.setCommandOpen);
  const savedLocation = useSasiStore((s) => s.savedLocation);
  const accountName = useSasiStore((s) => s.accountName);
  const [ntfOpen, setNtfOpen] = useState(false);
  const notifications = useSasiStore((s) => s.notifications);
  const markAll = useSasiStore((s) => s.markAllNotificationsRead);
  const t = useT();
  const unread = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  return (
    <header className="sticky top-0 z-30 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-center gap-3 border-b border-white/6 bg-[#050505]/85 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md lg:px-6">
      {/* mobile logo */}
      <button className="lg:hidden" onClick={() => navigate("landing")} aria-label="SASI home">
        <SasiLogo size={24} withWordmark={false} />
      </button>

      {/* command trigger (desktop renders fake input, mobile icon) */}
      <button
        onClick={() => setCommandOpen(true)}
        className="sasi-command-focus group mx-auto hidden h-9 w-full max-w-xl items-center gap-2.5 rounded-lg border border-white/8 bg-white/[0.03] px-3 text-left transition hover:border-white/15 md:flex"
        aria-label="Open command palette"
      >
        <Search className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
        <span className="flex-1 truncate text-[13px] text-zinc-500">
          {t("shell.search")}
        </span>
        <kbd className="hidden items-center gap-0.5 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9.5px] text-zinc-500 lg:flex">
          <CommandIcon className="h-2.5 w-2.5" />K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5 md:ml-0">
        {/* mobile command-palette access — the palette was desktop-only before Task 23 */
        }
        <button
          onClick={() => setCommandOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/[0.04] hover:text-white md:hidden"
          aria-label="Search and commands"
        >
          <Search className="h-[17px] w-[17px]" />
        </button>

        <button
          onClick={() => navigate("ask-sasi")}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/[0.04] hover:text-white md:hidden"
          aria-label="Ask SASI"
        >
          <Sparkles className="h-[17px] w-[17px]" />
        </button>

        <button
          className="hidden h-9 items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 text-[12px] text-zinc-400 transition hover:border-white/15 hover:text-zinc-200 xl:flex"
          aria-label={t("shell.saved-location")}
          onClick={() => navigate("settings")}
        >
          <Map className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
          {savedLocation.city}, {savedLocation.province}
          <ChevronDown className="h-3 w-3 text-zinc-600" aria-hidden />
        </button>

        <div className="relative">
          <button
            onClick={() => setNtfOpen((o) => !o)}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/[0.04] hover:text-white lg:h-9 lg:w-9"
            aria-label={`${t("shell.notifications")}${unread ? ` (${unread} unread)` : ""}`}
            aria-expanded={ntfOpen}
          >
            <Bell className="h-[17px] w-[17px]" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[#c62828] px-0.5 text-[8.5px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>

          {ntfOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setNtfOpen(false)}
                aria-hidden
              />
              <div
                role="dialog"
                aria-label={t("shell.notifications")}
                className="sasi-card sasi-pop absolute right-0 top-11 z-50 w-[min(92vw,380px)] overflow-hidden bg-[#0d0e10] shadow-2xl shadow-black/60"
              >
                <div className="flex items-center justify-between border-b border-white/6 px-3 py-2.5">
                  <p className="text-[12.5px] font-semibold text-white">{t("shell.notifications")}</p>
                  <button
                    onClick={() => { markAll(); }}
                    className="text-[11.5px] text-zinc-500 transition hover:text-white"
                  >
                    {t("shell.mark-all-read")}
                  </button>
                </div>
                <div className="sasi-scroll max-h-[380px] divide-y divide-white/[0.04] overflow-y-auto">
                  {notifications.slice(0, 6).map((n) => (
                    <NotificationRow
                      key={n.id}
                      n={n}
                      onOpen={() => {
                        setNtfOpen(false);
                        navigate("notifications");
                      }}
                    />
                  ))}
                </div>
                <button
                  onClick={() => {
                    setNtfOpen(false);
                    navigate("notifications");
                  }}
                  className="block w-full border-t border-white/6 py-2.5 text-center text-[12px] text-zinc-500 transition hover:text-white"
                >
                  {t("shell.view-all-notifications")}
                </button>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => navigate("profile")}
          className="ml-1 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[11px] font-semibold text-zinc-300 transition hover:border-white/25 lg:h-8 lg:w-8 lg:text-[10.5px]"
          aria-label="Profile"
        >
          {identityInitials(accountName?.trim() || "You")}
        </button>
      </div>
    </header>
  );
}

/* ============================================================
   MOBILE BOTTOM NAV
   ============================================================ */

const MOBILE_NAV: { view: View; label: string; icon: typeof Search }[] = [
  { view: "dashboard", label: "nav.home", icon: LayoutDashboard },
  { view: "investigate", label: "nav.investigate.item", icon: Sparkles },
  { view: "cases", label: "nav.cases", icon: FolderLock },
  { view: "map", label: "nav.map", icon: Map },
  { view: "profile", label: "nav.profile", icon: CircleUser },
];

function MobileNav() {
  const view = useSasiStore((s) => s.view);
  const navigate = useSasiStore((s) => s.navigate);
  const t = useT();
  return (
    <nav
      className="sasi-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-[#070708]/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-5">
        {MOBILE_NAV.map((item) => {
          const active =
            view === item.view ||
            (item.view === "cases" && view === "case-detail") ||
            (item.view === "map" && view === "incident-detail");
          return (
            <button
              key={item.view}
              onClick={() => navigate(item.view)}
              className="sasi-bottom-nav-btn relative flex min-h-[56px] flex-col items-center justify-center gap-1 px-1 py-2.5 transition-transform active:scale-95"
              aria-current={active ? "page" : undefined}
            >
              <span
                className={cn(
                  "absolute top-0 h-[2px] w-8 rounded-b",
                  active
                    ? "bg-white shadow-[0_0_10px_1px_rgba(255,255,255,0.35)]"
                    : "bg-transparent"
                )}
              />
              <item.icon
                className={cn(
                  "h-[21px] w-[21px]",
                  active ? "text-white" : "text-zinc-600"
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "text-[10px] font-semibold sasi-bottom-nav-label",
                  active ? "text-white" : "text-zinc-600"
                )}
              >
                {t(item.label)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ============================================================
   FLOATING ASK BUTTON (mobile)
   ============================================================ */

function FloatingAskButton() {
  const navigate = useSasiStore((s) => s.navigate);
  const view = useSasiStore((s) => s.view);
  const t = useT();
  if (view === "ask-sasi") return null;
  return (
    <button
      onClick={() => navigate("ask-sasi")}
      className="sasi-glow-multi fixed bottom-[calc(72px+env(safe-area-inset-bottom))] right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-white pl-3.5 pr-4 text-[13px] font-semibold text-black transition-transform active:scale-95 lg:hidden"
      aria-label={t("shell.floating-ask")}
    >
      <Sparkles className="h-4 w-4" aria-hidden />
      {t("shell.floating-ask")}
    </button>
  );
}

/* ============================================================
   SHELL
   ============================================================ */

export function AppShell({ children }: { children: React.ReactNode }) {
  const setCommandOpen = useSasiStore((s) => s.setCommandOpen);
  const navigate = useSasiStore((s) => s.navigate);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarCollapsed);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const gArmedAt = useRef(0);
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    writeSidebarCollapsed(sidebarCollapsed);
  }, [sidebarCollapsed]);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((c) => !c);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShortcutsOpen(false);
        setCommandOpen(true);
        return;
      }
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
        return;
      }
      if (e.key === "Escape") {
        setShortcutsOpen(false);
        return;
      }
      /* "g" prefix jumps: G D → dashboard, G C → cases, … (1.2s window) */
      const key = e.key.toLowerCase();
      if (key === "g") {
        gArmedAt.current = Date.now();
        return;
      }
      if (gArmedAt.current && Date.now() - gArmedAt.current < 1200) {
        gArmedAt.current = 0;
        const target = G_KEYS[key];
        if (target) {
          e.preventDefault();
          setShortcutsOpen(false);
          navigate(target);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen, navigate]);

  return (
    <div className="min-h-screen bg-[#050505]">
      <Sidebar collapsed={sidebarCollapsed} onToggle={toggleSidebar} />
      <div
        className={cn(
          "transition-[padding] duration-300 ease-in-out motion-reduce:transition-none",
          sidebarCollapsed ? "lg:pl-[64px]" : "lg:pl-[228px]"
        )}
      >
        <Topbar />
        <main className="sasi-shell-main min-h-[calc(100vh-3.5rem)] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-8">
          {children}
        </main>
      </div>
      <MobileNav />
      <FloatingAskButton />
      {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}
    </div>
  );
}
