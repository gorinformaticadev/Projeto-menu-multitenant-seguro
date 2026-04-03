'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle,
  Database,
  Download,
  History,
  Info,
  Monitor,
  RefreshCw,
  Settings,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { BackupSection } from './components/BackupSection';
import { RestoreSection } from './components/RestoreSection';
import { useSystemVersion } from '@/hooks/useSystemVersion';
import { useMaintenance } from '@/contexts/MaintenanceContext';

interface UpdateStatus {
  currentVersion: string;
  availableVersion?: string;
  updateAvailable: boolean;
  lastCheck?: string;
  isConfigured: boolean;
  checkEnabled: boolean;
  mode: 'docker' | 'native';
  configuredMode: 'docker' | 'native' | null;
  effectiveMode: 'docker' | 'native';
  detectedHostMode: 'docker' | 'native';
  modeSource: 'canonical_execution' | 'legacy_state' | 'configured' | 'host_detection';
  updateChannel: 'stable' | 'rc' | 'dev';
}

interface UpdateLog {
  id: string;
  version: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  duration?: number;
  packageManager: string;
  errorMessage?: string;
  rollbackReason?: string;
  executedBy?: string;
}

interface UpdateConfig {
  gitUsername: string;
  gitRepository: string;
  gitToken: string;
  gitReleaseBranch: string;
  packageManager: string;
  updateChannel: 'stable' | 'rc' | 'dev';
  updateCheckEnabled: boolean;
}

interface UpdateConfigResponse {
  gitUsername?: string;
  gitRepository?: string;
  gitReleaseBranch?: string;
  packageManager?: string;
  updateChannel?: 'stable' | 'rc' | 'dev';
  updateCheckEnabled?: boolean;
  hasGitToken?: boolean;
}

interface TerminalUpdateRuntimeStatus {
  status: 'idle' | 'running' | 'success' | 'failed' | 'lost';
  pid: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  command: string;
  logPath: string | null;
  lastError: string | null;
  triggeredBy?: 'panel' | 'terminal' | null;
}

function getApiErrorMessage(error: unknown, fallback = 'Erro interno do servidor'): string {
  return (error as any)?.response?.data?.message || (error instanceof Error ? error.message : fallback);
}

