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
  headerIcon?: ReactNode;
  isEditing?: boolean;
  onHide?: (id: string) => void;
  onSelect?: () => void;
  actionLabel?: string;
  headerActions?: ReactNode;
  noPadding?: boolean;
  compact?: boolean;
  children: ReactNode;
}

const toneClassName: Record<WidgetTone, string> = {
  neutral:
    "border-skin-border/85 bg-skin-surface/96 text-skin-text shadow-[0_16px_34px_-28px_rgba(15,23,42,0.18)]",
  modern:
    "border-skin-border-strong/90 bg-skin-surface/95 text-skin-text shadow-[0_22px_48px_-34px_rgba(37,99,235,0.28)]",
  good:
    "border-skin-success/30 bg-skin-surface/95 text-skin-text shadow-[0_16px_34px_-28px_rgba(16,185,129,0.18)]",
  warn:
    "border-skin-warning/30 bg-skin-surface/95 text-skin-text shadow-[0_16px_34px_-28px_rgba(245,158,11,0.18)]",
  danger:
    "border-skin-danger/30 bg-skin-surface/95 text-skin-text shadow-[0_16px_34px_-28px_rgba(244,63,94,0.18)]",
};

const toneDotClassName: Record<WidgetTone, string> = {
  neutral: "bg-skin-text-muted",
  modern: "bg-skin-info",
  good: "bg-skin-success",
  warn: "bg-skin-warning",
  danger: "bg-skin-danger",
};

const subtitleClassName: Record<WidgetTone, string> = {
  neutral: "text-skin-text-muted",
  modern: "text-skin-text-muted",
  good: "text-skin-success/90",
  warn: "text-skin-warning/90",
  danger: "text-skin-danger/90",
};

function isNestedInteractiveElement(
  target: EventTarget | null,
  currentTarget?: HTMLElement | null,
): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const interactiveElement = target.closest(
    "button, a, input, select, textarea, [role='button'], [role='link'], [data-dashboard-stop-select='true']",
  );

  if (!interactiveElement) {
    return false;
  }

  return interactiveElement !== currentTarget;
}

export function OperationalDashboardWidget({
  id,
  title,
  subtitle,
  tone = "neutral",
  headerIcon,
  isEditing = false,
  onHide,
  onSelect,
  actionLabel,
  headerActions,
  noPadding = false,
  compact = false,
  children,
}: OperationalDashboardWidgetProps) {
  const isInteractive = Boolean(onSelect) && !isEditing;
  const handleSelect = (event: MouseEvent<HTMLDivElement>) => {
    if (
      !isInteractive ||
      (event.currentTarget !== event.target &&
        isNestedInteractiveElement(event.target, event.currentTarget))
    ) {
      return;
    }

    onSelect?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isInteractive) {
      return;
    }

    if (
      event.currentTarget !== event.target &&
      isNestedInteractiveElement(event.target, event.currentTarget)
    ) {
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
          "cursor-pointer hover:-translate-y-0.5 hover:border-skin-info/70 hover:shadow-[0_20px_44px_-32px_rgba(37,99,235,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-skin-focus-ring/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        isEditing && "ring-1 ring-skin-info/70 shadow-[0_0_0_1px_rgba(59,130,246,0.18)]",
      )}
    >
      <div className="pointer-events-none absolute inset-x-8 top-[-3.5rem] h-24 rounded-full bg-skin-info/10 blur-3xl" />
      <CardHeader className={cn("relative z-10 p-4 pb-2", compact && !noPadding && "p-3 pb-1")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            {isEditing ? (
              <div className="dashboard-drag-handle mt-0.5 flex h-7 w-7 shrink-0 cursor-grab items-center justify-center rounded-lg border border-skin-border/70 bg-skin-surface/80 text-skin-text-muted backdrop-blur-sm active:cursor-grabbing">
                <GripVertical className="h-4 w-4" />
              </div>
            ) : null}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {headerIcon ? (
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-skin-border/80 bg-skin-background-elevated/85 text-skin-text">
                    {headerIcon}
                  </span>
                ) : (
                  <span className={cn("inline-flex h-2.5 w-2.5 shrink-0 rounded-full", toneDotClassName[tone])} />
                )}
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

          <div className="flex shrink-0 items-start gap-2">
            {headerActions ? (
              <div className="flex items-center gap-2" data-dashboard-stop-select="true">
                {headerActions}
              </div>
            ) : null}

            {onHide && isEditing ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 rounded-xl text-muted-foreground hover:bg-skin-background-elevated/70 hover:text-foreground"
                onClick={() => onHide(id)}
                title="Ocultar widget"
                aria-label={`Ocultar widget ${title}`}
              >
                <EyeOff className="h-3.5 w-3.5" />
              </Button>
            ) : null}

            {isInteractive ? (
              <span className="hidden shrink-0 rounded-full border border-skin-border/80 bg-skin-surface/75 px-2 py-0.5 text-[10px] font-medium text-skin-text-muted sm:inline-flex">
                {actionLabel || "Abrir"}
              </span>
            ) : null}
          </div>
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
      className="relative flex h-full flex-col overflow-hidden rounded-[24px] border border-skin-border/85 bg-skin-surface/96 shadow-[0_16px_34px_-28px_rgba(15,23,42,0.14)]"
      data-testid="operational-dashboard-widget-skeleton"
    >
      <div className="pointer-events-none absolute inset-x-8 top-[-3.5rem] h-24 rounded-full bg-skin-info/10 blur-3xl" />
      <CardHeader className={cn("relative z-10 p-4 pb-2", compact && "p-3 pb-1")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <div className="mt-1 h-7 w-7 shrink-0 animate-pulse rounded-lg bg-skin-border/80" />
            <div className="min-w-0 space-y-2">
              <div className="h-2.5 w-24 animate-pulse rounded-full bg-skin-border/80" />
              <div className="h-2 w-20 animate-pulse rounded-full bg-skin-border/60" />
            </div>
          </div>
          <div className="hidden h-5 w-14 animate-pulse rounded-full bg-skin-border/60 sm:block" />
        </div>
      </CardHeader>
      <CardContent className={cn("relative z-10 flex flex-1 flex-col p-4 pt-0", compact && "p-3 pt-0")}>
        <div className="mt-auto space-y-3">
          <div className="h-8 w-20 animate-pulse rounded-2xl bg-skin-border/80" />
          <div className="h-3 w-28 animate-pulse rounded-full bg-skin-border/60" />
          <div className="h-16 animate-pulse rounded-[20px] bg-skin-background-elevated/80" />
        </div>
      </CardContent>
    </Card>
  );
}
