"use client";

import { useMemo } from "react";

/* ============================================================
   RichText — SASI's shared markdown-lite renderer.
   Supports exactly what the assistant / briefing surfaces emit:
     **bold**         → semibold white
     *italic*         → italic (used for honest "(Stopped…)" notes)
     ## / ### heading → compact bold heading
     - / • bullets    → gold dot list items
     1. numbered      → gold number list items
     > quote          → gold hairline quote block
     CASE-xxxxxx /    → clickable mono chips (onRef)
     INC-xxxx
   Used by Ask SASI chat, the City briefing card and the
   evidence photo-analysis panel so every AI surface reads
   the same way.
   ============================================================ */

export function Inline({
  text,
  onRef,
}: {
  text: string;
  onRef?: (ref: string) => void;
}) {
  const parts = useMemo(() => text.split(/(\*\*[^*]+\*\*|\*[^*\n]+\*)/g), [text]);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
          return (
            <strong key={i} className="font-semibold text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        if (
          part.startsWith("*") &&
          part.endsWith("*") &&
          part.length > 2 &&
          !part.startsWith("**")
        ) {
          return (
            <em key={i} className="text-zinc-500">
              {part.slice(1, -1)}
            </em>
          );
        }
        const refBits = part.split(/(CASE-\d{6}|INC-\d{4})/g);
        return (
          <span key={i}>
            {refBits.map((bit, j) => {
              if (/^(CASE-\d{6}|INC-\d{4})$/.test(bit)) {
                return onRef ? (
                  <button
                    key={j}
                    onClick={() => onRef(bit)}
                    className="mx-0.5 inline-flex h-[19px] items-center rounded border border-white/12 bg-white/[0.05] px-1.5 align-baseline font-mono text-[10.5px] font-medium text-zinc-200 transition hover:border-[#e3c567]/45 hover:text-white"
                    aria-label={`Open ${bit}`}
                  >
                    {bit}
                  </button>
                ) : (
                  <span
                    key={j}
                    className="mx-0.5 inline-flex h-[19px] items-center rounded border border-white/12 bg-white/[0.05] px-1.5 align-baseline font-mono text-[10.5px] font-medium text-zinc-200"
                  >
                    {bit}
                  </span>
                );
              }
              return <span key={j}>{bit}</span>;
            })}
          </span>
        );
      })}
    </>
  );
}

export function RichText({
  content,
  onRef,
  className,
}: {
  content: string;
  onRef?: (ref: string) => void;
  className?: string;
}) {
  const lines = content.split("\n");
  return (
    <div className={className ?? "space-y-1.5"}>
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} className="h-1" />;
        /* headings — "## " and "### " */
        const h = /^(#{2,3})\s+(.*)$/.exec(t);
        if (h) {
          return (
            <p key={i} className="pt-1 text-[13.5px] font-semibold leading-snug text-white">
              <Inline text={h[2]} onRef={onRef} />
            </p>
          );
        }
        /* quote — "> " */
        if (t.startsWith("> ")) {
          return (
            <blockquote
              key={i}
              className="rounded-r-md border-l-2 border-[#e3c567]/50 bg-white/[0.03] py-1.5 pl-2.5 pr-2 text-zinc-400"
            >
              <Inline text={t.slice(2)} onRef={onRef} />
            </blockquote>
          );
        }
        /* bullets */
        if (t.startsWith("- ") || t.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2.5">
              <span
                className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#e3c567]/70"
                aria-hidden
              />
              <p className="min-w-0 flex-1">
                <Inline text={t.slice(2)} onRef={onRef} />
              </p>
            </div>
          );
        }
        /* numbered list — "1. " etc. */
        const num = /^(\d{1,2})[.)]\s+(.*)$/.exec(t);
        if (num) {
          return (
            <div key={i} className="flex gap-2.5">
              <span
                className="mt-px flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border border-[#e3c567]/25 bg-[#e3c567]/[0.08] text-[9.5px] font-semibold leading-none text-[#e3c567]"
                aria-hidden
              >
                {num[1]}
              </span>
              <p className="min-w-0 flex-1">
                <Inline text={num[2]} onRef={onRef} />
              </p>
            </div>
          );
        }
        return (
          <p key={i} className="min-w-0">
            <Inline text={t} onRef={onRef} />
          </p>
        );
      })}
    </div>
  );
}
