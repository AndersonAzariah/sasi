"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  Activity,
  Bell,
  Bot,
  ChevronDown,
  CircleUser,
  Command as CommandIcon,
  FolderLock,
  LayoutDashboard,
  Map,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSasiStore } from "@/lib/sasi/store";
import { DEMO_USER } from "@/lib/sasi/data";
import type { View } from "@/lib/sasi/types";
import { SasiLogo } from "./primitives";
import { NotificationRow } from "./domain";

/* ============================================================
   NAV MODEL
   ============================================================ */

const NAV_SECTIONS: {
  label: string;
  items: { view: View; label: string; icon: typeof Search }[];
}[] = [
  {
    label: "Overview",
    items: [
      { view: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { view: "ask-sasi", label: "Ask SASI", icon: Bot },
    ],
  },
  {
    label: "Investigate",
    items: [
      { view: "investigate", label: "Investigate", icon: Sparkles },
      { view: "cases", label: "Cases", icon: FolderLock },
      { view: "incidents", label: "Incidents", icon: Zap },
      { view: "map", label: "Map", icon: Map },
    ],
  },
  {
    label: "Evidence",
    items: [
      { view: "evidence", label: "Evidence", icon: FolderLock },
      { view: "activity", label: "Activity", icon: Activity },
    ],
  },
  {
    label: "System",
    items: [
      { view: "notifications", label: "Notifications", icon: Bell },
      { view: "settings", label: "Settings", icon: Settings },
    ],
  },
];

const SERVICES_SHORTCUT = { view: "services" as View, label: "Services", icon: ShieldCheck };

/* ============================================================
   SIDEBAR
   ============================================================ */

function SidebarLink({
  view,
  label,
  icon: Icon,
  active,
  badge,
}: {
  view: View;
  label: string;
  icon: typeof Search;
  active: boolean;
  badge?: number;
}) {
  const navigate = useSasiStore((s) => s.navigate);
  return (
    <button
      onClick={() => navigate(view)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors",
        active
          ? "bg-white/[0.05] text-white"
          : "text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-200"
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full transition-all",
          active
            ? "bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.25)]"
            : "bg-transparent"
        )}
      />
      <Icon
        className={cn(
          "h-[15px] w-[15px] shrink-0",
          active ? "text-white" : "text-zinc-600 group-hover:text-zinc-400"
        )}
        aria-hidden
      />
      <span className="flex-1 text-left">{label}</span>
      {badge ? (
        <span className="rounded-full bg-white/8 px-1.5 py-px font-mono text-[9.5px] text-zinc-300">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function Sidebar() {
  const view = useSasiStore((s) => s.view);
  const notifications = useSasiStore((s) => s.notifications);
  const navigate = useSasiStore((s) => s.navigate);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[228px] flex-col border-r border-white/6 bg-[#080808] lg:flex">
      <div className="flex h-14 items-center px-4">
        <button onClick={() => navigate("landing")} aria-label="SASI home">
          <SasiLogo size={26} />
        </button>
      </div>

      <nav className="sasi-scroll flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Primary">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="mb-1.5 px-2.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-zinc-700">
              {section.label}
            </p>
            <div className="space-y-px">
              {section.items.map((item) => (
                <SidebarLink
                  key={item.view}
                  {...item}
                  active={view === item.view}
                  badge={item.view === "notifications" ? unread : undefined}
                />
              ))}
            </div>
          </div>
        ))}
        <div>
          <p className="mb-1.5 px-2.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-zinc-700">
            Services
          </p>
          <SidebarLink
            {...SERVICES_SHORTCUT}
            active={view === "services" || view === "service-detail"}
          />
        </div>
      </nav>

      <div className="border-t border-white/6 p-3">
        <button
          onClick={() => navigate("profile")}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
            view === "profile" ? "bg-white/[0.05]" : "hover:bg-white/[0.03]"
          )}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[10.5px] font-semibold text-zinc-300">
            {DEMO_USER.firstName[0]}
            {DEMO_USER.name.split(" ")[1]?.[0]}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium text-zinc-200">
              {DEMO_USER.name}
            </span>
            <span className="block truncate text-[10.5px] text-zinc-600">
              {DEMO_USER.location.city} · Demo account
            </span>
          </span>
          <CircleUser className="h-4 w-4 text-zinc-700" aria-hidden />
        </button>
        <button
          onClick={() => navigate("admin")}
          className={cn(
            "mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11.5px] transition-colors",
            view === "admin" ? "text-zinc-200" : "text-zinc-600 hover:text-zinc-400"
          )}
        >
          <Settings className="h-3.5 w-3.5" aria-hidden />
          Admin foundation
          <span className="ml-auto rounded border border-white/8 px-1 py-px font-mono text-[8.5px] tracking-widest text-zinc-600">
            DEMO
          </span>
        </button>
      </div>
    </aside>
  );
}

