'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, Database, RefreshCw, Upload, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

interface RestoreSectionProps {
  onRestoreComplete?: () => void;
  disabled?: boolean;
  disabledReason?: string;
}

interface AvailableBackup {
  id: string;
  fileName: string;
  fileSize: number;
  createdAt: string;
}

interface RestoreJobView {
  id: string;
  status: string;
  currentStep?: string;
  progressPercent?: number;
  fileName?: string;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export function RestoreSection({
  onRestoreComplete,
  disabled = false,
  disabledReason,
}: RestoreSectionProps) {
  const { toast } = useToast();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [availableBackups, setAvailableBackups] = useState<AvailableBackup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [loadingUpload, setLoadingUpload] = useState(false);
  const [selectedBackupId, setSelectedBackupId] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');
  const [runMigrations, setRunMigrations] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [loadingRestore, setLoadingRestore] = useState(false);
  const [restoreJob, setRestoreJob] = useState<RestoreJobView | null>(null);

  const expectedConfirmation = useMemo(
    () => (selectedFileName ? `RESTORE ${selectedFileName}` : 'RESTORE'),
    [selectedFileName],
  );

  const loadAvailableBackups = useCallback(async () => {
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
      toast({
        title: 'Erro ao carregar backups',
        description: 'Nao foi possivel listar backups disponiveis',
        variant: 'destructive',
      });
    } finally {
      setLoadingBackups(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadAvailableBackups();
  }, [loadAvailableBackups]);

  const pollJob = async (jobId: string) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 60 * 60 * 1000) {
      const response = await api.get(`/backups/jobs/${jobId}`);
      const job = response.data?.data as RestoreJobView;
      setRestoreJob(job);

      if (job.status === 'SUCCESS') {
        return job;
      }
      if (job.status === 'FAILED' || job.status === 'CANCELED') {
        throw new Error(job.error || `Job finalizou com status ${job.status}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    throw new Error('Timeout ao aguardar restore');
  };

  const handleUploadBackup = async () => {
    if (!uploadFile) {
      toast({
        title: 'Selecione um arquivo',
        description: 'Escolha um backup .dump ou .backup para enviar',
        variant: 'destructive',
      });
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      setLoadingUpload(true);
      const response = await api.post('/backups/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const artifactId = response.data?.data?.artifactId as string | undefined;
      const fileName = response.data?.data?.fileName as string | undefined;

      if (artifactId && fileName) {
        setSelectedBackupId(artifactId);
        setSelectedFileName(fileName);
      }

      setUploadFile(null);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = '';
      }

      await loadAvailableBackups();

      toast({
        title: 'Backup enviado',
        description: fileName ? `Arquivo ${fileName} pronto para restore` : 'Upload concluido',
      });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao enviar backup',
        description:
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Nao foi possivel enviar o arquivo',
        variant: 'destructive',
      });
    } finally {
      setLoadingUpload(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedBackupId) {
      toast({
        title: 'Selecione um backup',
        description: 'Escolha um arquivo para restaurar',
        variant: 'destructive',
      });
      return;
    }

    if (confirmationText !== expectedConfirmation) {
      toast({
        title: 'Confirmacao invalida',
        description: `Digite exatamente: ${expectedConfirmation}`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoadingRestore(true);
      setRestoreJob(null);

      const response = await api.post(`/backups/${encodeURIComponent(selectedBackupId)}/restore`, {
        runMigrations,
        forceCrossEnvironment: true,
        reason: 'Restore solicitado na tela de configuracoes',
      });

      const jobId = response.data?.data?.jobId as string | undefined;
      if (!jobId) {
        throw new Error('jobId nao retornado');
      }

      await pollJob(jobId);
      toast({
        title: 'Restore concluido',
        description: 'Banco restaurado com sucesso',
      });
      onRestoreComplete?.();
    } catch (error: unknown) {
      toast({
        title: 'Restore falhou',
        description:
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          (error instanceof Error ? error.message : 'Erro interno do servidor'),
        variant: 'destructive',
      });
    } finally {
      setLoadingRestore(false);
    }
  };

  const normalizedRestoreStatus = (restoreJob?.status || '').toUpperCase();
  const restoreStatusUi =
    normalizedRestoreStatus === 'SUCCESS'
      ? {
          container: 'border-skin-success/30 bg-skin-success/10',
          text: 'text-skin-success',
          icon: 'text-skin-success',
          step: 'text-skin-success',
          error: 'text-skin-success',
        }
      : normalizedRestoreStatus === 'FAILED' || normalizedRestoreStatus === 'CANCELED'
        ? {
            container: 'border-skin-danger/30 bg-skin-danger/10',
            text: 'text-skin-danger',
            icon: 'text-skin-danger',
            step: 'text-skin-danger',
            error: 'text-skin-danger',
          }
        : {
            container: 'border-skin-info/30 bg-skin-info/10',
            text: 'text-skin-info',
            icon: 'text-skin-info',
            step: 'text-skin-info',
            error: 'text-skin-info',
          };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Restaurar Banco por Backup
        </CardTitle>
        <CardDescription>Restore assincrono com validacao e lock global</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {disabled && (
          <div className="flex items-start gap-3 rounded-lg border border-skin-warning/30 bg-skin-warning/10 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-skin-warning" />
            <div className="text-sm text-skin-warning">
              {disabledReason || 'Acoes de restore estao bloqueadas enquanto o sistema esta em manutencao.'}
            </div>
          </div>
        )}

        <div className="flex items-start gap-3 rounded-lg border border-skin-danger/30 bg-skin-danger/10 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-skin-danger" />
          <div className="text-sm text-skin-danger">
            <p className="font-bold mb-1">Operacao destrutiva</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Cria staging + validacao antes do cutover</li>
              <li>Ativa modo manutencao durante o cutover</li>
              <li>Apenas SUPER_ADMIN pode executar</li>
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="backup-upload">Enviar backup para a plataforma</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="backup-upload"
              ref={uploadInputRef}
              type="file"
              accept=".dump,.backup"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              disabled={loadingUpload || loadingRestore || disabled}
            />
            <Button
              variant="outline"
              onClick={handleUploadBackup}
              disabled={!uploadFile || loadingUpload || loadingRestore || disabled}
            >
              {loadingUpload ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Enviar backup
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="backup-select">Arquivo de backup</Label>
            <Button variant="outline" size="sm" onClick={loadAvailableBackups} disabled={loadingBackups || disabled}>
              <RefreshCw className={`w-3 h-3 mr-1 ${loadingBackups ? 'animate-spin' : ''}`} />
              Atualizar lista
            </Button>
          </div>
          <select
            id="backup-select"
            className="w-full rounded-md border border-skin-input-border bg-skin-input-background px-3 py-2 text-skin-text"
            value={selectedBackupId}
            onChange={(e) => {
              const selected = availableBackups.find((item) => item.id === e.target.value);
              setSelectedBackupId(e.target.value);
              setSelectedFileName(selected?.fileName || '');
            }}
            disabled={loadingBackups || loadingRestore || loadingUpload || disabled}
          >
            <option value="">Selecione um backup...</option>
            {availableBackups.map((backup) => (
              <option key={backup.id} value={backup.id}>
                {backup.fileName} ({(backup.fileSize / 1024 / 1024).toFixed(2)} MB)
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="run-migrations"
            type="checkbox"
            checked={runMigrations}
            onChange={(e) => setRunMigrations(e.target.checked)}
            disabled={loadingRestore || disabled}
          />
          <Label htmlFor="run-migrations">Executar migrate deploy apos restore</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-text">Confirmacao</Label>
          <Input
            id="confirm-text"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder={expectedConfirmation}
            disabled={loadingRestore || disabled}
          />
          <p className="text-xs text-muted-foreground">
            Digite exatamente: <strong>{expectedConfirmation}</strong>
          </p>
        </div>

        <Button
          onClick={handleRestore}
          disabled={loadingRestore || !selectedBackupId || confirmationText !== expectedConfirmation || disabled}
          className="bg-skin-danger text-skin-text-inverse hover:bg-skin-danger/90"
        >
          {loadingRestore ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Restaurando...
            </>
          ) : (
            'Restaurar banco'
          )}
        </Button>

        {restoreJob && (
          <div className={`border rounded-lg p-4 space-y-2 ${restoreStatusUi.container}`}>
            <div className="flex items-center gap-2">
              {restoreJob.status === 'SUCCESS' ? (
                <CheckCircle className={`w-4 h-4 ${restoreStatusUi.icon}`} />
              ) : restoreJob.status === 'FAILED' || restoreJob.status === 'CANCELED' ? (
                <XCircle className={`w-4 h-4 ${restoreStatusUi.icon}`} />
              ) : (
                <RefreshCw className={`w-4 h-4 animate-spin ${restoreStatusUi.icon}`} />
              )}
              <span className={`font-medium ${restoreStatusUi.text}`}>
                Status: {restoreJob.status} ({restoreJob.progressPercent ?? 0}%)
              </span>
            </div>
            {restoreJob.currentStep && <p className={`text-sm ${restoreStatusUi.step}`}>Etapa: {restoreJob.currentStep}</p>}
            {restoreJob.error && <p className={`text-sm ${restoreStatusUi.error}`}>Erro: {restoreJob.error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
