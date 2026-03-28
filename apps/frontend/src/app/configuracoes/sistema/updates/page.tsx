'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Download,
  RefreshCw,
  Settings,
  History,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Database,
  Monitor,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';
import { BackupSection } from './components/BackupSection';
import { RestoreSection } from './components/RestoreSection';
import { useSystemVersion } from '@/hooks/useSystemVersion';
import { useMaintenance } from '@/contexts/MaintenanceContext';
import {
  buildUpdateLifecycleViewModel,
  formatUpdateLifecycleStatus,
  formatUpdateStage,
  isUpdateLifecycleRunning,
  parseUpdateApiError,
  UpdateLifecyclePayload,
  UpdateLifecycleStatus,
} from './update-flow.utils';

/**
 * Página de Gerenciamento do Sistema de Atualizações
 */

interface UpdateStatus {
  currentVersion: string;
  availableVersion?: string;
  updateAvailable: boolean;
  lastCheck?: string;
  isConfigured: boolean;
  checkEnabled: boolean;
  mode: 'docker' | 'native';
  updateChannel: 'release' | 'tag';
  updateLifecycle?: UpdateLifecyclePayload;
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
  updateChannel: 'release' | 'tag';
  updateCheckEnabled: boolean;
}

interface UpdateConfigResponse {
  gitUsername?: string;
  gitRepository?: string;
  gitReleaseBranch?: string;
  packageManager?: string;
  updateChannel?: 'release' | 'tag';
  updateCheckEnabled?: boolean;
  hasGitToken?: boolean;
}

function normalizeVersionTag(version: string): string {
  const value = (version || '').trim();
  if (!value) return value;
  return value.startsWith('v') ? value : `v${value}`;
}

function getApiErrorMessage(error: unknown, fallback = 'Erro interno do servidor'): string {
  return parseUpdateApiError(error, fallback).userMessage;
}

