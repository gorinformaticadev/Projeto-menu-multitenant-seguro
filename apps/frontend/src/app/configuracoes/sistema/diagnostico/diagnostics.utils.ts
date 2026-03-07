export type DiagnosticsLevel = "healthy" | "attention" | "critical";
export type DiagnosticsSectionStatus = "ok" | "error";

export function getDiagnosticsLevelPresentation(level: DiagnosticsLevel) {
  if (level === "critical") {
    return {
      label: "Critico",
      badgeClassName:
        "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200",
      accentClassName: "text-rose-600 dark:text-rose-300",
    };
  }

  if (level === "attention") {
    return {
      label: "Atencao",
      badgeClassName:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200",
      accentClassName: "text-amber-600 dark:text-amber-300",
    };
  }

  return {
    label: "Saudavel",
    badgeClassName:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200",
    accentClassName: "text-emerald-600 dark:text-emerald-300",
  };
}

export function getDiagnosticsSectionPresentation(status: DiagnosticsSectionStatus) {
  if (status === "error") {
    return {
      badgeLabel: "Parcial",
      badgeClassName:
        "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200",
    };
  }

  return {
    badgeLabel: "Disponivel",
    badgeClassName:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200",
  };
}
