"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  Clock3,
  Info,
  Loader2,
  MoreHorizontal,
  Pause,
  PanelRight,
  Play,
  RotateCw,
  Settings2,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  buildCronExpressionFromForm,
  createCronEditorForm,
  CRON_PRESET_OPTIONS,
  CRON_WEEKDAY_OPTIONS,
  type CronEditorForm,
  describeCronSchedule,
  getCronTaskPresentation,
  humanizeCronExpression,
  validateCronExpression,
} from "./cron-task.utils";

interface CronJob {
  key: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  editable?: boolean;
  origin?: "core" | "modulo";
  runtimeRegistered?: boolean;
  runtimeActive?: boolean;
  sourceOfTruth?: "database";
  lastRun?: string;
  lastStartedAt?: string;
  lastSucceededAt?: string;
  lastFailedAt?: string;
  lastDurationMs?: number;
  lastStatus?: "idle" | "running" | "success" | "failed";
  lastError?: string;
  nextRun?: string;
  nextExpectedRunAt?: string;
  consecutiveFailureCount?: number;
  issue?: "runtime_not_registered" | null;
}

type SaveError = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

const cronModalPopoverClassName =
  "rounded-[24px] border border-border/70 bg-popover/95 text-popover-foreground shadow-md backdrop-blur-sm";
const cronModalSurfaceClassName = "bg-skin-surface text-skin-text";
const cronModalChromeClassName = "border-border/70 bg-skin-surface/95 backdrop-blur-sm";
const cronModalCardClassName =
  "rounded-[28px] border border-border/70 bg-card/95 shadow-md backdrop-blur-sm";
const cronModalMutedCardClassName = "rounded-[22px] border border-border/70 bg-skin-background-elevated/30 shadow-sm";
const cronModalFieldClassName = "border-border/70 bg-skin-surface/95 dark:bg-skin-surface/80";

