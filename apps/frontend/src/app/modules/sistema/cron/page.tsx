"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Clock, Play, RotateCw, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CronJob {
    key: string;
    name: string;
    description: string;
    schedule: string;
    enabled: boolean;
    lastRun?: string;
    nextRun?: string;
}

export default function SistemaCronPage() {
    const { toast } = useToast();
    const [jobs, setJobs] = useState<CronJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        fetchJobs();
    }, []);

    const fetchJobs = async () => {
        try {
            setLoading(true);
            const response = await api.get('/cron');
            setJobs(response.data);
        } catch (error) {
            console.error('Erro ao carregar Jobs:', error);
            toast({
                title: 'Erro',
                description: 'Não foi possível carregar a lista de tarefas agendadas.',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (key: string, currentStatus: boolean) => {
        try {
            setProcessing(key);
            const newStatus = !currentStatus;
            await api.put(`/cron/${key}/toggle`, { enabled: newStatus });

            // Update local state optimistic
            setJobs(jobs.map(j => j.key === key ? { ...j, enabled: newStatus } : j));

            toast({
                title: newStatus ? 'Tarefa Ativada' : 'Tarefa Pausada',
                description: `A tarefa foi ${newStatus ? 'ativada' : 'pausada'} com sucesso.`
            });
        } catch (error) {
            toast({
                title: 'Erro ao alterar status',
                variant: 'destructive'
            });
            fetchJobs(); // Revert on error
        } finally {
            setProcessing(null);
        }
    };

    const handleTrigger = async (key: string) => {
        try {
            setProcessing(key);
            await api.post(`/cron/${key}/trigger`);
            toast({
                title: 'Execução Iniciada',
                description: 'A tarefa foi disparada manualmente.',
            });
            // Refresh list to potentially show new lastRun time (if backend updates fast enough, otherwise user refreshes)
            setTimeout(fetchJobs, 1000);
        } catch (error) {
            toast({
                title: 'Erro ao disparar tarefa',
                variant: 'destructive'
            });
        } finally {
            setProcessing(null);
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'Nunca executado';
        try {
            return format(new Date(dateStr), "dd/MM/yyyy HH:mm:ss", { locale: ptBR });
        } catch {
            return dateStr;
        }
    };

    if (loading && jobs.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Carregando tarefas...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-6xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold flex items-center gap-2 text-primary">
                    <Clock className="h-8 w-8" />
                    Tarefas Agendadas (Cron)
                </h1>
                <Button variant="outline" size="sm" onClick={fetchJobs} disabled={loading}>
                    <RotateCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </Button>
            </div>

            <div className="grid gap-6">
                {jobs.length === 0 ? (
                    <Card className="bg-slate-50 border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <AlertCircle className="h-12 w-12 mb-4 opacity-20" />
                            <p>Nenhuma tarefa agendada encontrada.</p>
                        </CardContent>
                    </Card>
                ) : (
                    jobs.map((job) => (
                        <Card key={job.key} className={`transition-all ${!job.enabled ? 'opacity-70 bg-slate-50' : ''}`}>
                            <CardContent className="p-6">
                                <div className="flex flex-col md:flex-row md:items-center gap-6 justify-between">
                                    <div className="space-y-1 flex-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-lg">{job.name}</h3>
                                            <Badge variant={job.enabled ? "default" : "secondary"}>
                                                {job.enabled ? 'Ativo' : 'Pausado'}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{job.description}</p>
                                        <div className="flex items-center gap-4 mt-2 text-xs font-mono text-slate-500 bg-slate-100 w-fit px-2 py-1 rounded">
                                            <span>Schedule: {job.schedule}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-8 text-sm text-muted-foreground whitespace-nowrap">
                                        <div className="text-right">
                                            <p className="text-xs uppercase tracking-wider font-semibold">Última Execução</p>
                                            <p>{formatDate(job.lastRun)}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs uppercase tracking-wider font-semibold">Próxima Execução</p>
                                            <p className="text-blue-600 font-medium">{formatDate(job.nextRun)}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 pt-4 md:pt-0 border-t md:border-t-0 mt-4 md:mt-0">
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={job.enabled}
                                                onCheckedChange={() => handleToggle(job.key, job.enabled)}
                                                disabled={!!processing && processing === job.key}
                                            />
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => handleTrigger(job.key)}
                                            disabled={!!processing}
                                        >
                                            <Play className="h-3 w-3 mr-2" />
                                            Executar Agora
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
