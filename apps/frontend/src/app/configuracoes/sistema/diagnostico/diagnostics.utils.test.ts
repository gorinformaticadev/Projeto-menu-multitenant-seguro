import { describe, expect, it } from "vitest";
import {
  getDiagnosticsLevelPresentation,
  getDiagnosticsSectionPresentation,
} from "@/app/configuracoes/sistema/diagnostico/diagnostics.utils";

describe("diagnostics.utils", () => {
  it("resolve apresentacao visual do estado critico", () => {
    expect(getDiagnosticsLevelPresentation("critical")).toEqual({
      label: "Critico",
      badgeClassName: "border-skin-danger/30 bg-skin-danger/10 text-skin-danger",
      accentClassName: "text-skin-danger",
    });
  });

  it("resolve apresentacao visual do estado saudavel", () => {
    expect(getDiagnosticsLevelPresentation("healthy")).toEqual({
      label: "Saudavel",
      badgeClassName: "border-skin-success/30 bg-skin-success/10 text-skin-success",
      accentClassName: "text-skin-success",
    });
  });

  it("marca bloco com falha parcial na interface", () => {
    expect(getDiagnosticsSectionPresentation("error")).toEqual({
      badgeLabel: "Parcial",
      badgeClassName: "border-skin-warning/30 bg-skin-warning/10 text-skin-warning",
    });
  });
});
