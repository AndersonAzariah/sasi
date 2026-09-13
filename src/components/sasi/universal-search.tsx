"use client";

/* ============================================================
   SASI — Universal Search (Task 29, Phase 12)

   The single search surface for the whole app. Replaces the old
   command palette experience: one input, one honest engine.

   - Results come ONLY from src/lib/sasi/search.ts (the service
     registry, journeys, verified organisations, civic topics,
     public information views and the resident's saved items).
     SASI never fabricates a hit — a row exists because a real
     entry matched.
   - "Ask SASI" is always offered first as the AI interpretation
     path for a typed query; it is a hand-off, not a pretend hit.
   - Intent rows (Nearby / Verify / Report) route honestly to the
     flow that can actually act on the query's shape.
   - Saved items are fetched once per open, only when signed in,
     and fail silently — an empty Saved group is honest.
   ============================================================ */

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BadgeCheck,
  Bookmark,
  BookOpen,
  Compass,
  FileText,
  Flag,
  Landmark,
  Navigation,
  Route,
  ScanSearch,
  Search,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSasiStore } from "@/lib/sasi/store";
import { getSessionId } from "@/lib/sasi/utils";
import { registryEntryBySlug } from "@/lib/sasi/services-registry";
import { searchSASI, type SavedSearchInput, type SearchHit } from "@/lib/sasi/search";
import { SectionLabel } from "./primitives";

/* ------------------------------------------------------------
   Row model — flat, keyboard-order = visual order
   ------------------------------------------------------------ */

type RowGroup =
  | "ask"
  | "services"
  | "journeys"
  | "organisations"
  | "topics"
  | "information"
  | "saved"
  | "actions"
  | "popular"
  | "shortcuts";

interface Row {
  id: string;
  group: RowGroup;
  icon: LucideIcon;
  iconClass?: string;
  title: string;
  subtitle?: string;
  /** true ONLY when the entry's official source is verified (engine-provided) */
  verified?: boolean;
  perform: () => void;
}

const GROUP_LABELS: Record<RowGroup, string> = {
  ask: "Ask SASI",
  services: "Services",
  journeys: "Journeys",
  organisations: "Organisations",
  topics: "Topics",
  information: "Information",
  saved: "Saved",
  actions: "Actions",
  popular: "Popular",
  shortcuts: "Shortcuts",
};

/** query mode — ask row first, then registry groups, then intent actions */
const QUERY_GROUP_ORDER: RowGroup[] = [
  "ask",
  "services",
  "journeys",
  "organisations",
  "topics",
  "information",
  "saved",
  "actions",
];

/** empty mode — curated popular services, then Ask / Explore */
const EMPTY_GROUP_ORDER: RowGroup[] = ["popular", "ask", "shortcuts"];

/** engine hit group → row group */
const GROUP_OF_HIT: Record<SearchHit["group"], RowGroup> = {
  service: "services",
  journey: "journeys",
  organisation: "organisations",
  topic: "topics",
  information: "information",
  saved: "saved",
};

const POPULAR_SLUGS = ["passport", "smart-id", "sassa-grants"] as const;

const optId = (index: number) => `sasi-search-opt-${index}`;

interface SavedApiRow {
  kind: string;
  itemId: string;
  payload?: { title?: string } | null;
}

/* ============================================================
   Component
   ============================================================ */

