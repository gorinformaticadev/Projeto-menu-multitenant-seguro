import { describe, expect, it } from "vitest";
import { resolveRuntimeMitigationBanner } from "@/components/operational-dashboard/runtime-mitigation";

describe("runtime mitigation banner", () => {
  it("treats local fallback without pressure as an informational environment notice", () => {
    expect(
      resolveRuntimeMitigationBanner({
        adaptiveThrottleFactor: 1,
        pressureCause: "normal",
        instanceCount: 1,
        overloadedInstances: 0,
        stateConsistency: "local_fallback",
        clusterRecentApiLatencyMs: 42,
        clusterQueueDepth: 0,
        degradeHeavyFeatures: false,
        disableRemoteUpdateChecks: false,
        rejectHeavyMutations: false,
        featureFlags: ["redis-fallback-visible"],
        businessImpact: [
          "Coordenacao distribuida esta em fallback local; consistencia global reduzida ate a recuperacao do Redis.",
        ],
      }),
    ).toEqual({
      tone: "info",
      title: "Coordenacao distribuida em fallback local",
      message:
        "Redis distribuido nao esta disponivel neste ambiente. O painel segue operando em modo local, sem sinal de pressao operacional real neste ciclo.",
      detail:
        "Coordenacao distribuida esta em fallback local; consistencia global reduzida ate a recuperacao do Redis.",
    });
  });

  it("keeps warning copy when heavy mitigation is really active", () => {
    expect(
      resolveRuntimeMitigationBanner({
        adaptiveThrottleFactor: 0.72,
        pressureCause: "cpu",
        instanceCount: 2,
        overloadedInstances: 1,
        stateConsistency: "distributed",
        clusterRecentApiLatencyMs: 1900,
        clusterQueueDepth: 6,
        degradeHeavyFeatures: true,
        disableRemoteUpdateChecks: false,
        rejectHeavyMutations: false,
        featureFlags: ["degrade-heavy-features"],
        businessImpact: ["Widgets pesados do dashboard e agregacoes caras podem operar em modo reduzido."],
      }),
    ).toEqual({
      tone: "warn",
      title: "Mitigacao automatica do cluster",
      message:
        "Mitigacao automatica ativa em 1/2 instancia(s). Fator adaptativo 0.72 por causa cpu. Consistencia distributed.",
      detail:
        "Widgets pesados do dashboard e agregacoes caras podem operar em modo reduzido.",
    });
  });
});