/* ============================================================
   TOPBAR
   ============================================================ */

function Topbar() {
  const navigate = useSasiStore((s) => s.navigate);
  const setCommandOpen = useSasiStore((s) => s.setCommandOpen);
  const savedLocation = useSasiStore((s) => s.savedLocation);
  const [ntfOpen, setNtfOpen] = useState(false);
  const notifications = useSasiStore((s) => s.notifications);
  const markAll = useSasiStore((s) => s.markAllNotificationsRead);
  const unread = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-white/6 bg-[#050505]/85 px-4 backdrop-blur-md lg:px-6">
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
          Search services, cases, incidents or ask SASI…
        </span>
        <kbd className="hidden items-center gap-0.5 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9.5px] text-zinc-500 lg:flex">
          <CommandIcon className="h-2.5 w-2.5" />K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5 md:ml-0">
        <button
          onClick={() => navigate("ask-sasi")}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/[0.04] hover:text-white md:hidden"
          aria-label="Ask SASI"
        >
          <Sparkles className="h-[17px] w-[17px]" />
        </button>

        <button
          className="hidden h-9 items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.02] px-2.5 text-[12px] text-zinc-400 transition hover:border-white/15 hover:text-zinc-200 xl:flex"
          aria-label="Saved location"
          onClick={() => navigate("settings")}
        >
          <Map className="h-3.5 w-3.5 text-zinc-500" aria-hidden />
          {savedLocation.city}, {savedLocation.province}
          <ChevronDown className="h-3 w-3 text-zinc-600" aria-hidden />
        </button>

        <div className="relative">
          <button
            onClick={() => setNtfOpen((o) => !o)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-white/[0.04] hover:text-white"
            aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
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
                aria-label="Notifications"
                className="sasi-card sasi-pop absolute right-0 top-11 z-50 w-[min(92vw,380px)] overflow-hidden bg-[#0d0e10] shadow-2xl shadow-black/60"
              >
                <div className="flex items-center justify-between border-b border-white/6 px-3 py-2.5">
                  <p className="text-[12.5px] font-semibold text-white">Notifications</p>
                  <button
                    onClick={() => { markAll(); }}
                    className="text-[11.5px] text-zinc-500 transition hover:text-white"
                  >
                    Mark all read
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
                  View all notifications
                </button>
              </div>
            </>
          )}
        </div>

        <button
          onClick={() => navigate("profile")}
          className="ml-1 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-[10.5px] font-semibold text-zinc-300 transition hover:border-white/25"
          aria-label="Profile"
        >
          {DEMO_USER.firstName[0]}
          {DEMO_USER.name.split(" ")[1]?.[0]}
        </button>
      </div>
    </header>
  );
}

/* ============================================================
   MOBILE BOTTOM NAV
   ============================================================ */

const MOBILE_NAV: { view: View; label: string; icon: typeof Search }[] = [
  { view: "dashboard", label: "Home", icon: LayoutDashboard },
  { view: "investigate", label: "Investigate", icon: Sparkles },
  { view: "cases", label: "Cases", icon: FolderLock },
  { view: "map", label: "Map", icon: Map },
  { view: "profile", label: "Profile", icon: CircleUser },
];

function MobileNav() {
  const view = useSasiStore((s) => s.view);
  const navigate = useSasiStore((s) => s.navigate);
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/8 bg-[#070708]/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
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
              className="relative flex flex-col items-center gap-1 py-2.5"
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
                  "h-[19px] w-[19px]",
                  active ? "text-white" : "text-zinc-600"
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "text-[9.5px] font-medium",
                  active ? "text-white" : "text-zinc-600"
                )}
              >
                {item.label}
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
  if (view === "ask-sasi") return null;
  return (
    <button
      onClick={() => navigate("ask-sasi")}
      className="sasi-glow-multi fixed bottom-[72px] right-4 z-40 flex h-12 items-center gap-2 rounded-full bg-white pl-3.5 pr-4 text-[13px] font-semibold text-black transition-transform active:scale-95 lg:hidden"
      aria-label="Ask SASI anything"
    >
      <Sparkles className="h-4 w-4" aria-hidden />
      Ask SASI
    </button>
  );
}

/* ============================================================
   SHELL
   ============================================================ */

export function AppShell({ children }: { children: React.ReactNode }) {
  const setCommandOpen = useSasiStore((s) => s.setCommandOpen);
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandOpen]);

  return (
    <div className="min-h-screen bg-[#050505]">
      <Sidebar />
      <div className="lg:pl-[228px]">
        <Topbar />
        <main className="min-h-[calc(100vh-3.5rem)] pb-24 lg:pb-8">{children}</main>
      </div>
      <MobileNav />
      <FloatingAskButton />
    </div>
  );
}

/* keep import used */
void Map;
