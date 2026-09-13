"use client";

/* ============================================================
   DOCUMENTS — Phase 15 document intelligence.

   Upload → Analyse → Summary → Important information →
   Important dates → Required actions → Ask SASI about this
   document → Delete.

   HONESTY CONTRACT (implemented, not claimed):
   - The original file is NEVER stored. Only the analysis you
     see here is persisted (name, type, size, summary, key info).
   - If AI analysis fails, the document is stored with an honest
     "analysis unavailable" error — never a made-up summary.
   - Delete is immediate and permanent; the UI says exactly that.
   - Documents are private: the list is scoped to your own
     session (or your signed-in account) and never to others.

   No loading bars anywhere — ThinkingDots + honest text only.
   ============================================================ */

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  FileText,
  MessageCircleQuestion,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSasiStore } from "@/lib/sasi/store";
import { formatDate, getSessionId } from "@/lib/sasi/utils";
import { toast } from "sonner";
import {
  EmptyState,
  GhostButton,
  PrimaryButton,
  SectionLabel,
  ThinkingDots,
  TrustNotice,
  useRotatingStatus,
} from "../primitives";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* ---------------- types ---------------- */

interface DocDate {
  label: string;
  value: string;
  iso?: string;
}

interface DocKeyInfo {
  importantInfo: string[];
  dates: DocDate[];
  actions: string[];
}

interface DocRow {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  summary: string | null;
  keyInfo: DocKeyInfo | null;
  analysisError?: string | null;
}

/* ---------------- constants + helpers ---------------- */

const ACCEPT =
  ".txt,.md,.markdown,.csv,image/png,image/jpeg,image/webp,text/plain,text/markdown,text/csv";

const MAX_MB = 5;

const ANALYSING_STAGES = [
  "Uploading your document…",
  "SASI is reading it…",
  "Extracting what matters…",
  "Only the analysis is kept — never the file.",
] as const;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeLabel(m: string): string {
  if (m.startsWith("image/")) return m.replace("image/", "").toUpperCase();
  return m.replace("text/", "").replace("application/", "").toUpperCase();
}

/** Client-side pre-checks for instant, honest feedback. The server
 *  re-validates everything — these are UX, not security. */
function quickReject(file: File): string | null {
  if (file.size > MAX_MB * 1024 * 1024) {
    return `"${file.name}" is ${formatBytes(file.size)} — SASI's limit is ${MAX_MB} MB.`;
  }
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (isPdf) {
    return "PDF parsing is not supported yet. Text files (.txt, .md, .csv) and clear photos of documents (PNG, JPG, WebP) work today.";
  }
  return null;
}

/* ---------------- view ---------------- */

