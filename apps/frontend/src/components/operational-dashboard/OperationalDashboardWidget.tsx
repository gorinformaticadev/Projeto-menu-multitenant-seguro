"use client";

import type { ReactNode } from "react";
import { EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type WidgetTone = "neutral" | "good" | "warn" | "danger";

interface OperationalDashboardWidgetProps {
  id: string;
  title: string;
  subtitle?: string;
  tone?: WidgetTone;
  onHide?: (id: string) => void;
  children: ReactNode;
}

const toneClassName: Record<WidgetTone, string> = {
  neutral: "border-slate-200 dark:border-slate-800",
  good: "border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20",
  warn: "border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20",
  danger: "border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20",
};

export function OperationalDashboardWidget({
  id,
  title,
  subtitle,
  tone = "neutral",
  onHide,
  children,
}: OperationalDashboardWidgetProps) {
  return (
    <Card className={`h-full shadow-sm ${toneClassName[tone]}`}>
      <CardHeader className="p-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold leading-tight truncate">{title}</CardTitle>
            {subtitle ? (
              <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{subtitle}</p>
            ) : null}
          </div>
          {onHide ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => onHide(id)}
              title="Ocultar widget"
              aria-label={`Ocultar widget ${title}`}
            >
              <EyeOff className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-1 h-[calc(100%-56px)] overflow-hidden">{children}</CardContent>
    </Card>
  );
}