function formatElapsedTime(startedAt: string | null | undefined): string | null {
  if (!startedAt) return null;

  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return null;

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - started) / 1000));
  if (elapsedSeconds < 60) return `${elapsedSeconds}s`;

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  if (minutes < 60) return `${minutes}min ${seconds}s`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}min`;
}

export default function UpdatesPage() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { version, loading: versionLoading } = useSystemVersion();
  const { state: maintenanceState, isMaintenanceActive } = useMaintenance();
  const maintenanceReason = maintenanceState.reason || 'Atualização em andamento';

  // Estados
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [logs, setLogs] = useState<UpdateLog[]>([]);
  const [config, setConfig] = useState<UpdateConfig>({
    gitUsername: '',
    gitRepository: '',
    gitToken: '',
    gitReleaseBranch: 'main',
    packageManager: 'docker',
    updateChannel: 'release',
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
  const [activeTab, setActiveTab] = useState('status');
  const [hasSavedGitToken, setHasSavedGitToken] = useState(false);
  const lifecycle = status?.updateLifecycle;
  const lifecycleView = buildUpdateLifecycleViewModel(lifecycle);
  const lifecycleStatus = lifecycle?.status || 'idle';
  const isUpdateRunning = isUpdateLifecycleRunning(lifecycleStatus) || loading.update;
  const lastTerminalLifecycleRef = useRef<UpdateLifecycleStatus | null>(null);

  useEffect(() => {
    const requestedTab = (searchParams.get('tab') || '').trim().toLowerCase();
    if (['status', 'config', 'backup', 'history'].includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [searchParams]);

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
        updateChannel: data.updateChannel || 'release',
        updateCheckEnabled: data.updateCheckEnabled ?? true,
        gitToken: '',
      }));
      setHasSavedGitToken(!!data.hasGitToken);
    } catch (error: unknown) {
      console.error('Erro ao carregar configurações de update:', error);
    }
  }, []);

  const loadLogs = useCallback(async (options?: { silent?: boolean }) => {
    try {
      setLoading(prev => ({ ...prev, logs: true }));
      const response = await api.get('/api/update/logs?limit=20');
      setLogs(Array.isArray(response.data?.data) ? response.data.data : Array.isArray(response.data) ? response.data : []);
    } catch (error: unknown) {
      if (!options?.silent) {
        console.error('Erro ao carregar logs:', error);
      }
    } finally {
      setLoading(prev => ({ ...prev, logs: false }));
    }
  }, []);

  const refreshOperationalHistory = useCallback(async () => {
    await Promise.all([loadStatus({ silent: true }), loadLogs({ silent: true })]);
  }, [loadLogs, loadStatus]);

  useEffect(() => {
    void loadStatus();
    void loadConfig();
    void loadLogs();
  }, [loadStatus, loadConfig, loadLogs]);

  useEffect(() => {
    if (!isUpdateRunning && !isMaintenanceActive) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadStatus({ silent: true });
      void loadLogs({ silent: true });
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [isUpdateRunning, isMaintenanceActive, loadLogs, loadStatus]);

  useEffect(() => {
    if (lifecycleStatus === 'completed' || lifecycleStatus === 'failed') {
      if (lastTerminalLifecycleRef.current !== lifecycleStatus) {
        lastTerminalLifecycleRef.current = lifecycleStatus;
        toast({
          title: lifecycleStatus === 'completed' ? 'Atualização concluída' : 'Atualização falhou',
          description:
            lifecycleStatus === 'completed'
              ? 'O status do sistema foi atualizado.'
              : lifecycle?.error?.userMessage || 'O processo de atualização terminou com falha.',
          variant: lifecycleStatus === 'completed' ? 'default' : 'destructive',
        });
      }
      return;
    }

    if (isUpdateRunning) {
      lastTerminalLifecycleRef.current = null;
    }
  }, [isUpdateRunning, lifecycle?.error?.userMessage, lifecycleStatus, toast]);

  const checkForUpdates = async () => {
    try {
      setLoading(prev => ({ ...prev, check: true }));
      const response = await api.get('/api/update/check');
      toast({
        title: 'Verificação concluída',
        description: response.data?.message || 'Verificação concluída.',
      });
      await loadStatus();
    } catch (error: unknown) {
      toast({
        title: 'Erro na verificação',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, check: false }));
    }
  };

  const executeUpdate = async () => {
    if (!status?.availableVersion || isUpdateRunning) return;
    try {
      setLoading(prev => ({ ...prev, update: true }));
      const response = await api.post('/api/update/execute', {
        version: normalizeVersionTag(status.availableVersion),
        packageManager: config.packageManager,
      });
      toast({
        title: 'Atualização iniciada',
        description: response.data?.message || 'O processo de atualização foi iniciado.',
      });
      setShowUpdateConfirm(false);
      await Promise.all([loadStatus(), loadLogs()]);
    } catch (error: unknown) {
      const parsed = parseUpdateApiError(error, 'Falha ao iniciar atualizacao');
      toast({
        title: 'Erro na atualizacao',
        description: `${parsed.userMessage} (etapa: ${formatUpdateStage(parsed.stage)})`,
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
        title: 'Configurações salvas',
        description: response.data?.message || 'Configurações de update salvas com sucesso.',
      });
      setConfig(prev => ({ ...prev, gitToken: '' }));
      await Promise.all([loadStatus(), loadConfig()]);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao salvar configurações',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, config: false }));
    }
  };

  const testConnection = async () => {
    try {
      toast({ title: 'Testando conexão...', description: 'Aguarde um momento.' });
      const payload = {
        gitUsername: config.gitUsername,
        gitRepository: config.gitRepository,
        gitToken: config.gitToken.trim() || undefined,
      };
      const response = await api.post('/api/update/test-connection', payload);
      toast({ title: 'Conexão OK', description: response.data?.message || 'Conexão com o repositório validada.' });
    } catch (error: unknown) {
      toast({
        title: 'Falha na conexão',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Gerenciamento do Sistema</h1>
        <p className="text-skin-text-muted">
          Controle de versões, atualizações e manutenção da plataforma.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="flex gap-2 border-b pb-4">
          <Button variant={activeTab === 'status' ? 'default' : 'outline'} onClick={() => setActiveTab('status')}>Status & Atualizações</Button>
          <Button variant={activeTab === 'config' ? 'default' : 'outline'} onClick={() => setActiveTab('config')}>Configurações</Button>
          <Button variant={activeTab === 'backup' ? 'default' : 'outline'} onClick={() => setActiveTab('backup')}><Database className="w-4 h-4 mr-2" />Backup & Restore</Button>
          <Button variant={activeTab === 'history' ? 'default' : 'outline'} onClick={() => setActiveTab('history')}>Histórico</Button>
        </div>

        {activeTab === 'status' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Info className="w-5 h-5" />Status do Sistema</CardTitle>
                <CardDescription>Informações sobre a versão atual e atualizações disponíveis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {status && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Versão Atual</Label>
                      <div className="text-2xl font-bold text-skin-info">{versionLoading ? 'carregando...' : version}</div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Versão Disponível</Label>
                      <div className="text-2xl font-bold">
                        {status.availableVersion ? <span className="text-skin-success">{status.availableVersion}</span> : <span className="text-skin-text-muted">N/A</span>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Status</Label>
                      <div>
                        {status.updateAvailable ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-skin-success/100 text-white"><Download className="w-3 h-3 mr-1" />Atualização Disponível</span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-skin-background-elevated text-skin-text"><CheckCircle className="w-3 h-3 mr-1" />Atualizado</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Modo de Instalação</Label>
                      <div className="flex items-center gap-2">
                        {status.mode === 'docker' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-skin-info/15 text-skin-info"><Settings className="w-3 h-3 mr-1" />Container Docker</span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-skin-secondary/20 text-skin-text"><Monitor className="w-3 h-3 mr-1" />Nativo (PM2)</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Canal de Atualização</Label>
                      <div className="text-sm font-mono text-skin-text-muted">{status.updateChannel === 'release' ? 'Releases Formais' : 'Tags de Código'}</div>
                    </div>
                  </div>
                )}
                <div className="flex gap-4 pt-4 border-t">
                  <Button onClick={checkForUpdates} disabled={loading.check || isUpdateRunning || !status?.isConfigured} variant="outline">
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading.check ? 'animate-spin' : ''}`} />
                    Verificar Agora
                  </Button>
                  {status?.updateAvailable && (
                    <Button onClick={() => setShowUpdateConfirm(true)} disabled={isUpdateRunning} className="bg-skin-success hover:bg-skin-success/90 text-white">
                      <Download className="w-4 h-4 mr-2" />
                      Executar Atualização
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {lifecycle && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    Fluxo de Atualização
                    {isUpdateLifecycleRunning(lifecycle.status) && <RefreshCw className="h-4 w-4 animate-spin text-skin-primary" />}
                  </CardTitle>
                  <CardDescription>Estado atual: {formatUpdateLifecycleStatus(lifecycle.status)}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-skin-text-muted">Etapa real: {lifecycleView.currentStepLabel}</span>
                    <span className="font-medium">
                      {lifecycleView.progressKnown && lifecycleView.progressPercent != null
                        ? `${Math.max(0, Math.min(100, lifecycleView.progressPercent))}%`
                        : 'Sem percentual confiável'}
                    </span>
                  </div>
                  {lifecycleView.lastCompletedStepLabel && (
                    <div className="text-xs text-skin-text-muted">
                      Última etapa concluída: {lifecycleView.lastCompletedStepLabel}
                    </div>
                  )}
                  {lifecycleView.failedStepLabel && (
                    <div className="text-xs text-skin-danger">
                      Etapa com falha: {lifecycleView.failedStepLabel}
                    </div>
                  )}
                  {isUpdateLifecycleRunning(lifecycle.status) && lifecycle.startedAt && (
                    <div className="text-xs text-skin-text-muted">
                      Em execução há {formatElapsedTime(lifecycle.startedAt) || 'alguns instantes'}
                    </div>
                  )}
                  {lifecycleView.showProgressBar && lifecycleView.progressPercent != null && (
                    <div className="h-2 w-full rounded bg-skin-border overflow-hidden">
                      <div className="h-2 rounded bg-skin-primary transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, lifecycleView.progressPercent))}%` }} />
                    </div>
                  )}
                  {lifecycle.persistenceError && (
                    <div className="flex items-start gap-2 p-3 border border-skin-warning/30 bg-skin-warning/10 rounded-lg">
                      <AlertTriangle className="h-4 w-4 text-skin-warning flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-skin-warning space-y-1">
                        <div><strong>Falha de observabilidade:</strong> {lifecycle.persistenceError.userMessage}</div>
                        <div className="text-xs">Fonte do fallback: {lifecycle.persistence.source}</div>
                        {lifecycle.currentStep && (
                          <div className="text-xs">Etapa recuperada: {lifecycle.currentStep.label}</div>
                        )}
                        {lifecycle.persistence.technicalMessage && (
                          <div className="text-xs break-all">
                            <strong>Detalhe técnico:</strong> {lifecycle.persistence.technicalMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {lifecycle.error && (
                    <div className="flex items-start gap-2 p-3 border border-skin-danger/30 bg-skin-danger/10 rounded-lg">
                      <XCircle className="h-4 w-4 text-skin-danger flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-skin-danger space-y-1">
                        <div><strong>Falha:</strong> {lifecycle.error.userMessage}</div>
                        <div className="text-xs">Código: {lifecycle.error.code} | Etapa: {formatUpdateStage(lifecycle.error.stage)}</div>
                        {lifecycle.error.exitCode != null && (
                          <div className="text-xs">Saída: {lifecycle.error.exitCode}</div>
                        )}
                        {lifecycle.error.technicalMessage && (
                          <div className="text-xs break-all">
                            <strong>Detalhe técnico:</strong> {lifecycle.error.technicalMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {process.env.NODE_ENV !== 'production' && (
                    <div className="rounded-lg border border-skin-border p-3 text-xs text-skin-text-muted space-y-1">
                      <div><strong>Debug local:</strong></div>
                      <div>Arquivo de estado: {lifecycle.persistence.statePath || 'n/a'}</div>
                      <div>Arquivo de log: {lifecycle.persistence.logPath || 'n/a'}</div>
                      <div>Fonte do status: {lifecycle.persistence.source}</div>
                      <div>Etapa bruta: {lifecycleView.currentStepRaw || lifecycle.step || 'n/a'}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'config' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />Configurações do Sistema</CardTitle>
                <CardDescription>Configure o repositório Git e parâmetros de atualização</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gitUsername">Usuário GitHub</Label>
                    <Input id="gitUsername" value={config.gitUsername} onChange={(e) => setConfig(prev => ({ ...prev, gitUsername: e.target.value }))} placeholder="ex: meuusuario" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gitRepository">Repositório</Label>
                    <Input id="gitRepository" value={config.gitRepository} onChange={(e) => setConfig(prev => ({ ...prev, gitRepository: e.target.value }))} placeholder="ex: meu-projeto" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gitToken">Token de Acesso</Label>
                    <Input id="gitToken" type="password" value={config.gitToken} onChange={(e) => setConfig(prev => ({ ...prev, gitToken: e.target.value }))} placeholder={hasSavedGitToken ? 'Token já salvo. Preencha apenas para trocar.' : 'Token GitHub'} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gitReleaseBranch">Branch de Release</Label>
                    <Input id="gitReleaseBranch" value={config.gitReleaseBranch} onChange={(e) => setConfig(prev => ({ ...prev, gitReleaseBranch: e.target.value }))} placeholder="ex: main ou master" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="updateChannel">Canal de Atualização</Label>
                    <select id="updateChannel" value={config.updateChannel} onChange={(e) => setConfig(prev => ({ ...prev, updateChannel: e.target.value as 'release' | 'tag' }))} className="w-full px-3 py-2 border border-skin-border-strong rounded-md">
                      <option value="release">Release (Apenas versões formais)</option>
                      <option value="tag">Tag (Qualquer tag do repositório)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="packageManager">Modo de Instalação</Label>
                    <select id="packageManager" value={config.packageManager} onChange={(e) => setConfig(prev => ({ ...prev, packageManager: e.target.value }))} className="w-full px-3 py-2 border border-skin-border-strong rounded-md">
                      <option value="docker">Docker</option>
                      <option value="native">Native (PM2)</option>
                    </select>
                  </div>
                  <div className="space-y-2 flex items-center gap-2 pt-8">
                    <input type="checkbox" checked={config.updateCheckEnabled} onChange={(e) => setConfig(prev => ({ ...prev, updateCheckEnabled: e.target.checked }))} className="rounded" />
                    <Label>Verificação Automática</Label>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <Button onClick={saveConfig} disabled={loading.config || isMaintenanceActive}>{loading.config ? 'Salvando...' : 'Salvar Configurações'}</Button>
                  <Button onClick={testConnection} variant="outline" disabled={!config.gitUsername || !config.gitRepository || isMaintenanceActive}>Testar Conexão</Button>
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
              <CardTitle className="flex items-center gap-2"><History className="w-5 h-5" />Histórico de Atualizações</CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? <div className="py-8 text-center text-skin-text-muted">Nenhuma atualização registrada</div> : (
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
              <CardTitle>Confirmar Atualização</CardTitle>
              <CardDescription>Você está prestes a atualizar o sistema para a versão {status?.availableVersion}.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 bg-skin-warning/10 border border-skin-warning/30 rounded text-sm text-skin-warning flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                O sistema ficará indisponível durante o processo. Recomenda-se realizar um backup antes de prosseguir.
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setShowUpdateConfirm(false)} disabled={loading.update}>Cancelar</Button>
                <Button onClick={executeUpdate} disabled={loading.update} className="bg-skin-success hover:bg-skin-success/90 text-white">Confirmar e Atualizar</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
