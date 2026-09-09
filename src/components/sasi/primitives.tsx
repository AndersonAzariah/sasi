"use client";

import Image from "next/image";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Droplets,
  FileText,
  GraduationCap,
  HandCoins,
  HeartPulse,
  Landmark,
  Loader2,
  MapPin,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AIState,
  CaseStatus,
  Confidence,
  Priority,
  ServiceKey,
  TrustStatus,
} from "@/lib/sasi/types";
import {
  AI_STATE_META,
  CASE_STATUS_META,
  CONFIDENCE_META,
  PRIORITY_META,
  TRUST_STATUS_META,
} from "@/lib/sasi/utils";

/* ============================================================
   LOGO
   ============================================================ */

export function SasiLogo({
  size = 28,
  withWordmark = true,
  className,
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className="relative shrink-0 overflow-hidden rounded-[9px]"
        style={{ width: size, height: size }}
      >
        <Image
          src="/sasi-logo.png"
          alt="SASI logo"
          width={64}
          height={64}
          className="h-full w-full object-cover"
          priority
        />
      </span>
      {withWordmark && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-[0.18em] text-white">
            SASI
          </span>
        </span>
      )}
    </span>
  );
}

/* ============================================================
   STATUS BADGES — text + color, never color alone
   ============================================================ */

export function StatusBadge({
  status,
  size = "md",
  className,
}: {
  status: TrustStatus;
  size?: "sm" | "md";
  className?: string;
}) {
  const meta = TRUST_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-white/8 bg-white/[0.03] font-medium",
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        meta.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label.toUpperCase()}
    </span>
  );
}

export function CaseStatusBadge({
  status,
  className,
}: {
  status: CaseStatus;
  className?: string;
}) {
  const meta = CASE_STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium",
        meta.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label.toUpperCase()}
    </span>
  );
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  const meta = PRIORITY_META[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium",
        meta.text,
        className
      )}
    >
      <AlertTriangle className="h-3 w-3" aria-hidden />
      {meta.label.toUpperCase()}
    </span>
  );
}

export function ConfidenceBar({
  confidence,
  className,
}: {
  confidence: Confidence;
  className?: string;
}) {
  const meta = CONFIDENCE_META[confidence];
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-zinc-500">Confidence</span>
        <span className={cn("font-medium", meta.text)}>{meta.label}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full bg-white/40"
          style={{ width: meta.width }}
        />
      </div>
    </div>
  );
}

/* ============================================================
   SERVICE ICON
   ============================================================ */

const SERVICE_ICONS: Record<ServiceKey, typeof Droplets> = {
  water: Droplets,
  electricity: Zap,
  roads: MapPin,
  waste: Trash2,
  healthcare: HeartPulse,
  education: GraduationCap,
  housing: Landmark,
  documents: FileText,
  safety: ShieldCheck,
  "local-government": Landmark,
  other: BookOpen,
};

export function ServiceIcon({
  service,
  className,
}: {
  service: ServiceKey;
  className?: string;
}) {
  const Icon = SERVICE_ICONS[service] ?? BookOpen;
  return <Icon className={cn("h-4 w-4", className)} aria-hidden />;
}

export const SERVICE_TINT: Record<ServiceKey, string> = {
  water: "text-[#64b5f6]",
  electricity: "text-[#e3c567]",
  roads: "text-zinc-300",
  waste: "text-[#66bb6a]",
  healthcare: "text-[#ef5350]",
  education: "text-[#64b5f6]",
  housing: "text-[#e3c567]",
  documents: "text-zinc-300",
  safety: "text-[#ef5350]",
  "local-government": "text-zinc-300",
  other: "text-zinc-400",
};

/* ============================================================
   AI STATE CHIP
   ============================================================ */

const AI_TONE_CLASS: Record<string, string> = {
  blue: "text-[#a7d3f9] border-[#64b5f6]/25 bg-[#64b5f6]/8",
  gold: "text-[#efe0a8] border-[#e3c567]/25 bg-[#e3c567]/8",
  green: "text-[#8ee09a] border-[#66bb6a]/25 bg-[#66bb6a]/8",
  red: "text-[#fda4a0] border-[#ef5350]/25 bg-[#ef5350]/8",
  grey: "text-zinc-400 border-white/8 bg-white/[0.03]",
  multi: "text-[#efe0a8] border-[#e3c567]/25 bg-[#e3c567]/8",
};

