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

function getMetricMessage(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
}

function humanizeMetricDetail(detail: unknown): string | null {
  const normalized = getMetricMessage(detail);
  if (!normalized) {
    return null;
  }

  switch (normalized) {
    case "redis-connection-refused":
      return "Redis local nao esta acessivel neste ambiente.";
    case "redis-timeout":
      return "Redis demorou acima do limite operacional deste ciclo.";
    case "redis-dns-resolution-failed":
      return "Host do Redis nao pode ser resolvido neste ambiente.";
    case "redis-cluster-partial-unavailable":
      return "Cluster Redis esta parcialmente indisponivel.";
    case "redis-sentinel-unreachable":
      return "Os sentinels do Redis estao indisponiveis.";
    case "redis-sentinels-missing":
      return "Sentinels do Redis nao foram configurados.";
    case "redis-standalone-host-missing":
      return "Host Redis nao configurado neste ambiente.";
    case "redis-topology-invalid":
      return "A topologia Redis configurada para este ambiente e invalida.";
    case "redis-ping-failed":
      return "Redis nao respondeu ao health check deste ciclo.";
    case "redis-ping-unexpected-response":
      return "Redis respondeu de forma inesperada ao health check.";
    default:
      return normalized;
  }
}

export function resolveDashboardMetricState(
  metric: DashboardMetric | null | undefined,
): DashboardMetricStateViewModel | null {
  const status = String(metric?.status || "").trim().toLowerCase();
  const contextualMessage =
    getMetricMessage(metric?.error) || humanizeMetricDetail(metric?.detail);

  if (status === "ok" || status === "healthy") {
    return null;
  }

  if (status === "degraded") {
    return {
      title: "Degradado",
      description: contextualMessage || "Dados parciais neste ciclo.",
      tone: "warn",
    };
  }

  if (status === "error" || status === "down" || status === "unavailable") {
    return {
      title: "Indisponivel",
      description: contextualMessage || "Tentando recuperar.",
      tone: "danger",
    };
  }

  if (status === "not_configured") {
    return {
      title: "Nao configurado",
      description: contextualMessage || "Dependencia opcional nao configurada neste ambiente.",
      tone: "neutral",
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
