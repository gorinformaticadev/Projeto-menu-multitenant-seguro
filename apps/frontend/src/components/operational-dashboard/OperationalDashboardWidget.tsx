"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { EyeOff, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type WidgetTone = "neutral" | "good" | "warn" | "danger" | "modern";

interface OperationalDashboardWidgetProps {
  id: string;
  title: string;
  subtitle?: string;
  tone?: WidgetTone;
  isEditing?: boolean;
  onHide?: (id: string) => void;
  onSelect?: () => void;
  actionLabel?: string;
  noPadding?: boolean;
  compact?: boolean;
  children: ReactNode;
}

const toneClassName: Record<WidgetTone, string> = {
  neutral:
    "border-slate-200/80 bg-white/90 text-slate-950 shadow-[0_20px_50px_-32px_rgba(15,23,42,0.35)] dark:border-slate-800/80 dark:bg-slate-950/55 dark:text-slate-50",
  modern:
    "border-slate-900/80 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.2),_transparent_40%),linear-gradient(145deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.96))] text-slate-50 shadow-[0_28px_60px_-36px_rgba(37,99,235,0.55)]",
  good:
    "border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/90 to-emerald-100/80 text-slate-950 shadow-[0_18px_45px_-30px_rgba(16,185,129,0.45)] dark:border-emerald-900/60 dark:bg-gradient-to-br dark:from-emerald-950/40 dark:via-slate-950/65 dark:to-slate-950/55 dark:text-slate-50",
  warn:
    "border-amber-200/80 bg-gradient-to-br from-white via-amber-50/90 to-amber-100/80 text-slate-950 shadow-[0_18px_45px_-30px_rgba(245,158,11,0.45)] dark:border-amber-900/60 dark:bg-gradient-to-br dark:from-amber-950/45 dark:via-slate-950/65 dark:to-slate-950/55 dark:text-slate-50",
  danger:
    "border-rose-200/80 bg-gradient-to-br from-white via-rose-50/90 to-rose-100/80 text-slate-950 shadow-[0_18px_45px_-30px_rgba(244,63,94,0.4)] dark:border-rose-900/60 dark:bg-gradient-to-br dark:from-rose-950/45 dark:via-slate-950/65 dark:to-slate-950/55 dark:text-slate-50",
};

const toneDotClassName: Record<WidgetTone, string> = {
  neutral: "bg-slate-400 dark:bg-slate-500",
  modern: "bg-blue-400",
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  danger: "bg-rose-500",
};

const subtitleClassName: Record<WidgetTone, string> = {
  neutral: "text-slate-500 dark:text-slate-400",
  modern: "text-slate-400",
  good: "text-emerald-700/90 dark:text-emerald-200/80",
  warn: "text-amber-700/90 dark:text-amber-200/80",
  danger: "text-rose-700/90 dark:text-rose-200/80",
};

function isNestedInteractiveElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      "button, a, input, select, textarea, [role='button'], [role='link'], [data-dashboard-stop-select='true']",
    ),
  );
}

