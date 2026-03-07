import { describe, expect, it } from "vitest";
import {
  getDiagnosticsLevelPresentation,
  getDiagnosticsSectionPresentation,
} from "@/app/configuracoes/sistema/diagnostico/diagnostics.utils";

describe("diagnostics.utils", () => {
  it("resolve apresentacao visual do estado critico", () => {
    expect(getDiagnosticsLevelPresentation("critical")).toEqual({
      label: "Critico",
      badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
      accentClassName: "text-rose-600",
    });
  });

  it("resolve apresentacao visual do estado saudavel", () => {
    expect(getDiagnosticsLevelPresentation("healthy")).toEqual({
      label: "Saudavel",
      badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
      accentClassName: "text-emerald-600",
    });
  });

  it("marca bloco com falha parcial na interface", () => {
    expect(getDiagnosticsSectionPresentation("error")).toEqual({
      badgeLabel: "Parcial",
      badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    });
  });
});