export function UniversalSearch() {
  const open = useSasiStore((s) => s.commandOpen);
  const setOpen = useSasiStore((s) => s.setCommandOpen);
  const navigate = useSasiStore((s) => s.navigate);
  const openService = useSasiStore((s) => s.openService);
  const setPendingAsk = useSasiStore((s) => s.setPendingAsk);
  const authed = useSasiStore((s) => s.authed);

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [savedInputs, setSavedInputs] = useState<SavedSearchInput[]>([]);

  /* ---------- global keys: Ctrl/Cmd+K toggles, Escape closes ---------- */
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

  /* ---------- reset without effects (React's adjust-during-render pattern):
     every open starts fresh; every keystroke returns the selection to top ---------- */
  const resetKey = open ? `open|${query}` : "closed";
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    if (open) {
      if (lastResetKey === "closed") {
        setQuery("");
        setActiveIndex(0);
        if (!authed) setSavedInputs([]); // stale saved data from a signed-in spell
      } else {
        setActiveIndex(0);
      }
    }
  }

  /* ---------- one honest saved-items fetch per open (signed in only) ---------- */
  useEffect(() => {
    if (!open || !authed) return;
    let cancelled = false;
    const sid = getSessionId();
    fetch(`/api/sasi/save?sessionId=${encodeURIComponent(sid)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { items?: SavedApiRow[]; saved?: SavedApiRow[] }) => {
        if (cancelled) return;
        /* the save API returns { items } — accept { saved } too, defensively */
        const list = data.items ?? data.saved ?? [];
        setSavedInputs(
          list
            .filter((s) => typeof s?.kind === "string" && typeof s?.itemId === "string")
            .map((s) => ({ kind: s.kind, itemId: s.itemId, title: s.payload?.title }))
        );
      })
      .catch(() => {
        /* silent, honest: no saved section when the fetch fails */
        if (!cancelled) setSavedInputs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, authed]);

  /* ---------- the engine — pure, per keystroke, no server call ---------- */
  const result = useMemo(() => searchSASI(query, savedInputs), [query, savedInputs]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const q = query.trim();

    if (!q) {
      /* ---------- empty query: curated, honest quick rows ---------- */
      for (const slug of POPULAR_SLUGS) {
        const entry = registryEntryBySlug(slug);
        if (!entry) continue; // registry changed — never invent a row
        out.push({
          id: `popular:${slug}`,
          group: "popular",
          icon: ShieldCheck,
          title: entry.title,
          subtitle: entry.department,
          verified: entry.officialSource?.verified ?? false,
          perform: () => openService(slug),
        });
      }
      out.push({
        id: "ask-empty",
        group: "ask",
        icon: Sparkles,
        iconClass: "text-[#e3c567]",
        title: "Ask SASI",
        subtitle: "Civic questions — answered honestly",
        perform: () => {
          setPendingAsk(null);
          navigate("ask-sasi");
        },
      });
      out.push({
        id: "explore-empty",
        group: "shortcuts",
        icon: Compass,
        title: "Explore SASI",
        subtitle: "Services, journeys, organisations & topics",
        perform: () => navigate("explore"),
      });
      return out;
    }

    /* ---------- first row, always: hand the query to Ask SASI ---------- */
    out.push({
      id: "ask-query",
      group: "ask",
      icon: Sparkles,
      iconClass: "text-[#e3c567]",
      title: `Ask SASI: “${q}”`,
      subtitle: "SASI can explain beyond the registries",
      perform: () => {
        setPendingAsk(q);
        navigate("ask-sasi");
      },
    });

    /* ---------- registry hits, in engine order (best match first) ---------- */
    const performHit = (h: SearchHit) => {
      switch (h.group) {
        case "service":
          openService(h.param ?? h.title);
          break;
        case "journey":
          navigate("journey", h.param);
          break;
        case "organisation":
        case "topic":
          navigate("explore", h.param);
          break;
        case "information":
          navigate(h.view);
          break;
        case "saved":
          if (h.view === "service-detail") openService(h.param ?? "");
          else navigate(h.view, h.param);
          break;
      }
    };

    const pushHits = (hits: SearchHit[]) => {
      for (const h of hits) {
        out.push({
          id: h.id,
          group: GROUP_OF_HIT[h.group],
          icon:
            h.group === "service"
              ? ShieldCheck
              : h.group === "journey"
                ? Route
                : h.group === "organisation"
                  ? Landmark
                  : h.group === "topic"
                    ? BookOpen
                    : h.group === "saved"
                      ? Bookmark
                      : FileText,
          title: h.title,
          subtitle: h.subtitle,
          verified: h.verified,
          perform: () => performHit(h),
        });
      }
    };

    pushHits(result.services);
    pushHits(result.journeys);
    pushHits(result.organisations);
    pushHits(result.topics);
    pushHits(result.information);
    pushHits(result.saved);

    /* ---------- intent rows: honest routing to the flow that can act ---------- */
    if (result.intent.nearby) {
      out.push({
        id: "intent-nearby",
        group: "actions",
        icon: Navigation,
        title: "Open Nearby map",
        subtitle: "Closest offices, pay points and clinics",
        perform: () => navigate("map"),
      });
    }
    if (result.intent.verify) {
      out.push({
        id: "intent-verify",
        group: "actions",
        icon: ScanSearch,
        title: "Verify this information",
        subtitle: "Check a message, link or sender",
        perform: () => navigate("verify"),
      });
    }
    if (result.intent.report) {
      out.push({
        id: "intent-report",
        group: "actions",
        icon: Flag,
        title: "Report an issue",
        subtitle: "Water, electricity, roads and waste",
        perform: () => navigate("report"),
      });
    }
    if (result.intent.rights) {
      out.push({
        id: "intent-rights",
        group: "actions",
        icon: BookOpen,
        title: "Explore your rights",
        subtitle: "Civic topics and public information",
        perform: () => navigate("explore"),
      });
    }
    if (result.intent.documents) {
      out.push({
        id: "intent-documents",
        group: "actions",
        icon: FileText,
        title: "Open your documents",
        subtitle: "Upload or explain a document",
        perform: () => navigate("documents"),
      });
    }

    return out;
  }, [query, result, navigate, openService, setPendingAsk]);

  /* ---------- grouped for rendering ---------- */
  const grouped = useMemo(() => {
    const map = new globalThis.Map<RowGroup, { row: Row; index: number }[]>();
    rows.forEach((row, index) => {
      const list = map.get(row.group) ?? [];
      list.push({ row, index });
      map.set(row.group, list);
    });
    const order = query.trim() ? QUERY_GROUP_ORDER : EMPTY_GROUP_ORDER;
    return order
      .filter((g) => (map.get(g)?.length ?? 0) > 0)
      .map((g) => ({ group: g, items: map.get(g)! }));
  }, [rows, query]);

  /* ---------- honest empty state ---------- */
  const noMatches =
    query.trim().length > 0 &&
    result.total === 0 &&
    !result.intent.nearby &&
    !result.intent.verify &&
    !result.intent.report &&
    !result.intent.rights &&
    !result.intent.documents;

  /* ---------- keyboard selection ---------- */
  const scrollOptionIntoView = (index: number) => {
    if (typeof document === "undefined") return;
    document.getElementById(optId(index))?.scrollIntoView({ block: "nearest" });
  };

  const moveSelection = (delta: number) => {
    if (rows.length === 0) return;
    setActiveIndex((prev) => {
      const next = (((prev + delta) % rows.length) + rows.length) % rows.length;
      requestAnimationFrame(() => scrollOptionIntoView(next));
      return next;
    });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSelection(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSelection(-1);
    } else if (e.key === "Enter") {
      const row = rows[Math.min(activeIndex, rows.length - 1)];
      if (row) {
        e.preventDefault();
        row.perform();
      }
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 backdrop-blur-sm sm:px-4 sm:pt-[15vh]"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Search SASI"
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="w-full sm:max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              onKeyDown={onKeyDown}
              className="sasi-pulse sasi-pulse-multi overflow-hidden rounded-b-xl border border-white/10 bg-zinc-950/95 shadow-2xl shadow-black/70 backdrop-blur-xl sm:rounded-xl"
            >
              {/* ---------- input row ---------- */}
              <div className="sasi-command-focus relative flex items-center gap-3 border-b border-white/10 px-4">
                <Search className="h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
                <label htmlFor="sasi-universal-search" className="sr-only">
                  Search SASI — services, journeys, places
                </label>
                <input
                  id="sasi-universal-search"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search SASI — services, journeys, places…"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="h-12 w-full bg-transparent text-[14px] text-white outline-none placeholder:text-zinc-600"
                />
                <kbd className="hidden shrink-0 rounded border border-white/10 px-1.5 py-0.5 font-mono text-[9.5px] text-zinc-500 sm:block">
                  ESC
                </kbd>
              </div>

              {/* ---------- results ---------- */}
              <div
                role="listbox"
                aria-label="Search results"
                aria-activedescendant={
                  rows.length > 0 ? optId(Math.min(activeIndex, rows.length - 1)) : undefined
                }
                className="sasi-scroll max-h-[56vh] overflow-y-auto p-2 sm:max-h-[46vh]"
              >
                {noMatches && (
                  <div className="px-3 py-7 text-center" role="status">
                    <p className="text-[13px] text-zinc-400">
                      Nothing matches “{query.trim()}” in SASI&rsquo;s registries
                    </p>
                    <p className="mt-1 text-[12px] text-zinc-600">
                      Ask SASI instead — it can explain beyond the registry
                    </p>
                  </div>
                )}

                {grouped.map(({ group, items }) => (
                  <div key={group} className="pb-1.5">
                    <SectionLabel className="sticky top-0 z-10 bg-[#0b0b0d]/95 px-3 py-2 backdrop-blur-sm">
                      {GROUP_LABELS[group]}
                    </SectionLabel>
                    {items.map(({ row, index }) => {
                      const active = index === Math.min(activeIndex, rows.length - 1);
                      const Icon = row.icon;
                      return (
                        <div
                          key={row.id}
                          id={optId(index)}
                          role="option"
                          aria-selected={active}
                          onClick={row.perform}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={cn(
                            "flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg px-3 py-2",
                            active ? "bg-white/[0.05] text-white" : "text-zinc-300"
                          )}
                        >
                          <Icon
                            className={cn("h-4 w-4 shrink-0", row.iconClass ?? "text-zinc-500")}
                            aria-hidden
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13.5px] leading-snug">
                              {row.title}
                            </span>
                            {row.subtitle && (
                              <span className="block truncate text-[11.5px] text-zinc-500">
                                {row.subtitle}
                              </span>
                            )}
                          </span>
                          {row.verified && (
                            <BadgeCheck
                              className="h-3.5 w-3.5 shrink-0 text-[#66bb6a]"
                              aria-label="Verified official source"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* ---------- footer ---------- */}
              <div className="flex items-center justify-between border-t border-white/10 px-4 py-2 text-[10.5px] text-zinc-600">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-[#e3c567]" aria-hidden />
                  SASI search — registries only, nothing is sent without your approval
                </span>
                <span className="hidden items-center gap-2 sm:flex">
                  <kbd className="rounded border border-white/10 px-1 font-mono text-[9px]">
                    ↑↓
                  </kbd>
                  navigate
                  <kbd className="rounded border border-white/10 px-1 font-mono text-[9px]">
                    ↵
                  </kbd>
                  select
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
