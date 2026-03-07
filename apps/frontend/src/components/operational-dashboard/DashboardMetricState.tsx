"use client";

import { cn } from "@/lib/utils";
import type { DashboardMetric } from "@/components/operational-dashboard/dashboard.utils";

type DashboardMetricStateTone = "neutral" | "warn" | "danger";

type DashboardMetricStateViewModel = {
  title: string;
  description: string;
  tone: DashboardMetricStateTone;
};

const toneClassName: Record<DashboardMetricStateTone, string> = {
  neutral: "border-slate-200/80 bg-slate-50/80 text-slate-700 dark:border-slate-800/80 dark:bg-slate-900/50 dark:text-slate-200",
  warn: "border-amber-200/80 bg-amber-50/90 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-100",
  danger: "border-rose-200/80 bg-rose-50/90 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/35 dark:text-rose-100",
};

export function resolveDashboardMetricState(
  metric: DashboardMetric | null | undefined,
): DashboardMetricStateViewModel | null {
  const status = String(metric?.status || "").trim().toLowerCase();

  if (status === "ok" || status === "healthy") {
    return null;
  }

  if (status === "degraded") {
    return {
      title: "Degradado",
      description: "Dados parciais neste ciclo.",
      tone: "warn",
    };
  }

  if (status === "error" || status === "down" || status === "unavailable") {
    return {
      title: "Indisponivel",
      description: "Tentando recuperar.",
      tone: "danger",
    };
  }

  return {
    title: "Sem dados",
    description: "Sem leitura disponivel.",
    tone: "neutral",
  };
}

export function DashboardMetricState({
  metric,
  className,
}: {
  metric: DashboardMetric | null | undefined;
  className?: string;
}) {
  const state = resolveDashboardMetricState(metric);

  if (!state) {
    return null;
  }

  return (
    <div
      className={cn(
        "mt-auto flex min-h-[5.5rem] flex-1 items-end",
        className,
      )}
      data-testid="dashboard-metric-state"
      data-tone={state.tone}
    >
      <div className={cn("w-full rounded-2xl border px-3 py-2.5", toneClassName[state.tone])}>
        <p className="text-sm font-semibold tracking-tight">{state.title}</p>
        <p className="mt-1 text-[11px] leading-relaxed opacity-80">{state.description}</p>
      </div>
    </div>
  );
}