export default function UpdatesPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { version, loading: versionLoading, refreshVersion } = useSystemVersion();
  const { state: maintenanceState, isMaintenanceActive } = useMaintenance();
  const maintenanceReason = maintenanceState.reason || 'Atualizacao em andamento';

  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [logs, setLogs] = useState<UpdateLog[]>([]);
  const [runtimeStatus, setRuntimeStatus] = useState<TerminalUpdateRuntimeStatus | null>(null);
  const [runtimeLog, setRuntimeLog] = useState('');
  const [config, setConfig] = useState<UpdateConfig>({
    gitUsername: '',
    gitRepository: '',
    gitToken: '',
    gitReleaseBranch: 'main',
    packageManager: 'docker',
    updateChannel: 'stable',
    updateCheckEnabled: true,
  });
  const [loading, setLoading] = useState({
    status: false,
    check: false,
    update: false,
    config: false,
    logs: false,
  });
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const [showRuntimeModal, setShowRuntimeModal] = useState(false);
  const [activeTab, setActiveTab] = useState('status');
  const [hasSavedGitToken, setHasSavedGitToken] = useState(false);
  const [lastKnownVersion, setLastKnownVersion] = useState('unknown');
  const lastRuntimeStatusRef = useRef<TerminalUpdateRuntimeStatus['status'] | null>(null);
  const wasUpdateRunningRef = useRef(false);

  const effectiveMode = status?.effectiveMode || status?.mode || 'native';
  const isUpdateRunning = runtimeStatus?.status === 'running' || loading.update;
  const displayedVersion =
    version !== 'unknown' ? version : status?.currentVersion || lastKnownVersion || 'unknown';
  const shouldShowVersionLoading = versionLoading && displayedVersion === 'unknown';

  useEffect(() => {
    const requestedTab = (searchParams.get('tab') || '').trim().toLowerCase();
    if (['status', 'config', 'backup', 'history'].includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [searchParams]);

  useEffect(() => {
    const candidateVersion =
      version !== 'unknown' ? version : status?.currentVersion && status.currentVersion !== 'unknown' ? status.currentVersion : null;

    if (candidateVersion) {
      setLastKnownVersion(candidateVersion);
    }
  }, [status?.currentVersion, version]);

  const loadStatus = useCallback(async (options?: { silent?: boolean }) => {
    try {
      setLoading(prev => ({ ...prev, status: true }));
      const response = await api.get('/api/update/status');
      setStatus(response.data);
    } catch (error: unknown) {
      if (!options?.silent) {
        toast({
          title: 'Erro ao carregar status',
          description: getApiErrorMessage(error),
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(prev => ({ ...prev, status: false }));
    }
  }, [toast]);

  const loadConfig = useCallback(async () => {
    try {
      const response = await api.get('/api/update/config');
      const data = (response.data || {}) as UpdateConfigResponse;
      setConfig(prev => ({
        ...prev,
        gitUsername: data.gitUsername || '',
        gitRepository: data.gitRepository || '',
        gitReleaseBranch: data.gitReleaseBranch || 'main',
        packageManager: data.packageManager || 'docker',
        updateChannel: data.updateChannel || 'stable',
        updateCheckEnabled: data.updateCheckEnabled ?? true,
        gitToken: '',
      }));
      setHasSavedGitToken(!!data.hasGitToken);
    } catch (error) {
      console.error('Erro ao carregar configuracoes de update:', error);
    }
  }, []);

  const loadLogs = useCallback(async (options?: { silent?: boolean }) => {
    try {
      setLoading(prev => ({ ...prev, logs: true }));
      const response = await api.get('/api/update/logs?limit=20');
      setLogs(Array.isArray(response.data?.data) ? response.data.data : Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      if (!options?.silent) {
        console.error('Erro ao carregar logs:', error);
      }
    } finally {
      setLoading(prev => ({ ...prev, logs: false }));
    }
  }, []);

  const loadRuntimeStatus = useCallback(async (options?: { silent?: boolean }) => {
    try {
      const response = await api.get('/api/system/update/status');
      setRuntimeStatus(response.data || null);
    } catch (error: unknown) {
      if (!options?.silent) {
        toast({
          title: 'Erro ao carregar status do update',
          description: getApiErrorMessage(error),
          variant: 'destructive',
        });
      }
    }
  }, [toast]);

  const loadRuntimeLog = useCallback(async (options?: { silent?: boolean }) => {
    try {
      const response = await api.get('/api/system/update/log?tail=400');
      setRuntimeLog(response.data?.content || '');
    } catch (error: unknown) {
      if (!options?.silent) {
        toast({
          title: 'Erro ao carregar log do update',
          description: getApiErrorMessage(error),
          variant: 'destructive',
        });
      }
    }
  }, [toast]);

  const refreshOperationalHistory = useCallback(async () => {
    await Promise.all([loadStatus({ silent: true }), loadLogs({ silent: true })]);
  }, [loadLogs, loadStatus]);

  useEffect(() => {
    void loadStatus();
    void loadConfig();
    void loadLogs();
    void loadRuntimeStatus({ silent: true });
    void loadRuntimeLog({ silent: true });
  }, [loadConfig, loadLogs, loadRuntimeLog, loadRuntimeStatus, loadStatus]);

  useEffect(() => {
    if (!isUpdateRunning && !isMaintenanceActive) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadStatus({ silent: true });
      void loadLogs({ silent: true });
      void loadRuntimeStatus({ silent: true });
      void loadRuntimeLog({ silent: true });
      void refreshVersion();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [isMaintenanceActive, isUpdateRunning, loadLogs, loadRuntimeLog, loadRuntimeStatus, loadStatus, refreshVersion]);

  useEffect(() => {
    if (isUpdateRunning && !wasUpdateRunningRef.current) {
      setShowRuntimeModal(true);
    }

    wasUpdateRunningRef.current = isUpdateRunning;
  }, [isUpdateRunning]);

  useEffect(() => {
    const currentStatus = runtimeStatus?.status || 'idle';
    if (currentStatus === 'success' || currentStatus === 'failed' || currentStatus === 'lost') {
      if (lastRuntimeStatusRef.current !== currentStatus) {
        lastRuntimeStatusRef.current = currentStatus;
        toast({
          title:
            currentStatus === 'success'
              ? 'Atualizacao concluida'
              : currentStatus === 'lost'
                ? 'Execucao perdida'
                : 'Atualizacao falhou',
          description:
            currentStatus === 'success'
              ? 'O fluxo oficial de update terminou com sucesso.'
              : runtimeStatus?.lastError || 'O processo de atualizacao terminou com falha.',
          variant: currentStatus === 'success' ? 'default' : 'destructive',
        });
        void loadStatus({ silent: true });
        void loadLogs({ silent: true });
        void loadRuntimeLog({ silent: true });
        void refreshVersion();
      }
      return;
    }

    if (isUpdateRunning) {
      lastRuntimeStatusRef.current = null;
    }
  }, [isUpdateRunning, loadLogs, loadRuntimeLog, loadStatus, refreshVersion, runtimeStatus, toast]);

  const checkForUpdates = async () => {
    try {
      setLoading(prev => ({ ...prev, check: true }));
      const response = await api.get('/api/update/check');
      toast({
        title: 'Verificacao concluida',
        description: response.data?.message || 'Verificacao concluida.',
      });
      await loadStatus();
    } catch (error: unknown) {
      toast({
        title: 'Erro na verificacao',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, check: false }));
    }
  };

  const executeUpdate = async () => {
    if (isUpdateRunning) return;

    try {
      setLoading(prev => ({ ...prev, update: true }));
      const response = await api.post('/api/system/update/run', {});
      toast({
        title: 'Atualizacao iniciada',
        description: response.data?.message || 'O processo de atualizacao foi iniciado.',
      });
      setShowUpdateConfirm(false);
      setShowRuntimeModal(true);
      await Promise.all([loadStatus(), loadLogs(), loadRuntimeStatus(), loadRuntimeLog()]);
    } catch (error: unknown) {
      toast({
        title: 'Erro na atualizacao',
        description: getApiErrorMessage(error, 'Falha ao iniciar atualizacao'),
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, update: false }));
    }
  };

  const saveConfig = async () => {
    try {
      setLoading(prev => ({ ...prev, config: true }));
      const payload: Partial<UpdateConfig> = {
        gitUsername: config.gitUsername,
        gitRepository: config.gitRepository,
        gitReleaseBranch: config.gitReleaseBranch,
        packageManager: config.packageManager,
        updateChannel: config.updateChannel,
        updateCheckEnabled: config.updateCheckEnabled,
      };
      if (config.gitToken.trim()) {
        payload.gitToken = config.gitToken.trim();
      }
      const response = await api.put('/api/update/config', payload);
      toast({
        title: 'Configuracoes salvas',
        description: response.data?.message || 'Configuracoes de update salvas com sucesso.',
      });
      setConfig(prev => ({ ...prev, gitToken: '' }));
      await Promise.all([loadStatus(), loadConfig()]);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao salvar configuracoes',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, config: false }));
    }
  };

  const testConnection = async () => {
    try {
      toast({ title: 'Testando conexao...', description: 'Aguarde um momento.' });
      const payload = {
        gitUsername: config.gitUsername,
        gitRepository: config.gitRepository,
        gitToken: config.gitToken.trim() || undefined,
      };
      const response = await api.post('/api/update/test-connection', payload);
      toast({
        title: 'Conexao OK',
        description: response.data?.message || 'Conexao com o repositorio validada.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Falha na conexao',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Gerenciamento do Sistema</h1>
        <p className="text-skin-text-muted">Controle de versoes, atualizacoes e manutencao da plataforma.</p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex gap-2 border-b pb-4">
          <Button variant={activeTab === 'status' ? 'default' : 'outline'} onClick={() => setActiveTab('status')}>Status & Atualizacoes</Button>
          <Button variant={activeTab === 'config' ? 'default' : 'outline'} onClick={() => setActiveTab('config')}>Configuracoes</Button>
          <Button variant={activeTab === 'backup' ? 'default' : 'outline'} onClick={() => setActiveTab('backup')}><Database className="w-4 h-4 mr-2" />Backup & Restore</Button>
          <Button variant={activeTab === 'history' ? 'default' : 'outline'} onClick={() => setActiveTab('history')}>Historico</Button>
        </div>

        {activeTab === 'status' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Info className="w-5 h-5" />Status do Sistema</CardTitle>
                <CardDescription>Informacoes sobre a versao atual e verificacao de updates.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {status && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Versão Atual</Label>
                      <div className="text-2xl font-bold text-skin-info">{shouldShowVersionLoading ? 'carregando...' : displayedVersion}</div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Versão Disponivel</Label>
                      <div className="text-2xl font-bold">
                        {status.availableVersion ? <span className="text-skin-success">{status.availableVersion}</span> : <span className="text-skin-text-muted">N/A</span>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Status</Label>
                      <div>
                        {status.updateAvailable ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-skin-success/100 text-white"><Download className="w-3 h-3 mr-1" />Atualizacao disponivel</span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-skin-background-elevated text-skin-text"><CheckCircle className="w-3 h-3 mr-1" />Atualizado</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Modo de Instalacao</Label>
                      <div className="flex items-center gap-2">
                        {effectiveMode === 'docker' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-skin-info/15 text-skin-info"><Settings className="w-3 h-3 mr-1" />Container Docker</span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-skin-secondary/20 text-skin-text"><Monitor className="w-3 h-3 mr-1" />Nativo (PM2)</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Canal de Atualizacao</Label>
                      <div className="text-sm font-mono text-skin-text-muted">{status.updateChannel === 'stable' ? 'Stable' : status.updateChannel === 'rc' ? 'RC' : status.updateChannel === 'dev' ? 'Dev' : status.updateChannel}</div>
                    </div>
                  </div>
                )}

                <div className="flex gap-4 pt-4 border-t">
                  <Button onClick={checkForUpdates} disabled={loading.check || isUpdateRunning || !status?.isConfigured} variant="outline">
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading.check ? 'animate-spin' : ''}`} />
                    Verificar Agora
                  </Button>
                  <Button onClick={() => setShowUpdateConfirm(true)} disabled={isUpdateRunning} className="bg-skin-success hover:bg-skin-success/90 text-white">
                    <Download className="w-4 h-4 mr-2" />
                    Executar Atualizacao
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  Execucao do Update
                  {runtimeStatus?.status === 'running' && <RefreshCw className="h-4 w-4 animate-spin text-skin-primary" />}
                </CardTitle>
                <CardDescription>O painel executa o mesmo fluxo operacional do terminal, com log bruto persistido.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Status</Label>
                    <div className="font-medium">{runtimeStatus?.status || 'idle'}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">PID</Label>
                    <div className="font-medium">{runtimeStatus?.pid ?? 'N/A'}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Exit Code</Label>
                    <div className="font-medium">{runtimeStatus?.exitCode ?? 'N/A'}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Iniciado em</Label>
                    <div className="text-skin-text-muted">{runtimeStatus?.startedAt ? new Date(runtimeStatus.startedAt).toLocaleString('pt-BR') : 'N/A'}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Finalizado em</Label>
                    <div className="text-skin-text-muted">{runtimeStatus?.finishedAt ? new Date(runtimeStatus.finishedAt).toLocaleString('pt-BR') : 'N/A'}</div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Comando</Label>
                    <div className="text-skin-text-muted break-all">{runtimeStatus?.command || 'sudo -n /usr/local/bin/pluggor-update'}</div>
                  </div>
                </div>

                {runtimeStatus?.lastError && (
                  <div className="flex items-start gap-2 p-3 border border-skin-danger/30 bg-skin-danger/10 rounded-lg">
                    <XCircle className="h-4 w-4 text-skin-danger flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-skin-danger"><strong>Erro:</strong> {runtimeStatus.lastError}</div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Log bruto</Label>
                  <pre className="min-h-[220px] max-h-[420px] overflow-auto rounded-lg border border-skin-border bg-skin-background-subtle p-3 text-xs text-skin-text whitespace-pre-wrap break-words">
                    {runtimeLog || 'Nenhuma execucao de update registrada.'}
                  </pre>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" onClick={() => setShowRuntimeModal(true)}>
                    Acompanhar em Modal
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />Configuracoes do Sistema</CardTitle>
                <CardDescription>Configure o repositorio Git e parametros de atualizacao.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gitUsername">Usuario GitHub</Label>
                    <Input id="gitUsername" value={config.gitUsername} onChange={(e) => setConfig(prev => ({ ...prev, gitUsername: e.target.value }))} placeholder="ex: meuusuario" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gitRepository">Repositorio</Label>
                    <Input id="gitRepository" value={config.gitRepository} onChange={(e) => setConfig(prev => ({ ...prev, gitRepository: e.target.value }))} placeholder="ex: meu-projeto" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gitToken">Token de Acesso</Label>
                    <Input id="gitToken" type="password" value={config.gitToken} onChange={(e) => setConfig(prev => ({ ...prev, gitToken: e.target.value }))} placeholder={hasSavedGitToken ? 'Token ja salvo. Preencha apenas para trocar.' : 'Token GitHub'} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gitReleaseBranch">Branch de Release</Label>
                    <Input id="gitReleaseBranch" value={config.gitReleaseBranch} onChange={(e) => setConfig(prev => ({ ...prev, gitReleaseBranch: e.target.value }))} placeholder="ex: main ou master" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="updateChannel">Canal de Atualizacao</Label>
                    <select id="updateChannel" value={config.updateChannel} onChange={(e) => setConfig(prev => ({ ...prev, updateChannel: e.target.value as 'stable' | 'rc' | 'dev' }))} className="w-full px-3 py-2 border border-skin-border-strong rounded-md">
                      <option value="stable">Stable (Pegara apenas releases criadas)</option>
                      <option value="rc">RC (Pegara apenas tags no formato vX.X.X)</option>
                      <option value="dev">Dev (Pegara qualquer commit fora dos demais)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="packageManager">Modo de Instalacao</Label>
                    <div className="flex items-center gap-2 px-3 py-2 border border-skin-border-strong rounded-md bg-skin-background-subtle">
                      {effectiveMode === 'docker' ? (
                        <span className="flex items-center text-sm font-medium"><Settings className="w-4 h-4 mr-2 text-skin-info" />Container Docker (Auto-detectado)</span>
                      ) : (
                        <span className="flex items-center text-sm font-medium"><Monitor className="w-4 h-4 mr-2 text-skin-text" />Nativo / PM2 (Auto-detectado)</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 flex items-center gap-2 pt-8">
                    <input type="checkbox" checked={config.updateCheckEnabled} onChange={(e) => setConfig(prev => ({ ...prev, updateCheckEnabled: e.target.checked }))} className="rounded" />
                    <Label>Verificacao Automatica</Label>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <Button onClick={saveConfig} disabled={loading.config || isMaintenanceActive}>{loading.config ? 'Salvando...' : 'Salvar Configuracoes'}</Button>
                  <Button onClick={testConnection} variant="outline" disabled={!config.gitUsername || !config.gitRepository || isMaintenanceActive}>Testar Conexao</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'backup' && (
          <div className="space-y-6">
            <BackupSection onBackupComplete={refreshOperationalHistory} disabled={isMaintenanceActive} disabledReason={maintenanceReason} />
            <RestoreSection onRestoreComplete={refreshOperationalHistory} disabled={isMaintenanceActive} disabledReason={maintenanceReason} />
          </div>
        )}

        {activeTab === 'history' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><History className="w-5 h-5" />Historico de Atualizacoes</CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="py-8 text-center text-skin-text-muted">Nenhuma atualizacao registrada</div>
              ) : (
                <div className="space-y-4">
                  {logs.map((log) => (
                    <div key={log.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{log.version}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${log.status === 'SUCCESS' ? 'bg-skin-success/15 text-skin-success' : 'bg-skin-danger/15 text-skin-danger'}`}>{log.status}</span>
                      </div>
                      <div className="text-sm text-skin-text-muted">{new Date(log.startedAt).toLocaleString('pt-BR')}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {showUpdateConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Confirmar Atualizacao</CardTitle>
              <CardDescription>O painel executara o mesmo fluxo oficial usado no terminal.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-skin-warning/10 border border-skin-warning/30 rounded text-sm text-skin-warning flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                O comando oficial do servidor sera executado. O sistema pode ficar indisponivel durante o processo.
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowUpdateConfirm(false)} disabled={loading.update}>Cancelar</Button>
                <Button onClick={executeUpdate} disabled={loading.update} className="bg-skin-success hover:bg-skin-success/90 text-white">Confirmar e Atualizar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showRuntimeModal} onOpenChange={setShowRuntimeModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Acompanhamento do Update
              {runtimeStatus?.status === 'running' && <RefreshCw className="h-4 w-4 animate-spin text-skin-primary" />}
            </DialogTitle>
            <DialogDescription>
              Este modal mostra o mesmo log bruto da execucao, atualizado conforme o painel recebe novas linhas.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Status</Label>
              <div className="font-medium">{runtimeStatus?.status || 'idle'}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">PID</Label>
              <div className="font-medium">{runtimeStatus?.pid ?? 'N/A'}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Versao exibida</Label>
              <div className="font-medium">{displayedVersion}</div>
            </div>
            <div className="space-y-1 md:col-span-3">
              <Label className="text-xs font-medium">Comando</Label>
              <div className="text-skin-text-muted break-all">{runtimeStatus?.command || 'sudo -n /usr/local/bin/pluggor-update'}</div>
            </div>
          </div>

          {runtimeStatus?.lastError && (
            <div className="flex items-start gap-2 rounded-lg border border-skin-danger/30 bg-skin-danger/10 p-3 text-sm text-skin-danger">
              <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                <strong>Erro:</strong> {runtimeStatus.lastError}
              </div>
            </div>
          )}

          <pre className="min-h-[320px] max-h-[60vh] overflow-auto rounded-lg border border-skin-border bg-skin-background-subtle p-4 text-xs text-skin-text whitespace-pre-wrap break-words">
            {runtimeLog || 'Nenhuma execucao de update registrada.'}
          </pre>

          <DialogFooter>
            <Button variant="outline" onClick={() => { void loadRuntimeStatus({ silent: true }); void loadRuntimeLog({ silent: true }); }}>
              Atualizar Agora
            </Button>
            <Button variant="outline" onClick={() => setShowRuntimeModal(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
