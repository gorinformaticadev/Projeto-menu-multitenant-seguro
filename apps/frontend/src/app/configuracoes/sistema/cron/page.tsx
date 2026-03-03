"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, Clock, Pause, Play, RotateCw, Save, Settings, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";

interface CronJob {
  key: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  editable?: boolean;
  lastRun?: string;
  nextRun?: string;
  settingsUrl?: string;
}

export default function CronJobsPage() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState("");

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get("/cron");
      setJobs(response.data);
    } catch {
      toast({
        title: "Erro ao carregar jobs",
        description: "Nao foi possivel listar as tarefas agendadas",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleTrigger = async (key: string) => {
    try {
      setSavingKey(key);
      await api.post(`/cron/${key}/trigger`);
      toast({
        title: "Job iniciado",
        description: "A tarefa foi colocada na fila de execucao",
      });
      await fetchJobs();
    } catch {
      toast({
        title: "Erro ao iniciar job",
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
        title: currentStatus ? "Job pausado" : "Job ativado",
        description: "O status do agendamento foi atualizado",
      });
      await fetchJobs();
    } catch {
      toast({
        title: "Erro ao atualizar status",
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
  };

  const startEditingSchedule = (job: CronJob) => {
    setEditingKey(job.key);
    setScheduleDraft(job.schedule);
  };

  const cancelEditingSchedule = () => {
    setEditingKey(null);
    setScheduleDraft("");
  };

  const saveSchedule = async (key: string) => {
    const schedule = scheduleDraft.trim();
    if (!schedule) {
      toast({
        title: "Cron invalido",
        description: "Informe uma expressao cron valida",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingKey(key);
      await api.put(`/cron/${key}/schedule`, { schedule });
      toast({
        title: "Periodicidade atualizada",
        description: `Novo cron: ${schedule}`,
      });
      cancelEditingSchedule();
      await fetchJobs();
    } catch (error: any) {
      toast({
        title: "Erro ao salvar periodicidade",
        description: error?.response?.data?.message || "Nao foi possivel salvar a expressao cron",
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Carregando tarefas...</div>;
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Clock className="h-8 w-8" />
            Agendamento de Tarefas
          </h1>
          <p className="text-muted-foreground mt-2">
            Ative, pause e edite a periodicidade das rotinas automaticas
          </p>
        </div>
        <Button onClick={fetchJobs} variant="outline">
          <RotateCw className="h-4 w-4 mr-2" />
          Atualizar Lista
        </Button>
      </div>

      <div className="grid gap-4">
        {jobs.map((job) => {
          const isBusy = savingKey === job.key;
          const isEditing = editingKey === job.key;

          return (
            <Card key={job.key} className={!job.enabled ? "opacity-75 bg-muted/50" : ""}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    {job.name}
                    <Badge variant={job.enabled ? "default" : "secondary"}>
                      {job.enabled ? "Ativo" : "Pausado"}
                    </Badge>
                  </CardTitle>
                  <CardDescription>{job.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {job.settingsUrl && (
                    <Button variant="ghost" size="sm" asChild title="Configurar Job">
                      <a href={job.settingsUrl}>
                        <Settings className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => handleTrigger(job.key)}
                    title="Executar Agora"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => handleToggle(job.key, job.enabled)}
                    title={job.enabled ? "Pausar" : "Ativar"}
                  >
                    {job.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3 text-sm mt-4 md:grid-cols-3">
                  <div>
                    <span className="text-muted-foreground block text-xs">Cronograma</span>
                    {!isEditing ? (
                      <div className="flex items-center gap-2 mt-1">
                        <code className="bg-muted px-2 py-1 rounded text-xs font-mono">{job.schedule}</code>
                        {job.editable !== false && (
                          <Button size="sm" variant="outline" onClick={() => startEditingSchedule(job)}>
                            Editar
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          value={scheduleDraft}
                          onChange={(e) => setScheduleDraft(e.target.value)}
                          placeholder="Ex: 0 2 * * *"
                          className="font-mono"
                        />
                        <Button
                          size="sm"
                          onClick={() => saveSchedule(job.key)}
                          disabled={isBusy}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Salvar
                        </Button>
                        <Button size="sm" variant="outline" onClick={cancelEditingSchedule} disabled={isBusy}>
                          <X className="h-4 w-4 mr-1" />
                          Cancelar
                        </Button>
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Ultima Execucao</span>
                    {job.lastRun ? format(new Date(job.lastRun), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : "-"}
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Proxima Execucao</span>
                    {job.enabled && job.nextRun ? (
                      <span className="text-green-600 font-medium">
                        {format(new Date(job.nextRun), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Agendamento pausado</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {jobs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            Nenhuma tarefa agendada encontrada.
          </div>
        )}
      </div>
    </div>
  );
}