export function OperationalDashboardWidget({
  id,
  title,
  subtitle,
  tone = "neutral",
  isEditing = false,
  onHide,
  onSelect,
  actionLabel,
  noPadding = false,
  compact = false,
  children,
}: OperationalDashboardWidgetProps) {
  const isInteractive = Boolean(onSelect) && !isEditing;
  const handleSelect = (event: MouseEvent<HTMLDivElement>) => {
    if (
      !isInteractive ||
      (event.currentTarget !== event.target && isNestedInteractiveElement(event.target))
    ) {
      return;
    }

    onSelect?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive) {
      return;
    }

    if (event.currentTarget !== event.target && isNestedInteractiveElement(event.target)) {
      return;
    }

    if (
      event.key === "Enter" ||
      event.key === " " ||
      event.key === "Spacebar" ||
      event.code === "Space" ||
      event.keyCode === 32
    ) {
      event.preventDefault();
      onSelect?.();
    }
  };

  return (
    <Card
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? actionLabel || `Abrir ${title}` : undefined}
      onClick={isInteractive ? handleSelect : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      className={cn(
        "relative flex h-full flex-col overflow-hidden rounded-[24px] border backdrop-blur-sm transition-all duration-200",
        toneClassName[tone],
        isInteractive &&
          "cursor-pointer hover:-translate-y-0.5 hover:border-blue-300/70 hover:shadow-[0_30px_70px_-40px_rgba(37,99,235,0.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950",
        isEditing && "ring-1 ring-blue-300/70 shadow-[0_0_0_1px_rgba(59,130,246,0.18)]",
      )}
    >
      <div className="pointer-events-none absolute inset-x-8 top-[-3.5rem] h-24 rounded-full bg-white/15 blur-3xl dark:bg-blue-400/10" />
      <CardHeader className={cn("relative z-10 p-4 pb-2", compact && !noPadding && "p-3 pb-1")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            {isEditing ? (
              <div className="dashboard-drag-handle mt-0.5 flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg border border-slate-200/70 bg-white/80 text-slate-500 backdrop-blur-sm active:cursor-grabbing dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                <GripVertical className="h-4 w-4" />
              </div>
            ) : null}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn("inline-flex h-2.5 w-2.5 shrink-0 rounded-full", toneDotClassName[tone])} />
                <CardTitle className={cn(
                  "truncate text-[0.78rem] font-semibold uppercase tracking-[0.16em] text-current/90",
                  compact && "text-[0.7rem] tracking-[0.14em]",
                )}>
                  {title}
                </CardTitle>
              </div>
              {subtitle ? (
                <p className={cn("mt-1 truncate text-[11px] leading-tight", compact && "text-[10px]", subtitleClassName[tone])}>
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>

          {onHide && isEditing ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-xl text-muted-foreground hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
              onClick={() => onHide(id)}
              title="Ocultar widget"
              aria-label={`Ocultar widget ${title}`}
            >
              <EyeOff className="h-3.5 w-3.5" />
            </Button>
          ) : null}

          {isInteractive ? (
            <span className="hidden shrink-0 rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[10px] font-medium text-current/80 sm:inline-flex">
              {actionLabel || "Abrir"}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent
        className={cn(
          "relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden",
          noPadding ? "p-0" : "p-4 pt-0",
          compact && !noPadding && "p-3 pt-0",
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}

export function OperationalDashboardWidgetSkeleton({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <Card
      className="relative flex h-full flex-col overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/85 shadow-[0_20px_50px_-32px_rgba(15,23,42,0.2)] dark:border-slate-800/80 dark:bg-slate-950/45"
      data-testid="operational-dashboard-widget-skeleton"
    >
      <div className="pointer-events-none absolute inset-x-8 top-[-3.5rem] h-24 rounded-full bg-slate-200/60 blur-3xl dark:bg-slate-800/50" />
      <CardHeader className={cn("relative z-10 p-4 pb-2", compact && "p-3 pb-1")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <div className="mt-1 h-7 w-7 shrink-0 animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-800/80" />
            <div className="min-w-0 space-y-2">
              <div className="h-2.5 w-24 animate-pulse rounded-full bg-slate-200/80 dark:bg-slate-800/80" />
              <div className="h-2 w-20 animate-pulse rounded-full bg-slate-200/60 dark:bg-slate-800/60" />
            </div>
          </div>
          <div className="hidden h-5 w-14 animate-pulse rounded-full bg-slate-200/60 dark:bg-slate-800/60 sm:block" />
        </div>
      </CardHeader>
      <CardContent className={cn("relative z-10 flex flex-1 flex-col p-4 pt-0", compact && "p-3 pt-0")}>
        <div className="mt-auto space-y-3">
          <div className="h-8 w-20 animate-pulse rounded-2xl bg-slate-200/80 dark:bg-slate-800/80" />
          <div className="h-3 w-28 animate-pulse rounded-full bg-slate-200/60 dark:bg-slate-800/60" />
          <div className="h-16 animate-pulse rounded-[20px] bg-slate-100/80 dark:bg-slate-900/60" />
        </div>
      </CardContent>
    </Card>
  );
}
