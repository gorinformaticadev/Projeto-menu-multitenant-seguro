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
  neutral: "border-skin-border/80 bg-skin-surface/80 text-skin-text",
  warn: "border-skin-warning/30 bg-skin-warning/10 text-skin-warning",
  danger: "border-skin-danger/30 bg-skin-danger/10 text-skin-danger",
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

export function DashboardSurfaceState({
  title,
  description,
  tone = "neutral",
  className,
  centered = false,
}: {
  title: string;
  description: string;
  tone?: DashboardMetricStateTone;
  className?: string;
  centered?: boolean;
}) {
  return (
    <div
      className={cn(
        "w-full rounded-2xl border px-3 py-2.5",
        centered && "flex min-h-[5.5rem] flex-col items-center justify-center text-center",
        toneClassName[tone],
        className,
      )}
      data-testid="dashboard-surface-state"
      data-tone={tone}
    >
      <p className="text-sm font-semibold tracking-tight">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed opacity-80">{description}</p>
    </div>
  );
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
      <DashboardSurfaceState
        title={state.title}
        description={state.description}
        tone={state.tone}
      />
    </div>
  );
}
