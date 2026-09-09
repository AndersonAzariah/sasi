"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  ExternalLink,
  FileText,
  FolderLock,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  List,
  Plus,
  Search,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSasiStore } from "@/lib/sasi/store";
import { useT, type TKey } from "@/lib/sasi/i18n";
import type { EvidenceItem, EvidenceType, TrustStatus } from "@/lib/sasi/types";
import { TRUST_STATUS_META, formatDate } from "@/lib/sasi/utils";
import { toast } from "@/hooks/use-toast";
import {
  DemoBadge,
  EmptyState,
  GhostButton,
  PrimaryButton,
  StatTile,
  StatusBadge,
} from "../primitives";
import { EvidenceCard, EvidenceThumb } from "../domain";
import { PhotoAnalysisPanel } from "../photo-analysis";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ============================================================
   EVIDENCE VAULT — photos, documents, links and notes (demo)

   NOTE: the demo dataset already contains USER_PROVIDED trust
   items, and user-added evidence is stored with that status.
   TRUST_STATUS_META has no key for it, so we register a safe
   entry here (text + colour, never colour alone) before any
   StatusBadge renders it. Kept local to this view on purpose.
   ============================================================ */

const TRUST_META = TRUST_STATUS_META as Record<
  string,
  { label: string; color: string; dot: string; ring: string; text: string }
>;
if (!TRUST_META.USER_PROVIDED) {
  TRUST_META.USER_PROVIDED = {
    label: "User provided",
    color: "#e3c567",
    dot: "bg-[#e3c567]",
    ring: "ring-[#e3c567]/25",
    text: "text-[#efe0a8]",
  };
}

/* Chip labels are display-only; the stored type stays canonical. */
const TYPE_META: Record<
  EvidenceType | "ALL",
  { labelKey: TKey; icon: typeof ImageIcon }
> = {
  ALL: { labelKey: "cases.filter.all", icon: LayoutGrid },
  PHOTO: { labelKey: "ev.type-photos", icon: ImageIcon },
  DOCUMENT: { labelKey: "ev.type-documents", icon: FileText },
  LINK: { labelKey: "ev.type-links", icon: Link2 },
  NOTE: { labelKey: "ev.type-notes", icon: StickyNote },
};

const VERIFICATION_OPTIONS: { value: string; labelKey: TKey }[] = [
  { value: "all", labelKey: "ev.all-verification" },
  { value: "CONFIRMED", labelKey: "status.confirmed" },
  { value: "REPORTED", labelKey: "status.reported" },
  { value: "USER_PROVIDED", labelKey: "ev.trust-user" },
];

