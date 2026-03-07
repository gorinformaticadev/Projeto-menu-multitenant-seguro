export type DiagnosticsLevel = "healthy" | "attention" | "critical";
export type DiagnosticsSectionStatus = "ok" | "error";

export function getDiagnosticsLevelPresentation(level: DiagnosticsLevel) {
  if (level === "critical") {
    return {
      label: "Critico",
      badgeClassName: "border-rose-200 bg-rose-50 text-rose-700",
      accentClassName: "text-rose-600",
    };
  }

  if (level === "attention") {
    return {
      label: "Atencao",
      badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
      accentClassName: "text-amber-600",
    };
  }

  return {
    label: "Saudavel",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    accentClassName: "text-emerald-600",
  };
}

export function getDiagnosticsSectionPresentation(status: DiagnosticsSectionStatus) {
  if (status === "error") {
    return {
      badgeLabel: "Parcial",
      badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    badgeLabel: "Disponivel",
    badgeClassName: "border-slate-200 bg-slate-50 text-slate-700",
  };
}
