"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, BellRing, Clock3, FileSearch, RefreshCw, Wrench } from "lucide-react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardSurfaceState } from "@/components/operational-dashboard/DashboardMetricState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  getDiagnosticsLevelPresentation,
  getDiagnosticsSectionPresentation,
} from "@/app/configuracoes/sistema/diagnostico/diagnostics.utils";

type Section<T> = ({ status: "ok" } & T) | { status: "error"; message: string };

const diagnosticsCardClassName =
  "rounded-[2rem] border border-skin-border bg-skin-surface shadow-sm";
const diagnosticsPanelClassName =
  "rounded-2xl border border-skin-border bg-skin-background-elevated px-4 py-3";
const diagnosticsPanelStrongClassName =
  "rounded-2xl border border-skin-border bg-skin-background-elevated px-4 py-3 text-sm text-skin-text";

type DiagnosticsData = {
  generatedAt: string;
  overall: {
    level: "healthy" | "attention" | "critical";
    label: string;
    summary: string;
    reasons: string[];
    version: string | null;
    uptimeHuman: string | null;
    maintenanceActive: boolean;
  };
  links: {
    cron: string;
    logs: string;
    audit: string;
    updates: string | null;
    backups: string | null;
    notifications: string | null;
  };
  operational: Section<Record<string, any>>;
  scheduler: Section<Record<string, any>>;
  update: Section<Record<string, any>>;
  backup: Section<Record<string, any>>;
  alerts: Section<Record<string, any>>;
  audit: Section<Record<string, any>>;
  logs: Section<Record<string, any>>;
};

function okSection<T>(section: Section<T> | null | undefined): T | null {
  return section && section.status === "ok" ? (section as T) : null;
}

function formatDate(value: unknown) {
  if (!value || typeof value !== "string") return "Sem registro";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sem registro" : date.toLocaleString("pt-BR");
}

function formatLabel(value: unknown) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "Sem leitura";
  if (["healthy", "ok", "success"].includes(text)) return "Ok";
  if (text === "failed") return "Falhou";
  if (text === "pending") return "Pendente";
  if (text === "running") return "Executando";
  if (text === "critical") return "Critico";
  if (text === "degraded") return "Degradado";
  return text.replaceAll("_", " ");
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={diagnosticsPanelClassName}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-skin-text-muted">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-skin-text">{value}</p>
    </div>
  );
}

function SectionCard({
  title,
  description,
  section,
  href,
  actionLabel,
  children,
}: {
  title: string;
  description: string;
  section: Section<Record<string, any>>;
  href?: string | null;
  actionLabel?: string;
  children: React.ReactNode;
}) {
  const visual = getDiagnosticsSectionPresentation(section.status);
  return (
    <Card className={diagnosticsCardClassName}>
      <CardHeader className="space-y-3 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="mt-1 text-sm">{description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]", visual.badgeClassName)}>
              {visual.badgeLabel}
            </span>
            {href ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-skin-border bg-skin-surface text-skin-text hover:bg-skin-surface-hover"
              >
                <Link href={href}>{actionLabel || "Abrir"}</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>{section.status === "error" ? <DashboardSurfaceState title="Bloco indisponivel" description={section.message} tone="warn" /> : children}</CardContent>
    </Card>
  );
}

