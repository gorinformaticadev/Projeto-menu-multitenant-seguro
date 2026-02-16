'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, AlertTriangle, Database, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

interface RestoreSectionProps {
  onRestoreComplete?: () => void;
}

interface AvailableBackup {
  fileName: string;
  fileSize: number;
  createdAt: string;
  backupId?: string;
}

interface RestoreLogData {
  id: string;
  status: 'STARTED' | 'SUCCESS' | 'FAILED';
  fileName: string;
  startedAt: string;
  completedAt?: string;
  stdout?: string;
  stderr?: string;
  errorMessage?: string;
}

export function RestoreSection({ onRestoreComplete }: RestoreSectionProps) {
  const { toast } = useToast();
  const [availableBackups, setAvailableBackups] = useState<AvailableBackup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [runMigrations, setRunMigrations] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [loadingRestore, setLoadingRestore] = useState(false);
  const [restoreLog, setRestoreLog] = useState<RestoreLogData | null>(null);

  const expectedConfirmation = useMemo(
    () => (selectedFileName ? `RESTORE ${selectedFileName}` : 'RESTORE'),
    [selectedFileName],
  );

  const loadAvailableBackups = async () => {
    try {
      setLoadingBackups(true);
      const response = await api.get('/api/backup/available');
      setAvailableBackups(response.data.data || []);
    } catch (error) {
      toast({
        title: 'Erro ao carregar backups',
        description: 'Nao foi possivel listar backups disponiveis',
        variant: 'destructive',
      });
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    loadAvailableBackups();
  }, []);

  const pollRestoreLog = (logId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await api.get(`/api/backup/restore-logs/${logId}`);
        const data = response.data?.data as RestoreLogData;
        setRestoreLog(data);

        if (data.status === 'SUCCESS' || data.status === 'FAILED') {
          clearInterval(interval);
          setLoadingRestore(false);

          if (data.status === 'SUCCESS') {
            toast({
              title: 'Restore concluido',
              description: `Banco restaurado com sucesso a partir de ${data.fileName}`,
            });
            onRestoreComplete?.();
          } else {
            toast({
              title: 'Restore falhou',
              description: data.errorMessage || 'Falha ao restaurar backup',
              variant: 'destructive',
            });
          }
        }
      } catch {
        clearInterval(interval);
        setLoadingRestore(false);
      }
    }, 3000);

    setTimeout(() => clearInterval(interval), 30 * 60 * 1000);
  };

  const handleRestore = async () => {
    if (!selectedFileName) {
      toast({ title: 'Selecione um backup', description: 'Escolha um arquivo para restaurar', variant: 'destructive' });
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
      setRestoreLog(null);

      const response = await api.post('/api/backup/restore', {
        backupFile: selectedFileName,
        runMigrations,
        mode: 'restore-only',
      });

      const restoreLogId = response.data?.data?.restoreLogId;
      if (!restoreLogId) {
        throw new Error('restoreLogId nao retornado');
      }

      pollRestoreLog(restoreLogId);
    } catch (error: any) {
      setLoadingRestore(false);
      toast({
        title: 'Erro ao iniciar restore',
        description: error?.response?.data?.message || 'Erro interno do servidor',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          Restaurar Banco por Backup
        </CardTitle>
        <CardDescription>
          Restaura o banco usando um arquivo ja existente no servidor
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 p-4 border border-red-200 bg-red-50 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <p className="font-bold mb-1">Operacao destrutiva</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Substitui dados atuais pelo backup selecionado</li>
              <li>Bloqueia operacao concorrente com update/restore</li>
              <li>Exige SUPER_ADMIN autenticado</li>
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="backup-select">Arquivo de backup</Label>
            <Button variant="outline" size="sm" onClick={loadAvailableBackups} disabled={loadingBackups || loadingRestore}>
              <RefreshCw className={`w-3 h-3 mr-1 ${loadingBackups ? 'animate-spin' : ''}`} />
              Atualizar lista
            </Button>
          </div>
          <select
            id="backup-select"
            className="w-full px-3 py-2 border rounded-md"
            value={selectedFileName}
            onChange={(e) => setSelectedFileName(e.target.value)}
            disabled={loadingBackups || loadingRestore}
          >
            <option value="">Selecione um backup...</option>
            {availableBackups.map((b) => (
              <option key={b.fileName} value={b.fileName}>
                {b.fileName} ({(b.fileSize / 1024 / 1024).toFixed(2)} MB)
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
            disabled={loadingRestore}
          />
          <Label htmlFor="run-migrations">Executar migrate apos restore (se existir service migrate)</Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-text">Confirmacao</Label>
          <Input
            id="confirm-text"
            value={confirmationText}
            onChange={(e) => setConfirmationText(e.target.value)}
            placeholder={expectedConfirmation}
            disabled={loadingRestore}
          />
          <p className="text-xs text-muted-foreground">Digite exatamente: <strong>{expectedConfirmation}</strong></p>
        </div>

        <Button
          onClick={handleRestore}
          disabled={loadingRestore || !selectedFileName || confirmationText !== expectedConfirmation}
          className="bg-red-600 hover:bg-red-700"
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

        {restoreLog && (
          <div className="border rounded-lg p-4 space-y-2 bg-gray-50">
            <div className="flex items-center gap-2">
              {restoreLog.status === 'SUCCESS' ? (
                <CheckCircle className="w-4 h-4 text-green-600" />
              ) : restoreLog.status === 'FAILED' ? (
                <XCircle className="w-4 h-4 text-red-600" />
              ) : (
                <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
              )}
              <span className="font-medium">Status: {restoreLog.status}</span>
            </div>
            <p className="text-sm"><strong>Arquivo:</strong> {restoreLog.fileName}</p>
            <p className="text-sm"><strong>Inicio:</strong> {new Date(restoreLog.startedAt).toLocaleString('pt-BR')}</p>
            {restoreLog.completedAt && (
              <p className="text-sm"><strong>Fim:</strong> {new Date(restoreLog.completedAt).toLocaleString('pt-BR')}</p>
            )}
            {restoreLog.errorMessage && <p className="text-sm text-red-700"><strong>Erro:</strong> {restoreLog.errorMessage}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
