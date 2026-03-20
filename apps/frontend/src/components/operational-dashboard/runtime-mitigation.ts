import type { SystemDashboardResponse } from "@contracts/dashboard";

type RuntimeMitigation = SystemDashboardResponse["runtimeMitigation"];

export type RuntimeMitigationBanner = {
  tone: "info" | "warn";
  title: string;
  message: string;
  detail: string | null;
};

function firstMeaningfulItem(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  for (const item of value) {
    const normalized = String(item || "").trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function hasOperationalPressure(runtimeMitigation: RuntimeMitigation): boolean {
  return (
    runtimeMitigation.degradeHeavyFeatures ||
    runtimeMitigation.disableRemoteUpdateChecks ||
    runtimeMitigation.rejectHeavyMutations ||
    runtimeMitigation.adaptiveThrottleFactor < 1 ||
    runtimeMitigation.overloadedInstances > 0 ||
    runtimeMitigation.pressureCause !== "normal"
  );
}

export function resolveRuntimeMitigationBanner(
  runtimeMitigation: RuntimeMitigation | null | undefined,
): RuntimeMitigationBanner | null {
  if (!runtimeMitigation) {
    return null;
  }

  const featureFlags = Array.isArray(runtimeMitigation.featureFlags)
    ? runtimeMitigation.featureFlags
    : [];
  const businessImpact = firstMeaningfulItem(runtimeMitigation.businessImpact);
  const localFallbackOnly =
    runtimeMitigation.stateConsistency === "local_fallback" &&
    featureFlags.includes("redis-fallback-visible") &&
    !hasOperationalPressure(runtimeMitigation);

  if (localFallbackOnly) {
    return {
      tone: "info",
      title: "Coordenacao distribuida em fallback local",
      message:
        "Redis distribuido nao esta disponivel neste ambiente. O painel segue operando em modo local, sem sinal de pressao operacional real neste ciclo.",
      detail:
        businessImpact ||
        "Locks, rate limit e coordenacao entre instancias ficam locais ate a recuperacao do Redis.",
    };
  }

  if (!hasOperationalPressure(runtimeMitigation)) {
    return null;
  }

  return {
    tone: "warn",
    title: "Mitigacao automatica do cluster",
    message: `Mitigacao automatica ativa em ${runtimeMitigation.overloadedInstances}/${runtimeMitigation.instanceCount} instancia(s). Fator adaptativo ${runtimeMitigation.adaptiveThrottleFactor.toFixed(2)} por causa ${runtimeMitigation.pressureCause}. Consistencia ${runtimeMitigation.stateConsistency}.`,
    detail:
      businessImpact ||
      "Algumas metricas caras foram reduzidas automaticamente para preservar estabilidade e latencia.",
  };
}