export default function EvidenceView() {
  const t = useT();
  const evidence = useSasiStore((s) => s.evidence);
  const cases = useSasiStore((s) => s.cases);
  const openCase = useSasiStore((s) => s.openCase);
  const addEvidence = useSasiStore((s) => s.addEvidence);
  const savedLocation = useSasiStore((s) => s.savedLocation);

  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("ALL");
  const [caseFilter, setCaseFilter] = useState<string>("all");
  const [verification, setVerification] = useState<string>("all");
  const [mode, setMode] = useState<"grid" | "list">("grid");

  /* dialogs */
  const [preview, setPreview] = useState<EvidenceItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addKind, setAddKind] = useState<"NOTE" | "LINK">("NOTE");
  const [addTitle, setAddTitle] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addCaseId, setAddCaseId] = useState<string>("none");

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  const caseRefById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cases) map.set(c.id, c.ref);
    return map;
  }, [cases]);

  const counts = useMemo(
    () => ({
      all: evidence.length,
      PHOTO: evidence.filter((e) => e.type === "PHOTO").length,
      DOCUMENT: evidence.filter((e) => e.type === "DOCUMENT").length,
      LINK: evidence.filter((e) => e.type === "LINK").length,
      NOTE: evidence.filter((e) => e.type === "NOTE").length,
      linked: evidence.filter((e) => e.caseId).length,
      verified: evidence.filter((e) => e.verification === "CONFIRMED").length,
    }),
    [evidence]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...evidence]
      .filter((e) => {
        if (type !== "ALL" && e.type !== type) return false;
        if (caseFilter !== "all" && e.caseId !== caseFilter) return false;
        if (verification !== "all" && e.verification !== verification) return false;
        if (q && !e.title.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [evidence, query, type, caseFilter, verification]);

  const hasActiveFilters =
    query.trim() !== "" || type !== "ALL" || caseFilter !== "all" || verification !== "all";

  const clearFilters = () => {
    setQuery("");
    setType("ALL");
    setCaseFilter("all");
    setVerification("all");
  };

  const resetAddForm = () => {
    setAddKind("NOTE");
    setAddTitle("");
    setAddNote("");
    setAddUrl("");
    setAddCaseId("none");
  };

  const handleAdd = () => {
    const validNote = addKind === "NOTE" && addNote.trim().length > 0;
    const validLink = addKind === "LINK" && /^https?:\/\/\S+\.\S+/.test(addUrl.trim());
    if (!validNote && !validLink) return;

    const item: EvidenceItem = {
      id: `EVD-user-${Date.now()}`,
      type: addKind,
      title:
        addTitle.trim() ||
        (addKind === "NOTE" ? t("ev.fallback-note") : t("ev.fallback-link")),
      description: addKind === "NOTE" ? addNote.trim() : undefined,
      url: addKind === "LINK" ? addUrl.trim() : undefined,
      createdAt: new Date().toISOString(),
      location: `${savedLocation.suburb}, ${savedLocation.city}`,
      caseId: addCaseId === "none" ? undefined : addCaseId,
      verification: "USER_PROVIDED" as TrustStatus,
      isDemo: true,
    };
    addEvidence(item);
    setAddOpen(false);
    resetAddForm();
    toast({
      title: t("ev.toast.title"),
      description: t("ev.toast.desc"),
    });
  };

  const addReady =
    addKind === "NOTE"
      ? addNote.trim().length > 0
      : /^https?:\/\/\S+\.\S+/.test(addUrl.trim());

  const typeChips: (keyof typeof TYPE_META)[] = ["ALL", "PHOTO", "DOCUMENT", "LINK", "NOTE"];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* ---------- header ---------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[20px] font-semibold tracking-tight text-white">{t("ev.title")}</h1>
          <p className="mt-1 text-[13px] text-zinc-500">
            {t("ev.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DemoBadge label="DEMO DATA" />
          <PrimaryButton
            onClick={() => {
              resetAddForm();
              setAddOpen(true);
            }}
            aria-label={t("cd.add-evidence")}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            {t("cd.add-evidence")}
          </PrimaryButton>
        </div>
      </div>

      {/* ---------- stats ---------- */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={t("ev.stat-items")} value={counts.all} hint={t("ev.stat-items-hint")} />
        <StatTile label={t("ev.stat-photos")} value={counts.PHOTO} tone="blue" hint={t("ev.stat-photos-hint")} />
        <StatTile label={t("ev.stat-linked")} value={counts.linked} tone="gold" hint={t("ev.stat-linked-hint")} />
        <StatTile label={t("ev.stat-verified")} value={counts.verified} tone="green" hint={t("ev.stat-verified-hint")} />
      </div>

      {/* ---------- toolbar ---------- */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs min-w-0 flex-1 sm:flex-none sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("ev.search")}
            aria-label={t("ev.search-aria")}
            className="h-10 rounded-lg border-white/10 bg-white/[0.03] pl-9 text-[13px] text-white placeholder:text-zinc-600"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={caseFilter} onValueChange={setCaseFilter}>
            <SelectTrigger
              size="sm"
              aria-label={t("ev.filter-case-aria")}
              className="h-9 w-[190px] border-white/10 bg-transparent text-[12px] text-zinc-300"
            >
              <SelectValue placeholder={t("cd.back")} />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#0b0c0e] text-zinc-200">
              <SelectItem value="all">{t("cd.back")}</SelectItem>
              {cases.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.ref} — {c.title.length > 26 ? `${c.title.slice(0, 26)}…` : c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={verification} onValueChange={setVerification}>
            <SelectTrigger
              size="sm"
              aria-label={t("ev.filter-verification-aria")}
              className="h-9 w-[170px] border-white/10 bg-transparent text-[12px] text-zinc-300"
            >
              <SelectValue placeholder={t("ev.all-verification")} />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-[#0b0c0e] text-zinc-200">
              {VERIFICATION_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {t(o.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div
            className="flex items-center rounded-lg border border-white/10 p-0.5"
            role="group"
            aria-label={t("ev.layout-aria")}
          >
            <button
              type="button"
              onClick={() => setMode("grid")}
              aria-pressed={mode === "grid"}
              aria-label={t("ev.view-grid")}
              className={cn(
                "flex h-8 w-9 items-center justify-center rounded-md transition-colors",
                mode === "grid" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setMode("list")}
              aria-pressed={mode === "list"}
              aria-label={t("ev.view-list")}
              className={cn(
                "flex h-8 w-9 items-center justify-center rounded-md transition-colors",
                mode === "list" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <List className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {/* type chips with counts */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {typeChips.map((k) => {
          const meta = TYPE_META[k];
          const Icon = meta.icon;
          const active = type === k;
          const n = k === "ALL" ? counts.all : counts[k as EvidenceType];
          return (
            <button
              key={k}
              type="button"
              onClick={() => setType(k)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors",
                active
                  ? "border-white bg-white text-black"
                  : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {t(meta.labelKey)}
              <span className={cn("text-[9.5px]", active ? "text-black/60" : "text-zinc-600")}>
                {n}
              </span>
            </button>
          );
        })}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="ml-1 text-[11.5px] font-medium text-zinc-400 underline underline-offset-4 transition-colors hover:text-white"
          >
            {t("cases.clear-filters")}
          </button>
        )}
      </div>

      {/* ---------- results ---------- */}
      <div className="mt-4">
        {loading ? (
          mode === "grid" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="sasi-card space-y-3 p-3">
                  <div className="aspect-[16/10] w-full animate-pulse rounded-lg bg-white/5" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-white/5" />
                  <div className="h-2 w-1/2 animate-pulse rounded bg-white/4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="sasi-card divide-y divide-white/5 overflow-hidden">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3">
                  <div className="h-14 w-20 shrink-0 animate-pulse rounded-lg bg-white/5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-white/5" />
                    <div className="h-2 w-1/2 animate-pulse rounded bg-white/4" />
                  </div>
                </div>
              ))}
            </div>
          )
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={FolderLock}
            title={t("ev.empty.title")}
            description={t("ev.empty.description")}
            action={<GhostButton onClick={clearFilters}>{t("map.clear-all")}</GhostButton>}
          />
        ) : mode === "grid" ? (
          <motion.div layout className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout" initial={false}>
              {filtered.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  className="min-w-0"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.985 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  <EvidenceCard item={item} showCase onOpen={() => setPreview(item)} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <div className="sasi-card divide-y divide-white/5 overflow-hidden">
            <AnimatePresence initial={false}>
              {filtered.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <button
                    type="button"
                    onClick={() => setPreview(item)}
                    aria-label={t("ev.open-aria").replace("{title}", item.title)}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-white/[0.03]"
                  >
                    <EvidenceThumb item={item} className="h-14 w-20 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-white">
                        {item.title}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[0.12em] text-zinc-400">
                          {item.type}
                        </span>
                        <StatusBadge status={item.verification} size="sm" />
                        {item.caseId && (
                          <span className="font-mono text-[10px] tracking-wider text-zinc-600">
                            {caseRefById.get(item.caseId) ?? item.caseId}
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-[11px] text-zinc-600 sm:block">
                      {formatDate(item.createdAt)}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" aria-hidden />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ---------- preview dialog ---------- */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sasi-scroll max-h-[85vh] overflow-y-auto border-white/10 bg-[#0b0c0e] p-0 text-white sm:max-w-lg">
          {preview && (
            <>
              <div className="px-4 pt-4 sm:px-5 sm:pt-5">
                <EvidenceThumb item={preview} className="aspect-video w-full" />
              </div>
              <DialogHeader className="px-4 pt-4 text-left sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <DialogTitle className="text-[15px] font-semibold leading-snug text-white">
                    {preview.title}
                  </DialogTitle>
                  <DemoBadge label="DEMO" />
                </div>
                {preview.description && (
                  <DialogDescription className="text-[12.5px] leading-relaxed text-zinc-400">
                    {preview.description}
                  </DialogDescription>
                )}
              </DialogHeader>
              <div className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
                <dl className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
                  {[
                    {
                      label: t("ev.row-type"),
                      value: TYPE_META[preview.type]
                        ? t(TYPE_META[preview.type].labelKey)
                        : preview.type,
                    },
                    { label: t("ev.row-uploaded"), value: formatDate(preview.createdAt) },
                    { label: t("cd.facts.location"), value: preview.location ?? t("ev.row-not-recorded") },
                    {
                      label: t("ev.row-verification"),
                      value:
                        String(preview.verification) === "USER_PROVIDED"
                          ? t("ev.trust-user")
                          : TRUST_META[preview.verification]?.label ?? String(preview.verification),
                    },
                    ...(preview.url ? [{ label: t("ev.row-link"), value: preview.url }] : []),
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-baseline justify-between gap-4 border-b border-white/5 py-1.5 last:border-b-0 last:pb-0 first:pt-0"
                    >
                      <dt className="shrink-0 text-[10.5px] font-medium uppercase tracking-[0.1em] text-zinc-600">
                        {row.label}
                      </dt>
                      <dd className="min-w-0 break-all text-right text-[12px] text-zinc-300">
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>

                {/* VLM re-analysis is only honest for bundled demo photos —
                    the user's own photos are never stored, so there is
                    nothing to re-read */}
                {preview.type === "PHOTO" && preview.imageKey && (
                  <PhotoAnalysisPanel item={preview} />
                )}

                {preview.caseId && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.02] p-3">
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-zinc-600">
                        {t("ev.linked-case")}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[12px] text-zinc-300">
                        {caseRefById.get(preview.caseId) ?? preview.caseId}
                      </p>
                    </div>
                    <GhostButton
                      className="h-8 shrink-0 px-3 text-[12px]"
                      onClick={() => {
                        setPreview(null);
                        openCase(preview.caseId!);
                      }}
                      aria-label={t("ev.open-case-aria")}
                    >
                      {t("map.open-case")}
                    </GhostButton>
                  </div>
                )}

                <p className="border-t border-white/5 pt-3 text-[11px] leading-relaxed text-zinc-600">
                  {t("ev.demo-note")}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- add evidence dialog ---------- */}
      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          if (!o) {
            setAddOpen(false);
            resetAddForm();
          }
        }}
      >
        <DialogContent className="sasi-scroll max-h-[85vh] overflow-y-auto border-white/10 bg-[#0b0c0e] text-white sm:max-w-md">
          <DialogHeader className="text-left">
            <DialogTitle className="text-[15px] font-semibold text-white">{t("cd.add-evidence")}</DialogTitle>
            <DialogDescription className="text-[12.5px] text-zinc-500">
              {t("ev.add-desc")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* kind selector */}
            <div>
              <Label className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-zinc-500">
                {t("ev.row-type")}
              </Label>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5" role="group" aria-label={t("ev.add-type-aria")}>
                <button
                  type="button"
                  onClick={() => setAddKind("NOTE")}
                  aria-pressed={addKind === "NOTE"}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-1 rounded-lg border text-[11px] font-medium transition-colors",
                    addKind === "NOTE"
                      ? "border-white/50 bg-white/10 text-white"
                      : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                  )}
                >
                  <StickyNote className="h-4 w-4" aria-hidden /> {t("ev.add-note")}
                </button>
                <button
                  type="button"
                  onClick={() => setAddKind("LINK")}
                  aria-pressed={addKind === "LINK"}
                  className={cn(
                    "flex h-14 flex-col items-center justify-center gap-1 rounded-lg border text-[11px] font-medium transition-colors",
                    addKind === "LINK"
                      ? "border-white/50 bg-white/10 text-white"
                      : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
                  )}
                >
                  <Link2 className="h-4 w-4" aria-hidden /> {t("ev.add-link")}
                </button>
                <button
                  type="button"
                  disabled
                  title={t("ev.coming-soon")}
                  aria-label={t("ev.coming-photo-aria")}
                  className="flex h-14 cursor-not-allowed flex-col items-center justify-center gap-1 rounded-lg border border-white/8 text-[11px] text-zinc-600"
                >
                  <ImageIcon className="h-4 w-4" aria-hidden /> {t("ev.add-photo")}
                </button>
                <button
                  type="button"
                  disabled
                  title={t("ev.coming-soon")}
                  aria-label={t("ev.coming-document-aria")}
                  className="flex h-14 cursor-not-allowed flex-col items-center justify-center gap-1 rounded-lg border border-white/8 text-[11px] text-zinc-600"
                >
                  <FileText className="h-4 w-4" aria-hidden /> {t("ev.add-document")}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-600">
                {t("ev.upload-note")}
              </p>
            </div>

            <div>
              <Label htmlFor="evidence-title" className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-zinc-500">
                {t("ev.add-title")} <span className="normal-case tracking-normal text-zinc-700">{t("ev.optional")}</span>
              </Label>
              <Input
                id="evidence-title"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                placeholder={addKind === "NOTE" ? t("ev.title-ph-note") : t("ev.title-ph-link")}
                className="mt-1.5 h-9 border-white/10 bg-white/[0.03] text-[13px] text-white placeholder:text-zinc-600"
              />
            </div>

            {addKind === "NOTE" ? (
              <div>
                <Label htmlFor="evidence-note" className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-zinc-500">
                  {t("ev.add-note")}
                </Label>
                <Textarea
                  id="evidence-note"
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  placeholder={t("ev.add-note-placeholder")}
                  rows={4}
                  className="mt-1.5 resize-none border-white/10 bg-white/[0.03] text-[13px] text-white placeholder:text-zinc-600"
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="evidence-url" className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-zinc-500">
                  {t("ev.url-label")}
                </Label>
                <div className="relative mt-1.5">
                  <ExternalLink
                    className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600"
                    aria-hidden
                  />
                  <Input
                    id="evidence-url"
                    type="url"
                    inputMode="url"
                    value={addUrl}
                    onChange={(e) => setAddUrl(e.target.value)}
                    placeholder="https://…"
                    className="h-9 border-white/10 bg-white/[0.03] pl-9 text-[13px] text-white placeholder:text-zinc-600"
                  />
                </div>
                {addUrl.trim() !== "" && !addReady && (
                  <p className="mt-1.5 text-[11px] text-[#fda4a0]">
                    {t("ev.url-error")}
                  </p>
                )}
              </div>
            )}

            <div>
              <Label className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-zinc-500">
                {t("ev.link-case")} <span className="normal-case tracking-normal text-zinc-700">{t("ev.optional")}</span>
              </Label>
              <Select value={addCaseId} onValueChange={setAddCaseId}>
                <SelectTrigger
                  aria-label={t("ev.link-case-aria")}
                  className="mt-1.5 h-9 w-full border-white/10 bg-transparent text-[12.5px] text-zinc-300"
                >
                  <SelectValue placeholder={t("ev.not-linked")} />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#0b0c0e] text-zinc-200">
                  <SelectItem value="none">{t("ev.not-linked")}</SelectItem>
                  {cases.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.ref} — {c.title.length > 28 ? `${c.title.slice(0, 28)}…` : c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-3.5">
              <p className="text-[11px] leading-relaxed text-zinc-600">
                {t("ev.nothing-leaves")}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <GhostButton
                  className="h-9 px-3.5"
                  onClick={() => {
                    setAddOpen(false);
                    resetAddForm();
                  }}
                >
                  {t("ev.cancel")}
                </GhostButton>
                <PrimaryButton
                  className="h-9 px-3.5"
                  disabled={!addReady}
                  onClick={handleAdd}
                  aria-label={t("ev.save-aria")}
                >
                  {t("ev.save")}
                </PrimaryButton>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
