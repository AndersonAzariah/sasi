"use client";

import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Bell,
  FolderLock,
  LayoutDashboard,
  Map as MapIcon,
  Search,
  Settings,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSasiStore } from "@/lib/sasi/store";
import { CASES, EVIDENCE, INCIDENTS } from "@/lib/sasi/data";
import { LANGUAGES, translate } from "@/lib/sasi/i18n";
import { SERVICES as SERVICE_META } from "@/lib/sasi/utils";
import { ServiceIcon } from "./primitives";
import { Bot } from "lucide-react";

type ResultRow = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  keywords: string;
  perform: () => void;
};

export function CommandPalette() {
  const open = useSasiStore((s) => s.commandOpen);
  const setOpen = useSasiStore((s) => s.setCommandOpen);
  const navigate = useSasiStore((s) => s.navigate);
  const openCase = useSasiStore((s) => s.openCase);
  const openIncident = useSasiStore((s) => s.openIncident);
  const openService = useSasiStore((s) => s.openService);
  const startInvestigationFor = useSasiStore((s) => s.startInvestigationFor);
  const setPendingAsk = useSasiStore((s) => s.setPendingAsk);
  const [query, setQuery] = useState("");

  const ask = (q: string) => {
    setPendingAsk(q);
    navigate("ask-sasi");
  };

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const rows = useMemo<ResultRow[]>(() => {
    const out: ResultRow[] = [];

    // Ask SASI — intelligent prompts
    const askRows: { q: string; hint: string }[] = query.trim()
      ? [
          { q: `Ask SASI about “${query.trim()}”`, hint: "Civic assistant" },
          { q: `Report a problem: “${query.trim()}”`, hint: "Open report flow" },
          { q: `Find services for “${query.trim()}”`, hint: "Browse service directory" },
        ]
      : [
          { q: "Why is my water off?", hint: "Ask SASI" },
          { q: "Report a water problem", hint: "Report flow" },
          { q: "Investigate my water outage", hint: "Start investigation" },
          { q: "What should I do next?", hint: "Ask SASI" },
          { q: "Show incidents near me", hint: "Incident explorer" },
        ];
    askRows.forEach((r, i) => {
      out.push({
        id: `ask-${i}`,
        group: "Ask SASI",
        label: r.q,
        hint: r.hint,
        keywords: `ask sasi ai question civic ${r.q}`,
        perform: () => {
          if (r.hint === "Report flow" || r.q.startsWith("Report a problem")) {
            navigate("report");
          } else if (r.hint === "Start investigation" || r.q.startsWith("Investigate")) {
            startInvestigationFor("case-123");
          } else if (r.hint === "Browse service directory" || r.q.startsWith("Find services")) {
            navigate("services");
          } else if (r.q.startsWith("Show incidents")) {
            navigate("incidents");
          } else if (r.q === "Why is my water off?" || r.q === "What should I do next?") {
            ask(r.q);
          } else {
            // free-form question → the LLM-backed Ask SASI chat
            ask(query.trim());
          }
        },
      });
    });

    // Services
    Object.entries(SERVICE_META).forEach(([key, meta]) => {
      out.push({
        id: `svc-${key}`,
        group: "Services",
        label: meta.label,
        hint: meta.blurb,
        keywords: `service ${meta.label} ${meta.blurb}`,
        perform: () => openService(key),
      });
    });

    // Cases
    useSasiStore.getState().cases.forEach((c) => {
      out.push({
        id: `case-${c.id}`,
        group: "Cases",
        label: `${c.ref} — ${c.title}`,
        hint: `${c.status.replace("_", " ")} · ${c.location.city}`,
        keywords: `case ${c.ref} ${c.title} ${c.location.city} ${c.service}`,
        perform: () => openCase(c.ref),
      });
    });

    // Incidents
    INCIDENTS.forEach((i) => {
      out.push({
        id: `inc-${i.id}`,
        group: "Incidents",
        label: `${i.ref} — ${i.title}`,
        hint: `${i.status} · ${i.location.city}`,
        keywords: `incident ${i.ref} ${i.title} ${i.location.city} ${i.service}`,
        perform: () => openIncident(i.id),
      });
    });

    // Evidence
    EVIDENCE.slice(0, 6).forEach((e) => {
      out.push({
        id: `evd-${e.id}`,
        group: "Evidence",
        label: e.title,
        hint: `${e.type} · ${e.location ?? "vault"}`,
        keywords: `evidence photo note link ${e.title}`,
        perform: () => navigate("evidence"),
      });
    });

    // Navigation
    const navItems = [
      { view: "landing" as const, label: "Home / Landing", icon: LayoutDashboard },
      { view: "dashboard" as const, label: "Dashboard", icon: LayoutDashboard },
      { view: "ask-sasi" as const, label: "Ask SASI chat", icon: Bot },
      { view: "investigate" as const, label: "Investigation workspace", icon: Sparkles },
      { view: "cases" as const, label: "Cases", icon: FolderLock },
      { view: "incidents" as const, label: "Incidents", icon: Zap },
      { view: "map" as const, label: "Civic map", icon: MapIcon },
      { view: "evidence" as const, label: "Evidence vault", icon: FolderLock },
      { view: "activity" as const, label: "Activity", icon: Zap },
      { view: "notifications" as const, label: "Notifications", icon: Bell },
      { view: "settings" as const, label: "Settings", icon: Settings },
    ];
    navItems.forEach((n) => {
      out.push({
        id: `nav-${n.view}`,
        group: "Navigation",
        label: n.label,
        hint: "Go to",
        keywords: `go navigate ${n.label}`,
        perform: () => navigate(n.view),
      });
    });

    // Language — instant switch, current language first (excluded)
    const currentLang = useSasiStore.getState().lang;
    LANGUAGES.filter((l) => l.code !== currentLang).forEach((l) => {
      out.push({
        id: `lang-${l.code}`,
        group: "Language",
        label: `Switch to ${l.label}`,
        hint: translate(currentLang, "settings.language.interface"),
        keywords: `language taal ulimi limi switch ${l.label} ${l.english}`,
        perform: () => useSasiStore.getState().setLang(l.code),
      });
    });

    return out;
  }, [query, navigate, openCase, openIncident, openService, startInvestigationFor, ask, useSasiStore]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.label.toLowerCase().includes(q) || r.keywords.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const grouped = useMemo(() => {
    // globalThis.Map: the lucide-react `Map` icon import in this module
    // shadows the built-in Map under Turbopack's concatenated scope.
    const map = new globalThis.Map<string, ResultRow[]>();
    filtered.forEach((r) => {
      const list = map.get(r.group) ?? [];
      list.push(r);
      map.set(r.group, list);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 px-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="SASI command palette"
        >
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="w-full max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sasi-pulse sasi-pulse-multi overflow-hidden rounded-xl border border-white/10 bg-[#0b0b0c] shadow-2xl shadow-black/70">
              <Command label="SASI command palette" loop>
                <div className="flex items-center gap-3 border-b border-white/6 px-4">
                  <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                  <Command.Input
                    autoFocus
                    value={query}
                    onValueChange={setQuery}
                    placeholder="Search services, cases, incidents or ask SASI…"
                    className="h-12 w-full bg-transparent text-[14px] text-white outline-none placeholder:text-zinc-600"
                  />
                  <kbd className="hidden rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9.5px] text-zinc-500 sm:block">
                    ESC
                  </kbd>
                </div>

                <Command.List className="sasi-scroll max-h-[46vh] overflow-y-auto p-2">
                  <Command.Empty className="px-3 py-8 text-center">
                    <p className="text-[13px] text-zinc-400">No matches found.</p>
                    <p className="mt-1 text-[12px] text-zinc-600">
                      Ask SASI instead — it can investigate civic questions.
                    </p>
                  </Command.Empty>

                  {grouped.map(([group, items]) => (
                    <Command.Group
                      key={group}
                      heading={group}
                      className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[9.5px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.16em] [&_[cmdk-group-heading]]:text-zinc-600"
                    >
                      {items.map((r) => (
                        <Command.Item
                          key={r.id}
                          value={`${r.label} ${r.keywords}`}
                          onSelect={r.perform}
                          className="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-zinc-300 data-[selected=true]:bg-white/[0.05] data-[selected=true]:text-white"
                        >
                          {r.group === "Ask SASI" ? (
                            <Sparkles className="h-4 w-4 shrink-0 text-[#e3c567]" aria-hidden />
                          ) : r.group === "Navigation" && r.label === "Ask SASI chat" ? (
                            <Bot className="h-4 w-4 shrink-0 text-[#e3c567]" aria-hidden />
                          ) : r.group === "Services" ? (
                            <ServiceIcon
                              service={
                                (Object.keys(SERVICE_META) as (keyof typeof SERVICE_META)[]).find(
                                  (k) => SERVICE_META[k].label === r.label
                                ) ?? "other"
                              }
                              className="h-4 w-4 shrink-0 text-zinc-500"
                            />
                          ) : (
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-600 group-data-[selected=true]:text-zinc-300" aria-hidden />
                          )}
                          <span className="min-w-0 flex-1 truncate text-[13.5px]">
                            {r.label}
                          </span>
                          {r.hint && (
                            <span className="hidden shrink-0 text-[11px] text-zinc-600 sm:block">
                              {r.hint}
                            </span>
                          )}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ))}
                </Command.List>

                <div className="flex items-center justify-between border-t border-white/6 px-4 py-2 text-[10.5px] text-zinc-600">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-[#e3c567]" />
                    SASI command center — demo environment
                  </span>
                  <span className="hidden items-center gap-2 sm:flex">
                    <kbd className="rounded border border-white/10 px-1 font-mono text-[9px]">↑↓</kbd>
                    navigate
                    <kbd className="rounded border border-white/10 px-1 font-mono text-[9px]">↵</kbd>
                    select
                  </span>
                </div>
              </Command>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
