export type DiagnosticsLevel = "healthy" | "attention" | "critical";
export type DiagnosticsSectionStatus = "ok" | "error";

export function getDiagnosticsLevelPresentation(level: DiagnosticsLevel) {
  if (level === "critical") {
    return {
      label: "Critico",
      badgeClassName:
        "border-skin-danger/30 bg-skin-danger/10 text-skin-danger",
      accentClassName: "text-skin-danger",
    };
  }

  if (level === "attention") {
    return {
      label: "Atencao",
      badgeClassName:
        "border-skin-warning/30 bg-skin-warning/10 text-skin-warning",
      accentClassName: "text-skin-warning",
    };
  }

  return {
    label: "Saudavel",
    badgeClassName:
      "border-skin-success/30 bg-skin-success/10 text-skin-success",
    accentClassName: "text-skin-success",
  };
}

export function getDiagnosticsSectionPresentation(status: DiagnosticsSectionStatus) {
  if (status === "error") {
    return {
      badgeLabel: "Parcial",
      badgeClassName:
        "border-skin-warning/30 bg-skin-warning/10 text-skin-warning",
    };
  }

  return {
    badgeLabel: "Disponivel",
    badgeClassName:
      "border-skin-border bg-skin-background-elevated text-skin-text",
  };
}