export default function CronJobsPage() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [selectedJobKey, setSelectedJobKey] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [editorForm, setEditorForm] = useState<CronEditorForm | null>(null);
  const [editorEnabled, setEditorEnabled] = useState(true);

  const fetchJobs = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      const response = await api.get("/cron/runtime");
      setJobs(response.data);
    } catch {
      toast({
        title: "Erro ao carregar tarefas",
        description: "Nao foi possivel listar as tarefas agendadas.",
        variant: "destructive",
      });
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [toast]);

  useEffect(() => {
    void fetchJobs(true);
  }, [fetchJobs]);

  const handleTrigger = async (key: string) => {
    try {
      setSavingKey(key);
      await api.post(`/cron/${key}/trigger`);
      toast({
        title: "Tarefa iniciada",
        description: "A execucao manual foi enviada ao runtime atual.",
      });
      await fetchJobs();
    } catch {
      toast({
        title: "Erro ao iniciar tarefa",
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggle = async (key: string, currentStatus: boolean) => {
    try {
      setSavingKey(key);
      await api.put(`/cron/${key}/toggle`, { enabled: !currentStatus });
      toast({
        title: currentStatus ? "Tarefa pausada" : "Tarefa ativada",
        description: "O estado do cronograma foi atualizado no runtime.",
      });
      await fetchJobs();
    } catch {
      toast({
        title: "Erro ao atualizar tarefa",
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
  };

  const openDetails = (job: CronJob) => {
    setSelectedJobKey(job.key);
  };

  const closeDetails = () => {
    setSelectedJobKey(null);
  };

  const openEditor = (job: CronJob) => {
    setEditingJob(job);
    setEditorEnabled(job.enabled);
    setEditorForm(createCronEditorForm(job.schedule));
  };

  const closeEditor = () => {
    setEditingJob(null);
    setEditorForm(null);
    setEditorEnabled(true);
  };

  const updateEditorForm = (updater: (current: CronEditorForm) => CronEditorForm) => {
    setEditorForm((current) => (current ? updater(current) : current));
  };

  const finalSchedule = editorForm ? buildCronExpressionFromForm(editorForm) : "";
  const cronError = finalSchedule ? validateCronExpression(finalSchedule) : null;
  const previewSummary = finalSchedule ? describeCronSchedule(finalSchedule) : null;
  const previewNextRun = resolvePreviewNextRun(editingJob, finalSchedule, previewSummary?.nextPreviewAt || null);
  const scheduleChanged = Boolean(editingJob && finalSchedule && finalSchedule !== editingJob.schedule);
  const enabledChanged = Boolean(editingJob && editorEnabled !== editingJob.enabled);
  const hasEditorChanges = scheduleChanged || enabledChanged;

  const saveTaskChanges = async () => {
    if (!editingJob || !editorForm) {
      return;
    }

    if (cronError) {
      toast({
        title: "Cronograma invalido",
        description: cronError,
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingKey(editingJob.key);

      if (scheduleChanged && editingJob.editable !== false) {
        await api.put(`/cron/${editingJob.key}/schedule`, { schedule: finalSchedule });
      }

      if (enabledChanged) {
        await api.put(`/cron/${editingJob.key}/toggle`, { enabled: editorEnabled });
      }

      toast({
        title: hasEditorChanges ? "Tarefa atualizada" : "Nada para salvar",
        description: hasEditorChanges
          ? "As alteracoes foram aplicadas imediatamente ao runtime."
          : "O cronograma ja esta com essas configuracoes.",
      });

      closeEditor();
      await fetchJobs();
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
          error !== null &&
          typeof (error as SaveError).response?.data?.message === "string"
          ? (error as SaveError).response?.data?.message
          : "Nao foi possivel salvar as alteracoes da tarefa.";

      toast({
        title: "Erro ao salvar tarefa",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
  };

  const runningCount = jobs.filter((job) => job.enabled).length;
  const runtimeIssuesCount = jobs.filter((job) => job.runtimeRegistered === false || job.issue).length;
  const selectedJob = selectedJobKey ? jobs.find((job) => job.key === selectedJobKey) ?? null : null;

  if (loading) {
    return <div className="p-8 text-center">Carregando tarefas agendadas...</div>;
  }

  return (
    <div className="space-y-6 p-4 text-skin-text dark:text-skin-text md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-skin-text dark:text-skin-text">
            <Clock3 className="h-8 w-8 text-skin-primary" />
            Tarefas agendadas
          </h1>
          <p className="max-w-2xl text-sm text-skin-text-muted ">
            Visualize a saude das rotinas, execute acoes rapidas e deixe os detalhes tecnicos em
            um painel lateral.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="rounded-full border-skin-border/80 bg-skin-surface/85 px-3 py-1 text-skin-text dark:border-skin-border/80 dark:bg-skin-surface/55 ">
            {runningCount} ativas
          </Badge>
          <Badge
            variant={runtimeIssuesCount > 0 ? "destructive" : "outline"}
            className={cn(
              "rounded-full px-3 py-1",
              runtimeIssuesCount > 0
                ? "border-skin-danger/30 bg-skin-danger/10 text-skin-danger"
                : "border-skin-border/80 bg-skin-surface/85 text-skin-text dark:border-skin-border/80 dark:bg-skin-surface/55 ",
            )}
          >
            {runtimeIssuesCount > 0 ? `${runtimeIssuesCount} com divergencia` : "Runtime sincronizado"}
          </Badge>
          <Button onClick={() => void fetchJobs(true)} variant="outline">
            <RotateCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {jobs.map((job) => {
          const isBusy = savingKey === job.key;
          const presentation = getCronTaskPresentation(job);
          const scheduleSummary = describeCronSchedule(job.schedule);
          const nextRunText = job.enabled
            ? formatDateTime(job.nextRun || job.nextExpectedRunAt)
            : "Agendamento pausado";
          const hasIssue = job.runtimeRegistered === false || job.issue === "runtime_not_registered";

          return (
            <Card
              key={job.key}
              className={cn(
                "rounded-[28px] shadow-md transition-shadow hover:shadow-lg",
                hasIssue
                  ? "border-skin-danger/30 bg-skin-surface/95"
                  : "border-skin-info/30 bg-skin-surface/95",
              )}
            >
              <CardContent className="p-3.5 sm:p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="rounded-2xl border border-skin-border/80 bg-skin-surface/85 p-2 shadow-sm dark:border-skin-border/80 dark:bg-skin-surface/55">
                        <Clock3 className="h-5 w-5 text-skin-text " />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="truncate text-base font-semibold text-skin-text dark:text-skin-text sm:text-lg">
                            {presentation.label}
                          </CardTitle>
                          <TaskInfoPopover description={presentation.description} />
                          <Badge variant={job.enabled ? "default" : "secondary"}>
                            {job.enabled ? "Ativa" : "Pausada"}
                          </Badge>
                          {renderStatusBadge(job)}
                        </div>

                        <p className="line-clamp-2 text-sm text-skin-text-muted ">
                          {presentation.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="rounded-full border-skin-border/80 bg-skin-surface/85 px-2.5 py-1 text-[11px] text-skin-text dark:border-skin-border/80 dark:bg-skin-surface/55 ">
                        {scheduleSummary.label}
                      </Badge>
                      <Badge
                        variant={hasIssue ? "destructive" : "outline"}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px]",
                          hasIssue
                            ? "border-skin-danger/30 bg-skin-danger/10 text-skin-danger"
                            : "border-skin-border/80 bg-skin-surface/85 text-skin-text dark:border-skin-border/80 dark:bg-skin-surface/55 ",
                        )}
                      >
                        {hasIssue ? "Runtime com divergencia" : "Runtime OK"}
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-skin-border/80 bg-skin-surface/85 px-2.5 py-1 text-[11px] text-skin-text dark:border-skin-border/80 dark:bg-skin-surface/55 ">
                        Proxima: {nextRunText}
                      </Badge>
                      {typeof job.consecutiveFailureCount === "number" &&
                        job.consecutiveFailureCount > 0 && (
                          <Badge
                            variant="outline"
                            className="rounded-full border-skin-warning/30 bg-skin-warning/10 px-2.5 py-1 text-[11px] text-skin-warning"
                          >
                            {job.consecutiveFailureCount} falha(s) seguidas
                          </Badge>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-skin-text-muted dark:text-skin-text-muted">
                      <span>{job.origin === "modulo" ? "Origem: modulo" : "Origem: plataforma"}</span>
                      <span>
                        Fonte: {job.sourceOfTruth === "database" ? "configuracao persistida" : "runtime"}
                      </span>
                      <span>Chave: {job.key}</span>
                      {job.editable === false && <span>Cronograma fixo</span>}
                    </div>

                    {hasIssue && (
                      <p className="text-xs text-skin-danger">
                        Esta tarefa foi salva, mas o runtime atual ainda nao carregou essa configuracao.
                      </p>
                    )}

                    {job.lastError && (
                      <p className="line-clamp-1 text-xs text-skin-warning">
                        Ultimo erro: {job.lastError}
                      </p>
                    )}
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap xl:w-auto xl:justify-end">
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => openDetails(job)}
                    >
                      <PanelRight className="mr-2 h-4 w-4" />
                      Detalhes
                    </Button>

                    <Button
                      variant={job.enabled ? "outline" : "default"}
                      className={cn(
                        "w-full sm:w-auto",
                        !job.enabled && "bg-skin-success hover:bg-skin-success",
                      )}
                      disabled={isBusy}
                      onClick={() => void handleToggle(job.key, job.enabled)}
                    >
                      {isBusy ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : job.enabled ? (
                        <Pause className="mr-2 h-4 w-4" />
                      ) : (
                        <Play className="mr-2 h-4 w-4" />
                      )}
                      {job.enabled ? "Pausar" : "Ativar"}
                    </Button>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="icon" className="shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Mais acoes</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        className={cn(
                          "w-72 max-w-[calc(100vw-1.5rem)] p-2",
                          cronModalPopoverClassName,
                        )}
                      >
                        <div className="space-y-1">
                          <div className="px-2 py-1.5">
                            <p className="text-sm font-medium">Acoes da tarefa</p>
                            <p className="text-xs text-skin-text-muted">
                              Operacoes rapidas para {presentation.label}
                            </p>
                          </div>

                          <Button
                            variant="ghost"
                            className="h-auto w-full justify-start rounded-xl px-3 py-2 text-left whitespace-normal"
                            disabled={isBusy}
                            onClick={() => openEditor(job)}
                          >
                            <Settings2 className="mr-3 h-4 w-4 shrink-0" />
                            <span className="min-w-0 flex-1">
                              <span className="block break-words text-sm font-medium">Editar tarefa</span>
                              <span className="block break-words text-xs text-skin-text-muted">
                                Ajuste cronograma, modo simplificado e modo avancado.
                              </span>
                            </span>
                          </Button>

                          <Button
                            variant="ghost"
                            className="h-auto w-full justify-start rounded-xl px-3 py-2 text-left whitespace-normal"
                            disabled={isBusy}
                            onClick={() => void handleTrigger(job.key)}
                          >
                            {isBusy ? (
                              <Loader2 className="mr-3 h-4 w-4 shrink-0 animate-spin" />
                            ) : (
                              <Play className="mr-3 h-4 w-4 shrink-0" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block break-words text-sm font-medium">Executar agora</span>
                              <span className="block break-words text-xs text-skin-text-muted">
                                Dispara uma execucao manual imediata no runtime atual.
                              </span>
                            </span>
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {jobs.length === 0 && (
          <div className="py-12 text-center text-skin-text-muted">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
            Nenhuma tarefa agendada encontrada.
          </div>
        )}
      </div>

      <Dialog open={Boolean(selectedJob)} onOpenChange={(open) => !open && closeDetails()}>
        <DialogContent className="inset-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-hidden gap-0 rounded-none border-0 bg-transparent p-0 shadow-none sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[min(760px,100vw)] sm:max-w-[760px] sm:border-l-0 sm:p-0">
          {selectedJob && (
            <div className={cn("flex h-full min-h-0 flex-col", cronModalSurfaceClassName)}>
              <DialogHeader className={cn("shrink-0 border-b px-4 py-4 text-left sm:px-6 sm:py-5", cronModalChromeClassName)}>
                <div className="pr-8">
                  <DialogTitle className="flex flex-wrap items-center gap-2 text-xl">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-skin-info/30 bg-skin-info/10 shadow-sm">
                      <Clock3 className="h-4 w-4 text-skin-info dark:text-skin-info" />
                    </span>
                    {getCronTaskPresentation(selectedJob).label}
                    <Badge variant={selectedJob.enabled ? "default" : "secondary"}>
                      {selectedJob.enabled ? "Ativa" : "Pausada"}
                    </Badge>
                    {renderStatusBadge(selectedJob)}
                  </DialogTitle>
                  <DialogDescription className="mt-2 text-skin-text-muted">
                    {getCronTaskPresentation(selectedJob).description}
                  </DialogDescription>
                </div>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-5">
                <div className="space-y-5">
                  <section className="space-y-3">
                    <div className="space-y-1">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-skin-text-muted">
                        Visao geral
                      </h2>
                      <p className="text-sm text-skin-text-muted">
                        Leitura rapida da configuracao e do agendamento principal.
                      </p>
                    </div>

                    <Card className={cronModalCardClassName}>
                      <CardContent className="space-y-3 p-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <TaskDataItem label="Cronograma">
                            <div className="space-y-2">
                              <p className="font-medium">
                                {describeCronSchedule(selectedJob.schedule).label}
                              </p>
                              <code className="inline-flex break-all rounded-md bg-skin-background-elevated/70 px-2 py-1 font-mono text-[11px] text-skin-text-muted">
                                {selectedJob.schedule}
                              </code>
                            </div>
                          </TaskDataItem>
                          <TaskDataItem label="Proxima execucao">
                            {selectedJob.enabled
                              ? formatDateTime(selectedJob.nextRun || selectedJob.nextExpectedRunAt)
                              : "Agendamento pausado"}
                          </TaskDataItem>
                          <TaskDataItem label="Origem">
                            {selectedJob.origin === "modulo" ? "Modulo" : "Plataforma"}
                          </TaskDataItem>
                          <TaskDataItem label="Fonte">
                            {selectedJob.sourceOfTruth === "database"
                              ? "Configuracao persistida"
                              : "Runtime"}
                          </TaskDataItem>
                        </div>

                        <div className={cn("p-4", cronModalMutedCardClassName)}>
                          <p className="text-xs uppercase tracking-wide text-skin-text-muted">
                            Chave tecnica
                          </p>
                          <code className="mt-2 inline-flex break-all rounded-md bg-skin-background-elevated px-2 py-1 font-mono text-[11px] text-skin-text-muted">
                            {selectedJob.key}
                          </code>
                          {selectedJob.editable === false && (
                            <p className="mt-3 text-xs text-skin-text-muted">
                              Esta tarefa usa um cronograma fixo, mas ainda pode ser ativada ou
                              pausada.
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </section>

                  <section className="space-y-3">
                    <div className="space-y-1">
                      <h2 className="text-sm font-semibold uppercase tracking-wide text-skin-text-muted">
                        Agenda e runtime
                      </h2>
                      <p className="text-sm text-skin-text-muted">
                        Historico recente, heartbeat e sinais de divergencia do runtime atual.
                      </p>
                    </div>

                    <Card className={cronModalCardClassName}>
                      <CardContent className="space-y-4 p-4">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <TaskDataItem label="Ultima execucao">
                            {formatDateTime(selectedJob.lastStartedAt || selectedJob.lastRun)}
                          </TaskDataItem>
                          <TaskDataItem label="Ultimo sucesso">
                            {formatDateTime(selectedJob.lastSucceededAt)}
                          </TaskDataItem>
                          <TaskDataItem label="Ultima falha">
                            {formatDateTime(selectedJob.lastFailedAt)}
                          </TaskDataItem>
                          <TaskDataItem label="Duracao">
                            {formatDurationMs(selectedJob.lastDurationMs)}
                          </TaskDataItem>
                          <TaskDataItem label="Proximo horario esperado">
                            {formatDateTime(selectedJob.nextExpectedRunAt)}
                          </TaskDataItem>
                          <TaskDataItem label="Runtime">
                            {selectedJob.runtimeRegistered ? "Registrada" : "Nao carregada"}
                          </TaskDataItem>
                        </div>

                        {typeof selectedJob.consecutiveFailureCount === "number" &&
                          selectedJob.consecutiveFailureCount > 0 && (
                            <div className="rounded-xl border border-skin-warning/30 bg-skin-warning/10 px-4 py-3 text-sm text-skin-warning">
                              Falhas consecutivas: {selectedJob.consecutiveFailureCount}
                            </div>
                          )}

                        {selectedJob.issue === "runtime_not_registered" && (
                          <div className="rounded-xl border border-skin-danger/30 bg-skin-danger/10 px-4 py-3 text-sm text-skin-danger">
                            Esta tarefa foi salva na configuracao, mas ainda nao esta registrada no runtime atual.
                          </div>
                        )}

                        {selectedJob.lastError && (
                          <div className="rounded-xl border border-skin-warning/30 bg-skin-warning/10 px-4 py-3 text-sm text-skin-warning">
                            <span className="font-medium">Ultimo erro:</span> {selectedJob.lastError}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </section>
                </div>
              </div>

              <DialogFooter className={cn("shrink-0 border-t px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-3", cronModalChromeClassName)}>
                <Button variant="outline" onClick={closeDetails}>
                  Fechar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingJob && editorForm)} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="inset-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 bg-transparent p-0 shadow-none sm:left-[50%] sm:top-[50%] sm:right-auto sm:bottom-auto sm:h-auto sm:max-h-[90dvh] sm:w-[min(860px,calc(100vw-2rem))] sm:max-w-[860px] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[28px] sm:border-0 sm:p-0">
          {editingJob && editorForm && (
            <div className={cn("flex h-full max-h-dvh flex-col shadow-lg sm:max-h-[90dvh] sm:rounded-[28px] sm:border", cronModalSurfaceClassName, "sm:border-border/70")}>
              <DialogHeader className={cn("border-b px-6 pb-4 pt-6 text-left", cronModalChromeClassName)}>
                <DialogTitle>Editar tarefa</DialogTitle>
                <DialogDescription className="text-skin-text-muted">
                  Ajuste o cronograma, confirme a proxima execucao e aplique as alteracoes no runtime.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto px-6 pb-6">
                <div className="space-y-6">
                <div className={cn("grid gap-3 p-4 md:grid-cols-[1.4fr,1fr]", cronModalCardClassName)}>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-skin-text-muted">
                      Nome amigavel
                    </Label>
                    <p className="text-sm font-semibold">
                      {getCronTaskPresentation(editingJob).label}
                    </p>
                    <p className="text-sm text-skin-text-muted">
                      {getCronTaskPresentation(editingJob).description}
                    </p>
                    <p className="text-xs text-skin-text-muted">
                      Esse nome e apenas a identificacao amigavel exibida na interface. A chave tecnica abaixo continua fixa.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wide text-skin-text-muted">
                        Chave tecnica
                      </Label>
                      <code className="inline-flex rounded-md bg-skin-background-elevated px-2 py-1 font-mono text-[11px] text-skin-text-muted">
                        {editingJob.key}
                      </code>
                    </div>

                    <div className={cn("flex items-center justify-between px-3 py-3", cronModalMutedCardClassName)}>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Tarefa ativa</p>
                        <p className="text-xs text-skin-text-muted">
                          Desative apenas quando a rotina nao deve mais executar automaticamente.
                        </p>
                      </div>
                        <Switch
                          checked={editorEnabled}
                          onCheckedChange={setEditorEnabled}
                          aria-label="Ativar ou pausar tarefa"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {editingJob.editable !== false && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant={editorForm.mode === "simple" ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            updateEditorForm((current) => ({
                              ...current,
                              mode: "simple",
                              preset: current.preset === "custom" ? "every_hours" : current.preset,
                            }))
                          }
                        >
                          Modo simplificado
                        </Button>
                        <Button
                          type="button"
                          variant={editorForm.mode === "advanced" ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            updateEditorForm((current) => ({
                              ...current,
                              mode: "advanced",
                              expression: buildCronExpressionFromForm(current),
                            }))
                          }
                        >
                          Modo avancado
                        </Button>
                      </div>
                    )}

                  {editingJob.editable === false ? (
                    <div className="rounded-[22px] border border-skin-warning/30 bg-skin-warning/10 px-4 py-3 text-sm text-skin-warning">
                      Esta tarefa usa um cronograma fixo. Voce ainda pode ativar ou pausar a execucao.
                    </div>
                  ) : editorForm.mode === "simple" ? (
                    <div className={cn("grid gap-3 p-4 md:grid-cols-2", cronModalCardClassName)}>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="cron-preset">Frequencia</Label>
                          <Select
                            value={editorForm.preset === "custom" ? "every_hours" : editorForm.preset}
                            onValueChange={(value) =>
                              updateEditorForm((current) => ({
                                ...current,
                                mode: "simple",
                                preset: value as CronEditorForm["preset"],
                              }))
                            }
                          >
                            <SelectTrigger id="cron-preset" className={cronModalFieldClassName}>
                              <SelectValue placeholder="Selecione a frequencia" />
                            </SelectTrigger>
                            <SelectContent className={cn("backdrop-blur-sm", cronModalPopoverClassName)}>
                              {CRON_PRESET_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {(editorForm.preset === "every_minutes" || editorForm.preset === "every_hours") && (
                          <NumberField
                            id="cron-interval"
                            label={editorForm.preset === "every_minutes" ? "Intervalo em minutos" : "Intervalo em horas"}
                            value={editorForm.interval}
                            min={1}
                            max={editorForm.preset === "every_minutes" ? 59 : 23}
                            onChange={(value) =>
                              updateEditorForm((current) => ({ ...current, interval: value }))
                            }
                          />
                        )}

                        {editorForm.preset === "every_hours" && (
                          <NumberField
                            id="cron-hour-minute"
                            label="Executar no minuto"
                            value={editorForm.minute}
                            min={0}
                            max={59}
                            onChange={(value) =>
                              updateEditorForm((current) => ({ ...current, minute: value }))
                            }
                          />
                        )}

                        {(editorForm.preset === "daily" ||
                          editorForm.preset === "weekly" ||
                          editorForm.preset === "monthly") && (
                            <>
                              <NumberField
                                id="cron-hour"
                                label="Hora"
                                value={editorForm.hour}
                                min={0}
                                max={23}
                                onChange={(value) =>
                                  updateEditorForm((current) => ({ ...current, hour: value }))
                                }
                              />
                              <NumberField
                                id="cron-minute"
                                label="Minuto"
                                value={editorForm.minute}
                                min={0}
                                max={59}
                                onChange={(value) =>
                                  updateEditorForm((current) => ({ ...current, minute: value }))
                                }
                              />
                            </>
                          )}

                        {editorForm.preset === "weekly" && (
                          <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="cron-weekday">Dia da semana</Label>
                            <Select
                              value={editorForm.weekday}
                              onValueChange={(value) =>
                                updateEditorForm((current) => ({ ...current, weekday: value }))
                              }
                            >
                              <SelectTrigger id="cron-weekday" className={cronModalFieldClassName}>
                                <SelectValue placeholder="Selecione o dia" />
                              </SelectTrigger>
                              <SelectContent className={cn("backdrop-blur-sm", cronModalPopoverClassName)}>
                                {CRON_WEEKDAY_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        {editorForm.preset === "monthly" && (
                          <div className="space-y-2 md:col-span-2">
                            <NumberField
                              id="cron-day-of-month"
                              label="Dia do mes"
                              value={editorForm.dayOfMonth}
                              min={1}
                              max={31}
                              onChange={(value) =>
                                updateEditorForm((current) => ({ ...current, dayOfMonth: value }))
                              }
                            />
                          </div>
                        )}
                      </div>
                  ) : (
                    <div className={cn("space-y-2 p-4", cronModalCardClassName)}>
                      <Label htmlFor="cron-expression">Expressao cron</Label>
                      <Input
                          id="cron-expression"
                          value={editorForm.expression}
                          onChange={(event) =>
                            updateEditorForm((current) => ({
                              ...current,
                              expression: event.target.value,
                            }))
                          }
                          className={cn("font-mono", cronModalFieldClassName)}
                          placeholder="Ex: 0 */6 * * *"
                        />
                      <p className="text-xs text-skin-text-muted">
                        Use o modo avancado apenas quando o formato simplificado nao cobrir o caso.
                      </p>
                    </div>
                  )}
                </div>

                <div className={cn("p-4", cronModalCardClassName)}>
                  <div className="grid gap-3 md:grid-cols-3">
                    <TaskDataItem label="Expressao final">
                      <code className="font-mono text-[11px] text-skin-text-muted">{finalSchedule || "-"}</code>
                    </TaskDataItem>
                    <TaskDataItem label="Descricao">
                      {finalSchedule ? humanizeCronExpression(finalSchedule) : "-"}
                      </TaskDataItem>
                      <TaskDataItem label="Proxima execucao estimada">
                        {previewNextRun ? formatDateTime(previewNextRun) : "Sera recalculada apos salvar"}
                      </TaskDataItem>
                    </div>

                    {cronError && (
                      <div className="mt-4 flex items-start gap-2 rounded-xl border border-skin-danger/30 bg-skin-danger/10 px-3 py-2 text-sm text-skin-danger">
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{cronError}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className={cn("border-t px-6 py-4", cronModalChromeClassName)}>
                <Button type="button" variant="outline" onClick={closeEditor} disabled={savingKey === editingJob.key}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() => void saveTaskChanges()}
                  disabled={Boolean(cronError) || savingKey === editingJob.key}
                >
                  {savingKey === editingJob.key ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando
                    </>
                  ) : (
                    "Salvar tarefa"
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function renderStatusBadge(job: CronJob) {
  const status = job.lastStatus || "idle";
  const labels: Record<NonNullable<CronJob["lastStatus"]> | "idle", string> = {
    idle: "Aguardando",
    running: "Executando",
    success: "Sucesso",
    failed: "Falhou",
  };
  const variant =
    status === "failed" ? "destructive" : status === "running" ? "secondary" : "outline";

  return <Badge variant={variant}>{labels[status] || "Aguardando"}</Badge>;
}

function TaskInfoPopover({ description }: { description: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-skin-text-muted transition-colors hover:bg-skin-surface-hover hover:text-skin-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Abrir descricao da tarefa"
        >
          <Info className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-80 max-w-[calc(100vw-1.5rem)] space-y-2 p-4", cronModalPopoverClassName)}
      >
        <p className="text-sm font-medium">Sobre esta tarefa</p>
        <p className="break-words text-sm leading-relaxed text-skin-text-muted">{description}</p>
      </PopoverContent>
    </Popover>
  );
}

function TaskDataItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[18px] border border-border/70 bg-skin-background-elevated/30 px-3 py-2.5 shadow-sm">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-skin-text-muted">{label}</p>
      <div className="min-w-0 break-words text-sm text-skin-text">{children}</div>
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        className={cronModalFieldClassName}
        onChange={(event) => onChange(sanitizeNumberInput(event.target.value, min, max))}
      />
    </div>
  );
}

function sanitizeNumberInput(value: string, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return min;
  }

  return Math.min(max, Math.max(min, parsed));
}

function resolvePreviewNextRun(
  job: CronJob | null,
  finalSchedule: string,
  localPreview: Date | null,
): Date | null {
  if (!job || !finalSchedule) {
    return localPreview;
  }

  if (finalSchedule === job.schedule && job.nextExpectedRunAt) {
    return new Date(job.nextExpectedRunAt);
  }

  return localPreview;
}

function formatDateTime(value?: string | Date | null): string {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return format(date, "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
}

function formatDurationMs(value?: number): string {
  if (!value || value <= 0) {
    return "-";
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} s`;
  }

  return `${value} ms`;
}


