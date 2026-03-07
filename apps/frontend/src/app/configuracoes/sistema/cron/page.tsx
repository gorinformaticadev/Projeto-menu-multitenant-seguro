"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  Clock3,
  Info,
  Loader2,
  Pause,
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

export default function CronJobsPage() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
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

  if (loading) {
    return <div className="p-8 text-center">Carregando tarefas agendadas...</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <Clock3 className="h-8 w-8 text-primary" />
            Tarefas agendadas
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Acompanhe rotinas automaticas, entenda o cronograma sem ler expressao crua e ajuste
            a execucao em um fluxo mais administrativo.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {runningCount} ativas
          </Badge>
          <Badge variant={runtimeIssuesCount > 0 ? "destructive" : "outline"} className="rounded-full px-3 py-1">
            {runtimeIssuesCount > 0 ? `${runtimeIssuesCount} com divergencia` : "Runtime sincronizado"}
          </Badge>
          <Button onClick={() => void fetchJobs(true)} variant="outline">
            <RotateCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      <Card className="border-dashed border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Alteracoes aplicadas em quente
            </p>
            <p className="text-sm text-muted-foreground">
              Ao salvar uma tarefa, o runtime e a proxima execucao estimada sao atualizados sem
              reiniciar a aplicacao.
            </p>
          </div>
          <div className="rounded-2xl border border-primary/20 bg-background/70 px-4 py-3 text-xs text-muted-foreground">
            O cron cru continua disponivel no modo avancado para casos especiais.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {jobs.map((job) => {
          const isBusy = savingKey === job.key;
          const presentation = getCronTaskPresentation(job);
          const scheduleSummary = describeCronSchedule(job.schedule);

          return (
            <Card
              key={job.key}
              className={
                !job.enabled
                  ? "border-dashed border-amber-300/70 bg-gradient-to-br from-amber-50 via-white to-slate-100 shadow-[0_0_0_1px_rgba(245,158,11,0.10),0_18px_40px_-28px_rgba(245,158,11,0.55)] dark:border-amber-900/60 dark:bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.14),transparent_42%),linear-gradient(135deg,rgba(51,65,85,0.88),rgba(15,23,42,0.92))]"
                  : "border-sky-200/80 bg-gradient-to-br from-sky-50 via-white to-cyan-50 shadow-[0_0_0_1px_rgba(14,165,233,0.10),0_20px_44px_-30px_rgba(14,165,233,0.45)] dark:border-sky-900/60 dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_40%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(12,74,110,0.62))]"
              }
            >
              <CardHeader className="gap-3 border-b border-border/50 pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-base font-semibold">{presentation.label}</CardTitle>
                      <TaskInfoPopover description={presentation.description} />
                      <Badge variant={job.enabled ? "default" : "secondary"}>
                        {job.enabled ? "Ativa" : "Pausada"}
                      </Badge>
                      {renderStatusBadge(job)}
                      <Badge variant={job.runtimeRegistered ? "outline" : "destructive"}>
                        {job.runtimeRegistered ? "Aplicada em runtime" : "Nao carregada no runtime"}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-background/90 px-2.5 py-1 shadow-sm">
                        {job.origin === "modulo" ? "Origem: modulo" : "Origem: plataforma"}
                      </span>
                      <span className="rounded-full bg-background/90 px-2.5 py-1 shadow-sm">
                        Fonte: {job.sourceOfTruth === "database" ? "configuracao persistida" : "runtime"}
                      </span>
                      {job.editable === false && (
                        <span className="rounded-full bg-background/90 px-2.5 py-1 shadow-sm">Cronograma fixo</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 self-start">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isBusy}
                      onClick={() => openEditor(job)}
                      title="Editar tarefa"
                      aria-label={`Editar tarefa ${presentation.label}`}
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isBusy}
                      onClick={() => void handleTrigger(job.key)}
                      title="Executar agora"
                      aria-label={`Executar agora ${presentation.label}`}
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isBusy}
                      onClick={() => void handleToggle(job.key, job.enabled)}
                      title={job.enabled ? "Pausar tarefa" : "Ativar tarefa"}
                      aria-label={job.enabled ? `Pausar tarefa ${presentation.label}` : `Ativar tarefa ${presentation.label}`}
                    >
                      {job.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-4">
                <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                  <TaskDataItem label="Cronograma">
                    <p className="font-medium text-foreground">{scheduleSummary.label}</p>
                    <code className="mt-2 inline-flex rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                      {job.schedule}
                    </code>
                  </TaskDataItem>

                  <TaskDataItem label="Ultima execucao">
                    {formatDateTime(job.lastStartedAt || job.lastRun)}
                  </TaskDataItem>

                  <TaskDataItem label="Ultimo sucesso">
                    {formatDateTime(job.lastSucceededAt)}
                  </TaskDataItem>

                  <TaskDataItem label="Ultima falha">
                    {formatDateTime(job.lastFailedAt)}
                  </TaskDataItem>

                  <TaskDataItem label="Proxima execucao">
                    {job.enabled ? formatDateTime(job.nextRun || job.nextExpectedRunAt) : "Agendamento pausado"}
                  </TaskDataItem>

                  <TaskDataItem label="Duracao / heartbeat">
                    <div className="space-y-1">
                      <p>{formatDurationMs(job.lastDurationMs)}</p>
                      {typeof job.consecutiveFailureCount === "number" && (
                        <p className="text-xs text-muted-foreground">
                          Falhas seguidas: {job.consecutiveFailureCount}
                        </p>
                      )}
                    </div>
                  </TaskDataItem>

                  <TaskDataItem label="Proximo horario esperado">
                    {formatDateTime(job.nextExpectedRunAt)}
                  </TaskDataItem>

                  <TaskDataItem label="Chave tecnica">
                    <code className="font-mono text-[11px] text-muted-foreground">{job.key}</code>
                  </TaskDataItem>
                </div>

                {job.issue === "runtime_not_registered" && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    Esta tarefa foi salva na configuracao, mas ainda nao esta registrada no runtime atual.
                  </div>
                )}

                {job.lastError && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
                    <span className="font-medium">Ultimo erro:</span> {job.lastError}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {jobs.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
            Nenhuma tarefa agendada encontrada.
          </div>
        )}
      </div>

      <Dialog open={Boolean(editingJob && editorForm)} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="max-w-2xl">
          {editingJob && editorForm && (
            <>
              <DialogHeader>
                <DialogTitle>Editar tarefa</DialogTitle>
                <DialogDescription>
                  Ajuste o cronograma, confirme a proxima execucao e aplique as alteracoes no runtime.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="grid gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4 md:grid-cols-[1.4fr,1fr]">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Nome amigavel
                    </Label>
                    <p className="text-sm font-semibold text-foreground">
                      {getCronTaskPresentation(editingJob).label}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getCronTaskPresentation(editingJob).description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Esse nome e apenas a identificacao amigavel exibida na interface. A chave tecnica abaixo continua fixa.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                        Chave tecnica
                      </Label>
                      <code className="inline-flex rounded-md bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground">
                        {editingJob.key}
                      </code>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">Tarefa ativa</p>
                        <p className="text-xs text-muted-foreground">
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
                    <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                      Esta tarefa usa um cronograma fixo. Voce ainda pode ativar ou pausar a execucao.
                    </div>
                  ) : editorForm.mode === "simple" ? (
                    <div className="grid gap-3 rounded-2xl border border-border/70 p-4 md:grid-cols-2">
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
                          <SelectTrigger id="cron-preset">
                            <SelectValue placeholder="Selecione a frequencia" />
                          </SelectTrigger>
                          <SelectContent>
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
                            <SelectTrigger id="cron-weekday">
                              <SelectValue placeholder="Selecione o dia" />
                            </SelectTrigger>
                            <SelectContent>
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
                    <div className="space-y-2 rounded-2xl border border-border/70 p-4">
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
                        className="font-mono"
                        placeholder="Ex: 0 */6 * * *"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use o modo avancado apenas quando o formato simplificado nao cobrir o caso.
                      </p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <TaskDataItem label="Expressao final">
                      <code className="font-mono text-[11px] text-muted-foreground">{finalSchedule || "-"}</code>
                    </TaskDataItem>
                    <TaskDataItem label="Descricao">
                      {finalSchedule ? humanizeCronExpression(finalSchedule) : "-"}
                    </TaskDataItem>
                    <TaskDataItem label="Proxima execucao estimada">
                      {previewNextRun ? formatDateTime(previewNextRun) : "Sera recalculada apos salvar"}
                    </TaskDataItem>
                  </div>

                  {cronError && (
                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{cronError}</span>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
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
            </>
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
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label="Abrir descricao da tarefa"
        >
          <Info className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-2">
        <p className="text-sm font-medium text-foreground">Sobre esta tarefa</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
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
    <div className="rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/75">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
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