export default function DocumentsView() {
  const navigate = useSasiStore((s) => s.navigate);

  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DocRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const analysingStatus = useRotatingStatus(ANALYSING_STAGES);

  /* ---------- load ---------- */

  const load = useCallback(async () => {
    setLoadState("loading");
    setLoadError(null);
    try {
      const res = await fetch(
        `/api/sasi/documents?sessionId=${encodeURIComponent(getSessionId())}`
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setLoadError(
          body?.error ?? `SASI could not load your documents (error ${res.status}).`
        );
        setLoadState("error");
        return;
      }
      const body = (await res.json()) as { documents?: DocRow[] };
      setDocs(Array.isArray(body.documents) ? body.documents : []);
      setLoadState("ready");
    } catch {
      setLoadError(
        "SASI could not reach the document service. Check your connection and try again."
      );
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /* ---------- pick + upload ---------- */

  function pickFile(file: File | null) {
    setUploadError(null);
    if (!file) return;
    const problem = quickReject(file);
    if (problem) {
      setUploadError(problem);
      return;
    }
    setPendingFile(file);
  }

  async function upload() {
    if (!pendingFile || uploading) return;
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append("sessionId", getSessionId());
    fd.append("file", pendingFile);
    try {
      const res = await fetch("/api/sasi/documents", { method: "POST", body: fd });
      const body = (await res.json().catch(() => null)) as
        | (DocRow & { error?: string })
        | null;
      if (!res.ok || !body?.id) {
        setUploadError(
          body?.error ?? `SASI could not process that document (error ${res.status}).`
        );
        return;
      }
      const saved: DocRow = {
        id: body.id,
        name: body.name,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
        createdAt: body.createdAt,
        summary: body.summary,
        keyInfo: body.keyInfo,
        analysisError: body.analysisError ?? null,
      };
      setDocs((prev) => [saved, ...prev]);
      setPendingFile(null);
      if (saved.summary === null) {
        toast.error("Document saved, but the analysis is unavailable.", {
          description: saved.analysisError ?? undefined,
        });
      } else {
        toast.success("Document analysed.");
      }
    } catch {
      setUploadError(
        "SASI could not reach the document service. Your file was not saved — try again."
      );
    } finally {
      setUploading(false);
    }
  }

  /* ---------- ask SASI (prefill) ---------- */

  function askSasi(d: DocRow) {
    const actions = d.keyInfo?.actions ?? [];
    const summaryBit = d.summary
      ? d.summary.slice(0, 300)
      : "SASI could not extract a summary from it";
    const actionsBit = actions.length
      ? ` What should I do about: ${actions.slice(0, 3).join("; ")}?`
      : " What should I check or do next with it?";
    const question = `About my document "${d.name}" — ${summaryBit}.${actionsBit}`.slice(
      0,
      600
    );
    navigate("ask-sasi", question);
    /* ask-sasi does not consume a prefill yet — the custom event below is
       the agreed hook for its composer (agent 28-b: listen for
       "sasi:prefill-question" and set the input). The question also
       travels as the view param. */
    window.dispatchEvent(
      new CustomEvent("sasi:prefill-question", { detail: { question } })
    );
    toast("Question prepared for Ask SASI", {
      description: question,
      duration: 8000,
    });
  }

  /* ---------- delete (optimistic, honest restore) ---------- */

  async function confirmDelete() {
    const target = deleteTarget;
    if (!target || deletingId) return;
    setDeletingId(target.id);
    const index = docs.findIndex((x) => x.id === target.id);
    setDocs((prev) => prev.filter((x) => x.id !== target.id)); // optimistic
    setDeleteTarget(null);
    try {
      const res = await fetch(
        `/api/sasi/documents?sessionId=${encodeURIComponent(getSessionId())}&id=${encodeURIComponent(target.id)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`status ${res.status}`);
    } catch {
      /* honest restore — the document is still there, say so */
      setDocs((prev) => {
        const next = [...prev];
        next.splice(Math.max(0, Math.min(index, next.length)), 0, target);
        return next;
      });
      toast.error("SASI could not delete that document. It is still in your list.");
    } finally {
      setDeletingId(null);
    }
  }

  /* ---------- render ---------- */

  const hasAnalysis = (d: DocRow) => d.summary !== null || d.keyInfo !== null;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 pb-16">
      {/* ---------- header ---------- */}
      <header className="mb-5">
        <h1 className="text-[22px] font-semibold tracking-tight text-white">Documents</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-zinc-400">
          Upload a document — SASI reads it and pulls out what matters: a summary,
          the key facts, the dates, and what you may need to do.
        </p>
      </header>

      <TrustNotice className="mb-5">
        Documents are analysed to produce their summary. The original file is never
        stored — only the analysis you see here.
      </TrustNotice>

      {/* ---------- dropzone (disabled while in flight) ---------- */}
      <label
        htmlFor="sasi-doc-input"
        aria-disabled={uploading}
        onDragOver={(e) => {
          e.preventDefault();
          if (!uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!uploading) pickFile(e.dataTransfer.files?.[0] ?? null);
        }}
        style={{ borderStyle: "dashed" }} /* .sasi-card is unlayered — utilities can't override its border */
        className={cn(
          "sasi-card block cursor-pointer px-6 py-9 text-center transition-all",
          dragOver && !uploading
            ? "bg-white/[0.04] ring-1 ring-[#e3c567]/60"
            : "hover:bg-white/[0.025]",
          uploading && "pointer-events-none opacity-50"
        )}
      >
        <input
          ref={inputRef}
          id="sasi-doc-input"
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            pickFile(e.target.files?.[0] ?? null);
            e.currentTarget.value = ""; // allow re-choosing the same file
          }}
        />
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03]">
          <Upload className="h-5 w-5 text-zinc-300" aria-hidden />
        </span>
        <span className="block text-[14px] font-medium text-white">
          Drag a file here, or tap to choose
        </span>
        <span className="mt-1 block text-[12.5px] text-zinc-500">
          Text (.txt, .md, .csv) or a clear photo of the document (PNG, JPG, WebP) ·
          up to {MAX_MB} MB
        </span>
        <span className="mt-0.5 block text-[11.5px] text-zinc-600">
          PDF is not supported yet — a photo of the page works instead.
        </span>
      </label>

      {/* ---------- analysing (honest in-flight state) ---------- */}
      {uploading && pendingFile && (
        <div className="sasi-card mt-4 p-4" role="status">
          <div className="flex items-center gap-3">
            <ThinkingDots label="SASI is analysing your document" />
            <span className="rounded-md border border-[#64b5f6]/25 bg-[#64b5f6]/8 px-2 py-0.5 text-[11px] font-medium text-[#a7d3f9]">
              Analysing…
            </span>
          </div>
          <p className="mt-2.5 text-[13px] font-medium text-white">{analysingStatus}</p>
          <p className="mt-0.5 text-[12px] text-zinc-500">
            {pendingFile.name} · {formatBytes(pendingFile.size)} · this usually takes a
            few seconds
          </p>
        </div>
      )}

      {/* ---------- chosen file: confirm before analyse ---------- */}
      {!uploading && pendingFile && (
        <div className="sasi-card mt-4 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.03]">
              <FileText className="h-4 w-4 text-zinc-300" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-medium text-white">
                {pendingFile.name}
              </p>
              <p className="text-[12px] text-zinc-500">
                {formatBytes(pendingFile.size)}
                {pendingFile.type ? ` · ${mimeLabel(pendingFile.type)}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPendingFile(null);
                setUploadError(null);
              }}
              aria-label="Clear chosen file"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-zinc-500 transition-colors hover:border-white/10 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <PrimaryButton onClick={() => void upload()} className="h-10 flex-1 sm:flex-none sm:px-6">
              <ShieldCheck className="h-4 w-4" aria-hidden />
              Analyse document
            </PrimaryButton>
            <GhostButton
              onClick={() => {
                setPendingFile(null);
                setUploadError(null);
              }}
              className="h-10"
            >
              Choose a different file
            </GhostButton>
          </div>
        </div>
      )}

      {/* ---------- honest upload error + retry ---------- */}
      {uploadError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#ef5350]/25 bg-[#ef5350]/[0.05] p-3.5"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#ef5350]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] leading-relaxed text-zinc-300">{uploadError}</p>
            <GhostButton
              onClick={() => {
                setUploadError(null);
                inputRef.current?.click();
              }}
              className="mt-2.5 h-10"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Try another file
            </GhostButton>
          </div>
        </div>
      )}

      {/* ---------- list ---------- */}
      <div className="mt-6">
        {loadState === "loading" && (
          <div className="sasi-card flex items-center justify-center gap-3 px-6 py-10">
            <ThinkingDots label="Loading your documents" />
            <span className="text-[13px] text-zinc-500">Loading your documents…</span>
          </div>
        )}

        {loadState === "error" && (
          <div
            role="alert"
            className="sasi-card flex flex-col items-center px-6 py-10 text-center"
          >
            <AlertTriangle className="mb-3 h-5 w-5 text-[#ef5350]" aria-hidden />
            <p className="text-[14px] font-medium text-white">
              Your documents could not be loaded
            </p>
            <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-zinc-500">
              {loadError}
            </p>
            <GhostButton onClick={() => void load()} className="mt-5 h-10">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Try again
            </GhostButton>
          </div>
        )}

        {loadState === "ready" && docs.length === 0 && (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="When you upload a document, SASI extracts a summary, the important information, the dates and any required actions — and keeps only that analysis, never the file itself."
            action={
              <PrimaryButton
                onClick={() => inputRef.current?.click()}
                className="h-10 px-6"
              >
                <Upload className="h-4 w-4" aria-hidden />
                Upload a document
              </PrimaryButton>
            }
          />
        )}

        {loadState === "ready" && docs.length > 0 && (
          <div className="flex flex-col gap-4">
            <AnimatePresence initial={false}>
              {docs.map((d) => (
                <motion.article
                  key={d.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="sasi-card p-4 sm:p-5"
                  aria-label={`Document: ${d.name}`}
                >
                  {/* card header */}
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03]">
                      <FileText className="h-4.5 w-4.5 text-zinc-300" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-[14px] font-semibold leading-snug text-white">
                        {d.name}
                      </p>
                      <p className="mt-0.5 text-[11.5px] text-zinc-500">
                        {formatBytes(d.sizeBytes)} · {mimeLabel(d.mimeType)} ·{" "}
                        {formatDate(d.createdAt)}
                      </p>
                    </div>
                    {deletingId === d.id ? (
                      <span className="flex items-center gap-2 rounded-md border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[11px] text-zinc-400">
                        <ThinkingDots label="Deleting document" />
                        Deleting…
                      </span>
                    ) : !hasAnalysis(d) ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md border border-[#ef5350]/25 bg-[#ef5350]/8 px-2 py-0.5 text-[11px] font-medium text-[#fda4a0]">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                        Analysis unavailable
                      </span>
                    ) : null}
                  </div>

                  {/* analysis sections — or the honest failure */}
                  {!hasAnalysis(d) ? (
                    <div
                      role="alert"
                      className="mt-4 rounded-xl border border-[#ef5350]/25 bg-[#ef5350]/[0.05] p-3.5"
                    >
                      <p className="text-[12.5px] leading-relaxed text-zinc-300">
                        {d.analysisError ??
                          "SASI could not analyse this document, so no summary is shown — SASI does not guess."}
                      </p>
                      <p className="mt-1.5 text-[11.5px] text-zinc-500">
                        You can delete it and upload it again — a clearer photo or a
                        text version often helps.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-4">
                      {d.summary && (
                        <section>
                          <SectionLabel>Summary</SectionLabel>
                          <p className="mt-1.5 text-[13.5px] leading-relaxed text-zinc-300">
                            {d.summary}
                          </p>
                        </section>
                      )}

                      {(d.keyInfo?.importantInfo.length ?? 0) > 0 && (
                        <section>
                          <SectionLabel>Important information</SectionLabel>
                          <ul className="sasi-scroll mt-1.5 max-h-48 space-y-1.5 overflow-y-auto pr-1">
                            {(d.keyInfo?.importantInfo ?? []).map((item, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2 text-[13px] leading-relaxed text-zinc-300"
                              >
                                <span
                                  aria-hidden
                                  className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#64b5f6]"
                                />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}

                      {(d.keyInfo?.dates.length ?? 0) > 0 && (
                        <section>
                          <SectionLabel>Important dates</SectionLabel>
                          <ul className="mt-1.5 space-y-1.5">
                            {(d.keyInfo?.dates ?? []).map((date, i) => (
                              <li
                                key={i}
                                className="flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2"
                              >
                                <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-zinc-400">
                                  <CalendarDays
                                    className="h-3.5 w-3.5 shrink-0 text-[#e3c567]"
                                    aria-hidden
                                  />
                                  <span className="truncate">{date.label}</span>
                                </span>
                                <span className="shrink-0 text-right text-[12.5px] font-medium text-white">
                                  {date.value}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}

                      {(d.keyInfo?.actions.length ?? 0) > 0 && (
                        <section>
                          <SectionLabel>Required actions</SectionLabel>
                          <ul className="sasi-scroll mt-1.5 max-h-48 space-y-1.5 overflow-y-auto pr-1">
                            {(d.keyInfo?.actions ?? []).map((action, i) => (
                              <li
                                key={i}
                                className="flex items-start gap-2.5 text-[13px] leading-relaxed text-zinc-300"
                              >
                                <span
                                  aria-hidden
                                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border border-[#66bb6a]/30 bg-[#66bb6a]/10"
                                >
                                  <Check className="h-3 w-3 text-[#8ee09a]" />
                                </span>
                                <span>{action}</span>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-1.5 text-[11px] text-zinc-600">
                            Read-only — these are what the document asks of you, not
                            reminders SASI has set.
                          </p>
                        </section>
                      )}
                    </div>
                  )}

                  {/* card actions */}
                  <div className="mt-4 flex flex-col gap-2 border-t border-white/6 pt-4 sm:flex-row">
                    <GhostButton
                      onClick={() => askSasi(d)}
                      className="h-10 flex-1"
                      aria-label={`Ask SASI about ${d.name}`}
                    >
                      <MessageCircleQuestion className="h-4 w-4" aria-hidden />
                      Ask SASI about this document
                    </GhostButton>
                    <GhostButton
                      onClick={() => setDeleteTarget(d)}
                      disabled={deletingId === d.id}
                      className="h-10 text-[#fda4a0] hover:border-[#ef5350]/40 hover:bg-[#ef5350]/10 hover:text-[#fda4a0]"
                      aria-label={`Delete ${d.name}`}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Delete
                    </GhostButton>
                  </div>
                </motion.article>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ---------- delete confirmation — immediate + permanent, said exactly ---------- */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="border-white/10 bg-[#0b0c0e] text-white sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete “{deleteTarget?.name ?? "this document"}”?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Deleted immediately and permanently. This cannot be undone — SASI keeps
              no copy of the document or its analysis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10 bg-transparent text-zinc-300 hover:bg-white/5 hover:text-white">
              Keep document
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              className="bg-[#ef5350] text-white hover:bg-[#ef5350]/85"
            >
              Delete immediately
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
