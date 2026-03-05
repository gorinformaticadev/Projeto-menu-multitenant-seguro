'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Download, FileDown, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

interface BackupSectionProps {
  onBackupComplete?: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

interface AvailableBackup {
  id: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

interface JobLogEntry {
  message?: string;
}

export function BackupSection({
  onBackupComplete,
  disabled = false,
  disabledReason,
}: BackupSectionProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [availableBackups, setAvailableBackups] = useState<AvailableBackup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);

  useEffect(() => {
    void loadAvailableBackups();
  }, []);

  useEffect(() => {
    if (!loading || !startTime) {
      return;
    }
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [loading, startTime]);

  const loadAvailableBackups = async () => {
    try {
      setLoadingBackups(true);
      const response = await api.get('/backups?limit=200');
      const artifacts = response.data?.data?.artifacts || [];
      setAvailableBackups(
        artifacts.map((artifact: any) => ({
          id: artifact.id,
          fileName: artifact.fileName,
          fileSize: artifact.fileSize,
          createdAt: artifact.createdAt,
        })),
      );
    } catch (error) {
      console.error('Erro ao carregar backups:', error);
    } finally {
      setLoadingBackups(false);
    }
  };

  const waitForJob = async (jobId: string) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 60 * 60 * 1000) {
      const response = await api.get(`/backups/jobs/${jobId}`);
      const job = response.data?.data;
      if (job) {
        const logs = Array.isArray(job.logs) ? (job.logs as JobLogEntry[]) : [];
        const lastMessages = logs
          .slice(-5)
          .map((entry) => entry?.message || '')
          .filter((entry) => entry.length > 0);
        if (lastMessages.length > 0) {
          setProgressMessages(lastMessages);
        }
        setProgress(`${job.currentStep || 'RUNNING'} (${job.progressPercent ?? 0}%)`);

        if (job.status === 'SUCCESS') {
          return job;
        }
        if (job.status === 'FAILED' || job.status === 'CANCELED') {
          throw new Error(job.error || `Job finalizou com status ${job.status}`);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    throw new Error('Timeout ao aguardar job de backup');
  };

  const handleCreateBackup = async () => {
    try {
      setLoading(true);
      setStartTime(Date.now());
      setProgress('Iniciando backup...');
      setProgressMessages([]);

      const response = await api.post('/backups');
      const jobId = response.data?.data?.jobId as string | undefined;
      if (!jobId) {
        throw new Error('jobId nao retornado');
      }

      const finishedJob = await waitForJob(jobId);
      setProgress('Backup concluido');

      toast({
        title: 'Backup criado com sucesso',
        description: finishedJob.fileName || 'Arquivo pronto para download',
      });

      await loadAvailableBackups();
      onBackupComplete?.();
    } catch (error: unknown) {
      console.error('Erro ao criar backup:', error);
      setProgress('Erro ao criar backup');
      toast({
        title: 'Erro ao criar backup',
        description:
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (error instanceof Error ? error.message : 'Erro interno do servidor'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setStartTime(null);
      setTimeout(() => {
        setProgress('');
        setElapsedTime(0);
        setProgressMessages([]);
      }, 3000);
    }
  };

  const handleDownloadBackup = async (backup: AvailableBackup) => {
    const response = await api.get(`/backups/${encodeURIComponent(backup.id)}/download`, {
      responseType: 'blob',
    });

    const blob = response.data as Blob;
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = backup.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleDeleteBackup = async (backup: AvailableBackup) => {
    if (!confirm(`Tem certeza que deseja apagar o backup "${backup.fileName}"?`)) {
      return;
    }
    await api.delete(`/backup/delete/${encodeURIComponent(backup.fileName)}`);
    await loadAvailableBackups();
    onBackupComplete?.();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Criar Backup do Banco de Dados
        </CardTitle>
        <CardDescription>Exportar snapshot completo de todos os dados do sistema</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {disabled && (
          <div className="flex items-start gap-3 p-4 border border-amber-200 bg-amber-50 rounded-lg">
            <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              {disabledReason || 'Acoes de backup estao bloqueadas enquanto o sistema esta em manutencao.'}
            </div>
          </div>
        )}

        <div className="flex items-start gap-3 p-4 border border-blue-200 bg-blue-50 rounded-lg">
          <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Sobre o Backup:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Formato PostgreSQL custom (.dump/.backup)</li>
              <li>Retencao automatica dos arquivos antigos</li>
              <li>Execucao assincrona com status e logs</li>
            </ul>
          </div>
        </div>

        <Button onClick={handleCreateBackup} disabled={loading || disabled} className="bg-blue-600 hover:bg-blue-700">
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Criando Backup...
            </>
          ) : (
            <>
              <Download className="w-4 h-4 mr-2" />
              Criar Backup Agora
            </>
          )}
        </Button>

        {loading && (
          <div className="space-y-2 p-3 border rounded bg-gray-50">
            <p className="text-sm font-medium">{progress}</p>
            <p className="text-xs text-gray-500">Tempo decorrido: {elapsedTime}s</p>
            {progressMessages.map((msg, index) => (
              <p key={index} className="text-xs text-gray-600 font-mono">
                {msg}
              </p>
            ))}
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Backups Disponiveis</h3>
              <p className="text-xs text-gray-500 mt-1">Arquivos salvos no servidor</p>
            </div>
            <Button onClick={loadAvailableBackups} disabled={loadingBackups || disabled} variant="outline" size="sm">
              <RefreshCw className={`w-3 h-3 mr-1 ${loadingBackups ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {availableBackups.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <FileDown className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Nenhum backup encontrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableBackups.map((backup) => (
                <div key={backup.id} className="border rounded p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{backup.fileName}</p>
                    <p className="text-xs text-gray-500">
                      {(backup.fileSize / 1024 / 1024).toFixed(2)} MB {' '}•{' '}
                      {new Date(backup.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleDownloadBackup(backup)} disabled={disabled}>
                      <Download className="w-3 h-3 mr-1" />
                      Baixar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteBackup(backup)} disabled={disabled}>
                      <Trash2 className="w-3 h-3 mr-1" />
                      Apagar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
