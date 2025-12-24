"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Play, Pause, RotateCw, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CronJob {
    key: string;
    name: string;
    description: string;
    schedule: string;
    enabled: boolean;
    lastRun?: string;
    nextRun?: string;
}

export default function CronJobsPage() {
    const { toast } = useToast();
    const [jobs, setJobs] = useState<CronJob[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchJobs = async () => {
        try {
            setLoading(true);
            const response = await api.get("/cron");
            setJobs(response.data);
        } catch (error) {
            toast({
                title: "Erro ao carregar jobs",
                description: "Não foi possível listar as tarefas agendadas",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, []);

    const handleTrigger = async (key: string) => {
        try {
            await api.post(`/cron/${key}/trigger`);
            toast({
                title: "Job iniciado",
                description: "A tarefa foi colocada na fila de execução",
            });
            fetchJobs();
        } catch (error) {
            toast({
                title: "Erro ao iniciar job",
                variant: "destructive",
            });
        }
    };

    const handleToggle = async (key: string, currentStatus: boolean) => {
        try {
            await api.put(`/cron/${key}/toggle`, { enabled: !currentStatus });
            toast({
                title: currentStatus ? "Job pausado" : "Job ativado",
                description: "O status do agendamento foi atualizado",
            });
            fetchJobs();
        } catch (error) {
            toast({
                title: "Erro ao atualizar status",
                variant: "destructive",
            });
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
                        Gerencie as rotinas automáticas do sistema
                    </p>
                </div>
                <Button onClick={fetchJobs} variant="outline">
                    <RotateCw className="h-4 w-4 mr-2" />
                    Atualizar Lista
                </Button>
            </div>

            <div className="grid gap-4">
                {jobs.map((job) => (
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
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleTrigger(job.key)}
                                    title="Executar Agora"
                                >
                                    <Play className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleToggle(job.key, job.enabled)}
                                    title={job.enabled ? "Pausar" : "Ativar"}
                                >
                                    {job.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4 text-sm mt-4">
                                <div>
                                    <span className="text-muted-foreground block text-xs">Cronograma</span>
                                    <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                                        {job.schedule}
                                    </code>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs">Última Execução</span>
                                    {job.lastRun ? (
                                        format(new Date(job.lastRun), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
                                    ) : (
                                        "-"
                                    )}
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-xs">Próxima Execução</span>
                                    {job.enabled && job.nextRun ? (
                                        <span className="text-green-600 font-medium">
                                            {format(new Date(job.nextRun), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground">Agendamento Pausado</span>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}

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