export default function DiagnosticoSistemaPage() {
  const { toast } = useToast();
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      const response = await api.get<DiagnosticsData>("/system/diagnostics");
      setData(response.data);
    } catch (error: unknown) {
      toast({
        title: "Erro ao carregar diagnostico",
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Nao foi possivel carregar a pagina.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    void load(true);
  }, [load]);

  const operational = okSection<Record<string, any>>(data?.operational);
  const scheduler = okSection<Record<string, any>>(data?.scheduler);
  const update = okSection<Record<string, any>>(data?.update);
  const backup = okSection<Record<string, any>>(data?.backup);
  const alerts = okSection<Record<string, any>>(data?.alerts);
  const audit = okSection<Record<string, any>>(data?.audit);
  const logs = okSection<Record<string, any>>(data?.logs);
  const overall = getDiagnosticsLevelPresentation(data?.overall.level || "attention");

  return (
    <ProtectedRoute allowedRoles={["SUPER_ADMIN", "ADMIN"]}>
      <div className="space-y-6 p-4 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-skin-border bg-skin-surface px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-skin-text-muted">
              <FileSearch className="h-3.5 w-3.5" />
              Diagnostico operacional
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Visao unificada do sistema</h1>
            <p className="max-w-3xl text-sm text-skin-text-muted">Reaproveita dashboard, cron runtime, updates, backup, restore, auditoria, notificacoes e a funcionalidade de logs ja existente.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]", overall.badgeClassName)}>{data?.overall.label || "Carregando"}</span>
            <Button variant="outline" onClick={() => void load(false)} disabled={loading || refreshing}><RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />Atualizar</Button>
          </div>
        </div>

        {loading && !data ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className={diagnosticsCardClassName}>
                <CardContent className="space-y-3 p-6">
                  <div className="h-4 w-32 animate-pulse rounded-full bg-skin-border" />
                  <div className="h-8 w-40 animate-pulse rounded-full bg-skin-background-elevated" />
                  <div className="h-3 w-full animate-pulse rounded-full bg-skin-background-elevated" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}

        {data ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className={diagnosticsCardClassName}><CardContent className="space-y-3 p-6"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-skin-text-muted"><Activity className="h-4 w-4" />Estado geral</div><div className={cn("text-2xl font-semibold", overall.accentClassName)}>{data.overall.label}</div><p className="text-sm text-skin-text-muted">{data.overall.summary}</p></CardContent></Card>
              <Card className={diagnosticsCardClassName}><CardContent className="space-y-3 p-6"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-skin-text-muted"><Wrench className="h-4 w-4" />Maintenance</div><div className="text-2xl font-semibold text-skin-text">{data.overall.maintenanceActive ? "Ativo" : "Inativo"}</div><p className="text-sm text-skin-text-muted">Versao {data.overall.version || "Sem leitura"} - Uptime {data.overall.uptimeHuman || "Sem leitura"}</p></CardContent></Card>
              <Card className={diagnosticsCardClassName}><CardContent className="space-y-3 p-6"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-skin-text-muted"><Clock3 className="h-4 w-4" />Tarefas</div><div className="text-2xl font-semibold text-skin-text">{scheduler ? `${Array.isArray(scheduler.problematic) ? scheduler.problematic.length : 0} com atencao` : "Leitura parcial"}</div><p className="text-sm text-skin-text-muted">{scheduler ? `${scheduler.enabled} ativas de ${scheduler.total}` : data.scheduler.message}</p></CardContent></Card>
              <Card className={diagnosticsCardClassName}><CardContent className="space-y-3 p-6"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-skin-text-muted"><BellRing className="h-4 w-4" />Alertas</div><div className="text-2xl font-semibold text-skin-text">{alerts ? String(alerts.recentCount || 0) : "Parcial"}</div><p className="text-sm text-skin-text-muted">{alerts ? `${alerts.criticalCount} criticos na janela recente` : data.alerts.message}</p></CardContent></Card>
            </div>

            {data.overall.reasons.length > 0 ? <Card className={diagnosticsCardClassName}><CardHeader><CardTitle className="text-lg">Leitura rapida do estado atual</CardTitle><CardDescription>Motivos que sustentam a classificacao atual do sistema.</CardDescription></CardHeader><CardContent><div className="grid gap-2 md:grid-cols-2">{data.overall.reasons.map((reason) => <div key={reason} className={diagnosticsPanelStrongClassName}>{reason}</div>)}</div></CardContent></Card> : null}

            <div className="grid gap-4 xl:grid-cols-2">
              <SectionCard title="Estado geral" description="Versao, uptime, maintenance e sinais basicos da infraestrutura." section={data.operational}>
                <div className="grid gap-3 md:grid-cols-2"><Metric label="Versao atual" value={String(operational?.version || "Sem leitura")} /><Metric label="Uptime" value={String(operational?.uptimeHuman || "Sem leitura")} /><Metric label="Banco" value={formatLabel(operational?.databaseStatus)} /><Metric label="Redis" value={formatLabel(operational?.redisStatus)} /><Metric label="Taxa de erro da API" value={operational?.apiErrorRateRecent === null || operational?.apiErrorRateRecent === undefined ? "Sem leitura" : `${Number(operational.apiErrorRateRecent).toFixed(1)}%`} /><Metric label="Maintenance" value={operational?.maintenanceActive ? "Ativo" : "Inativo"} /></div>
              </SectionCard>
              <SectionCard title="Scheduler e tarefas" description="Runtime real das tarefas, com falhas, atrasos e travamentos." section={data.scheduler} href={data.links.cron} actionLabel="Abrir tarefas">
                <div className="space-y-4"><div className="grid gap-3 md:grid-cols-4"><Metric label="Ativas" value={String(scheduler?.enabled || 0)} /><Metric label="Com falha" value={String(scheduler?.failed || 0)} /><Metric label="Atrasadas" value={String(scheduler?.stale || 0)} /><Metric label="Travadas" value={String(scheduler?.stuck || 0)} /></div>{Array.isArray(scheduler?.problematic) && scheduler.problematic.length > 0 ? scheduler.problematic.map((item: Record<string, any>) => <div key={String(item.key)} className={diagnosticsPanelClassName}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-skin-text">{String(item.name)}</p><Badge variant="outline" className="border-skin-border bg-skin-surface text-skin-text">{formatLabel(item.type)}</Badge></div><p className="mt-1 text-xs text-skin-text-muted">{String(item.summary)}</p><div className="mt-2 grid gap-2 text-xs text-skin-text-muted md:grid-cols-2"><span>Proximo esperado: {formatDate(item.nextExpectedRunAt)}</span><span>Ultimo sucesso: {formatDate(item.lastSucceededAt)}</span></div></div>) : <DashboardSurfaceState title="Sem tarefas problematicas" description="O runtime nao reportou atrasos ou falhas relevantes." tone="neutral" />}</div>
              </SectionCard>
              <SectionCard title="Update e deploy" description="Estado reaproveitado do sistema de updates." section={data.update} href={update?.href || null} actionLabel="Abrir updates">
                <div className="grid gap-3 md:grid-cols-2"><Metric label="Versao atual" value={String(update?.currentVersion || "Sem leitura")} /><Metric label="Atualizacao disponivel" value={update?.updateAvailable ? "Sim" : "Nao"} /><Metric label="Ultima checagem" value={formatDate(update?.lastCheck)} /><Metric label="Execucao em andamento" value={update?.inProgress ? "Sim" : "Nao"} /><Metric label="Ultima execucao" value={update?.lastUpdate ? `${formatLabel(update.lastUpdate.status)} - ${String(update.lastUpdate.version || "Sem versao")}` : "Nenhuma execucao recente"} /><Metric label="Ultimo rollback" value={update?.lastRollback ? `${formatLabel(update.lastRollback.status)} - ${String(update.lastRollback.version || "Sem versao")}` : "Nenhum rollback recente"} /></div>
              </SectionCard>
              <SectionCard title="Backup e restore" description="Resumo do ultimo backup, ultimo restore e falhas recentes." section={data.backup} href={backup?.href || null} actionLabel="Abrir backups">
                <div className="grid gap-3 md:grid-cols-2"><Metric label="Pendentes" value={String(backup?.pendingJobs || 0)} /><Metric label="Executando" value={String(backup?.runningJobs || 0)} /><Metric label="Ultimo backup" value={backup?.lastBackup ? `${formatLabel(backup.lastBackup.type)} - ${formatLabel(backup.lastBackup.status)}` : "Sem registro"} /><Metric label="Ultimo restore" value={backup?.lastRestore ? `${formatLabel(backup.lastRestore.type)} - ${formatLabel(backup.lastRestore.status)}` : "Sem registro"} /><Metric label="Falha recente" value={backup?.recentFailure ? `${formatLabel(backup.recentFailure.type)} - ${formatLabel(backup.recentFailure.status)}` : "Sem falhas"} /></div>
              </SectionCard>
              <SectionCard title="Alertas operacionais" description="Ultimos alertas automaticos, sem criar uma nova inbox." section={data.alerts} href={alerts?.href || null} actionLabel="Abrir notificacoes">
                <div className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><Metric label="Alertas recentes" value={String(alerts?.recentCount || 0)} /><Metric label="Criticos" value={String(alerts?.criticalCount || 0)} /><Metric label="Inbox dedicada" value={alerts?.inboxAvailable ? "Disponivel" : "Nao disponivel"} /></div>{Array.isArray(alerts?.recent) && alerts.recent.length > 0 ? alerts.recent.map((item: Record<string, any>) => <div key={String(item.id)} className={diagnosticsPanelClassName}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-skin-text">{String(item.title)}</p><Badge variant="outline" className="border-skin-border bg-skin-surface text-skin-text">{formatLabel(item.severity)}</Badge></div><p className="mt-1 text-sm text-skin-text-muted">{String(item.body)}</p><div className="mt-2 text-xs text-skin-text-muted">{formatDate(item.createdAt)}</div></div>) : <DashboardSurfaceState title="Sem alertas recentes" description="Nenhum alerta operacional foi emitido na janela atual." tone="neutral" />}</div>
              </SectionCard>
              <SectionCard title="Auditoria e logs" description="Reaproveita a pagina /logs existente e mostra a cobertura real dos dados." section={data.logs} href={data.links.logs} actionLabel="Abrir logs">
                <div className="space-y-4"><div className={diagnosticsPanelClassName}><p className="text-sm font-semibold text-skin-text">{String(logs?.summary || "Sem resumo")}</p><p className="mt-1 text-xs text-skin-text-muted">Escopo atual: {String(logs?.pageKind || "auditoria")}</p></div><div className="flex flex-wrap gap-2">{Array.isArray(logs?.coverage) ? logs.coverage.map((item: string) => <Badge key={item} variant="outline" className="border-skin-border bg-skin-surface text-skin-text">{item}</Badge>) : null}</div>{Array.isArray(logs?.recentTechnicalIssues) && logs.recentTechnicalIssues.length > 0 ? logs.recentTechnicalIssues.map((item: Record<string, any>) => <div key={String(item.id)} className="rounded-2xl border border-skin-border bg-skin-surface px-4 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-skin-text">{String(item.title)}</p><Badge variant="outline" className="border-skin-border bg-skin-surface text-skin-text">{String(item.origin)}</Badge></div><p className="mt-1 text-sm text-skin-text-muted">{String(item.detail || "Sem detalhe adicional")}</p><div className="mt-2 text-xs text-skin-text-muted">{formatDate(item.occurredAt)}</div></div>) : <DashboardSurfaceState title="Sem falhas tecnicas recentes" description="Nao foram identificadas falhas tecnicas recentes nas bases reaproveitadas." tone="neutral" />}</div>
              </SectionCard>
              <SectionCard title="Eventos criticos de auditoria" description="Ultimos eventos criticos relevantes ja persistidos." section={data.audit} href={data.links.audit} actionLabel="Abrir auditoria">
                <div className="space-y-2">{Array.isArray(audit?.recent) && audit.recent.length > 0 ? audit.recent.map((item: Record<string, any>) => <div key={String(item.id)} className={diagnosticsPanelClassName}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-skin-text">{String(item.actionLabel || item.action)}</p><Badge variant="outline" className="border-skin-border bg-skin-surface text-skin-text">{formatLabel(item.severity)}</Badge></div><p className="mt-1 text-sm text-skin-text-muted">{String(item.message || item.action)}</p><div className="mt-2 text-xs text-skin-text-muted">{formatDate(item.createdAt)}</div></div>) : <DashboardSurfaceState title="Sem eventos criticos" description="A auditoria nao registrou eventos criticos recentes nesta visao." tone="neutral" />}</div>
              </SectionCard>
            </div>
          </>
        ) : null}
      </div>
    </ProtectedRoute>
  );
}