export function AIStateChip({
  state,
  className,
}: {
  state: AIState;
  className?: string;
}) {
  const meta = AI_STATE_META[state];
  const active =
    state !== "IDLE" && state !== "COMPLETE" && state !== "PAUSED";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        AI_TONE_CLASS[meta.tone],
        className
      )}
    >
      {active ? (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      ) : state === "COMPLETE" ? (
        <span className="h-1.5 w-1.5 rounded-full bg-[#66bb6a]" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
      )}
      <span className={active && meta.tone === "multi" ? "sasi-shimmer-text" : undefined}>
        AI: {meta.label.toUpperCase()}
      </span>
    </span>
  );
}

/* ============================================================
   DEMO BADGE — data honesty
   ============================================================ */

export function DemoBadge({
  label = "DEMO DATA",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border border-[#e3c567]/30 bg-[#e3c567]/8 px-1.5 py-px font-mono text-[9px] font-semibold tracking-[0.14em] text-[#e3c567]",
        className
      )}
      title="This is demonstration data, not live information."
    >
      {label}
    </span>
  );
}

/* ============================================================
   LAYOUT PRIMITIVES
   ============================================================ */

export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500",
        className
      )}
    >
      {children}
    </p>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-white">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-[13px] text-zinc-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: typeof Droplets;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sasi-card flex flex-col items-center justify-center px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-white/8 bg-white/[0.03]">
        <Icon className="h-5 w-5 text-zinc-400" aria-hidden />
      </div>
      <p className="text-[14px] font-medium text-white">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-zinc-500">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ============================================================
   STAT TILE — with mount count-up (respects reduced motion)
   ============================================================ */

/** Animate 0 → target once on mount. Hydration-safe: first paint = target,
 *  then the animation catches the eye without a mismatched flash.
 *  All state updates happen inside rAF callbacks (never in the effect body). */
function useCountUp(target: number, duration = 650): number {
  const [value, setValue] = useState(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || target === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic; t=1 → exactly target
      setValue(Math.round(target * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "red" | "green" | "gold" | "blue";
  className?: string;
}) {
  const toneText =
    tone === "red"
      ? "text-[#fda4a0]"
      : tone === "green"
        ? "text-[#8ee09a]"
        : tone === "gold"
          ? "text-[#efe0a8]"
          : tone === "blue"
            ? "text-[#a7d3f9]"
            : "text-white";
  const animated = useCountUp(typeof value === "number" ? value : 0);
  const display = typeof value === "number" ? animated : value;
  return (
    <div className={cn("sasi-card group/tile relative overflow-hidden p-4", className)}>
      {/* tone light that blooms on hover — detail, not paint */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-5 -top-5 h-16 w-16 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover/tile:opacity-100",
          tone === "red" && "bg-[#ef5350]/15",
          tone === "green" && "bg-[#66bb6a]/15",
          tone === "gold" && "bg-[#e3c567]/15",
          tone === "blue" && "bg-[#64b5f6]/15",
          tone === "default" && "bg-white/[0.07]"
        )}
      />
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-[26px] font-semibold leading-none tracking-tight tabular-nums",
          toneText
        )}
      >
        {display}
      </p>
      {hint && <p className="mt-2 text-[11px] text-zinc-600">{hint}</p>}
    </div>
  );
}

/* ============================================================
   PULSE WRAPPER — animated 1px national-light perimeter
   ============================================================ */

export function SasiPulse({
  children,
  color = "multi",
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  color?: "red" | "blue" | "green" | "gold" | "multi";
  className?: string;
  as?: "div" | "section" | "aside";
}) {
  return (
    <Tag className={cn("sasi-pulse", `sasi-pulse-${color}`, className)}>
      {children}
    </Tag>
  );
}

/* ============================================================
   SKELETONS
   ============================================================ */

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("sasi-card space-y-3 p-4", className)}>
      <div className="h-3 w-1/3 animate-pulse rounded bg-white/6" />
      <div className="h-3 w-3/4 animate-pulse rounded bg-white/5" />
      <div className="h-2 w-1/2 animate-pulse rounded bg-white/4" />
    </div>
  );
}

export function ListSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/* ============================================================
   BUTTONS (SASI-style wrappers around standard classes)
   ============================================================ */

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "sasi-btn-sheen inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-white px-4 text-[13px] font-medium text-black transition-all hover:bg-zinc-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/10 bg-transparent px-4 text-[13px] font-medium text-zinc-300 transition-all hover:border-white/20 hover:bg-white/[0.04] hover:text-white active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
