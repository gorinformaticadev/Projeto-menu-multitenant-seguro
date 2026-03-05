'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Clock,
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
import { useAuth } from '@/contexts/AuthContext';
import { useMaintenance } from '@/contexts/MaintenanceContext';

/**
 * Página de Gerenciamento do Sistema de Atualizações
 * 
 * Funcionalidades:
 * - Verificar status de atualizações disponíveis
 * - Configurar repositório Git e credenciais
 * - Executar atualizações com confirmação
 * - Visualizar histórico de atualizações
 * - Monitorar logs de execução
 */

interface UpdateStatus {
  currentVersion: string;
  availableVersion?: string;
  updateAvailable: boolean;
  lastCheck?: string;
  isConfigured: boolean;
  checkEnabled: boolean;
  mode: 'docker' | 'native';
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
  updateCheckEnabled: boolean;
}

interface UpdateConfigResponse {
  gitUsername?: string;
  gitRepository?: string;
  gitReleaseBranch?: string;
  packageManager?: string;
  updateCheckEnabled?: boolean;
  hasGitToken?: boolean;
}

interface BackupLog {
  id: string;
  operationType: string;
  status: string;
  startedAt: string;
  fileName?: string;
  fileSize?: number;
  durationSeconds?: number;
  executedBy?: string;
  errorMessage?: string;
}

interface ApiErrorMessage {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

function normalizeVersionTag(version: string): string {
  const value = (version || '').trim();
  if (!value) return value;
  return value.startsWith('v') ? value : `v${value}`;
}

function getApiErrorMessage(error: unknown): string {
  return (
    (error as ApiErrorMessage).response?.data?.message ||
    (error instanceof Error ? error.message : 'Erro interno do servidor')
  );
}

function formatBuildDate(value?: string): string {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleString('pt-BR');
}

export default function UpdatesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { version, versionInfo, loading: versionLoading, refreshVersion } = useSystemVersion();
  const { state: maintenanceState, isMaintenanceActive } = useMaintenance();
  const canShowVersionSource = user?.role === 'SUPER_ADMIN' || process.env.NODE_ENV !== 'production';
  const maintenanceReason = maintenanceState.reason || 'Atualizacao em andamento';

  // Estados
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [logs, setLogs] = useState<UpdateLog[]>([]);
  const [config, setConfig] = useState<UpdateConfig>({
    gitUsername: '',
    gitRepository: '',
    gitToken: '',
    gitReleaseBranch: 'main',
    packageManager: 'npm',
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
  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([]);
  const [hasSavedGitToken, setHasSavedGitToken] = useState(false);




  /**
   * Carrega status atual do sistema
   */
  const loadStatus = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, status: true }));
      const response = await api.get('/api/update/status');
      setStatus(response.data);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar status',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, status: false }));
    }
  }, [toast]);

  /**
   * Carrega configurações salvas do sistema
   */
  const loadConfig = useCallback(async () => {
    try {
      const response = await api.get('/api/update/config');
      const data = (response.data || {}) as UpdateConfigResponse;

      setConfig(prev => ({
        ...prev,
        gitUsername: data.gitUsername || '',
        gitRepository: data.gitRepository || '',
        gitReleaseBranch: data.gitReleaseBranch || 'main',
        packageManager: data.packageManager || 'npm',
        updateCheckEnabled: data.updateCheckEnabled ?? true,
        gitToken: '',
      }));
      setHasSavedGitToken(!!data.hasGitToken);
    } catch (error: unknown) {
      console.error('Erro ao carregar configurações de update:', error);
    }
  }, []);

  /**
   * Força verificação de novas versões
   */
  const checkForUpdates = async () => {
    try {
      setLoading(prev => ({ ...prev, check: true }));
      const response = await api.get('/api/update/check');

      toast({
        title: 'Verificação concluída',
        description: response.data.message,
        variant: response.data.updateAvailable ? 'default' : 'default',
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

  /**
   * Executa atualização para versão disponível
   */
  const executeUpdate = async () => {
    if (!status?.availableVersion) return;

    try {
      setLoading(prev => ({ ...prev, update: true }));

      const response = await api.post('/api/update/execute', {
        version: normalizeVersionTag(status.availableVersion),
        packageManager: config.packageManager,
      });

      toast({
        title: 'Atualização iniciada',
        description: response.data.message,
        variant: 'default',
      });

      setShowUpdateConfirm(false);

      // Recarregar dados após alguns segundos
      setTimeout(() => {
        loadStatus();
        loadLogs();
      }, 3000);

    } catch (error: unknown) {
      toast({
        title: 'Erro na atualização',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, update: false }));
    }
  };

  /**
   * Salva configurações do sistema
   */
  const saveConfig = async () => {
    try {
      setLoading(prev => ({ ...prev, config: true }));

      const payload: Partial<UpdateConfig> = {
        gitUsername: config.gitUsername,
        gitRepository: config.gitRepository,
        gitReleaseBranch: config.gitReleaseBranch,
        packageManager: config.packageManager,
        updateCheckEnabled: config.updateCheckEnabled,
      };

      if (config.gitToken.trim()) {
        payload.gitToken = config.gitToken.trim();
      }

      const response = await api.put('/api/update/config', payload);

      toast({
        title: 'Configurações salvas',
        description: response.data.message,
        variant: 'default',
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

  /**
   * Carrega histórico de atualizações
   */
  const loadLogs = useCallback(async () => {
    try {
      setLoading(prev => ({ ...prev, logs: true }));
      const response = await api.get('/api/update/logs?limit=20');
      setLogs(response.data.data || []);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar histórico',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, logs: false }));
    }
  }, [toast]);

  /**
   * Carrega histórico de backups
   */
  const loadBackupLogs = useCallback(async () => {
    try {
      const response = await api.get('/api/backups?limit=20');
      const jobs = response.data?.data?.jobs || [];
      setBackupLogs(
        jobs.map((job: any) => ({
          id: job.id,
          operationType: job.type,
          status: job.status,
          startedAt: job.startedAt || job.createdAt,
          fileName: job.fileName,
          fileSize: null,
          durationSeconds:
            job.startedAt && job.finishedAt
              ? Math.floor((new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)
              : undefined,
          executedBy: job.createdByUserId,
          errorMessage: job.error,
        })),
      );
    } catch (error: unknown) {
      console.error('Erro ao carregar logs de backup:', error);
    }
  }, []);

  // Carregar dados iniciais
  useEffect(() => {
    loadStatus();
    loadConfig();
    loadLogs();
    loadBackupLogs();
    refreshVersion();
  }, [loadStatus, loadConfig, loadLogs, loadBackupLogs, refreshVersion]);

  /**
   * Testa conectividade com repositório
   */
  const testConnection = async () => {
    try {
      const response = await api.get('/api/update/test-connection');

      toast({
        title: response.data.connected ? 'Conexão bem-sucedida' : 'Falha na conexão',
        description: response.data.message,
        variant: response.data.connected ? 'default' : 'destructive',
      });
    } catch (error: unknown) {
      toast({
        title: 'Erro no teste de conexão',
        description: getApiErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  /**
   * Renderiza badge de status
   */
  const renderStatusBadge = (logStatus: string) => {
    const statusConfig = {
      STARTED: { color: 'bg-blue-500', icon: Clock, text: 'Em Andamento' },
      SUCCESS: { color: 'bg-green-500', icon: CheckCircle, text: 'Sucesso' },
      FAILED: { color: 'bg-red-500', icon: XCircle, text: 'Falhou' },
      ROLLED_BACK: { color: 'bg-yellow-500', icon: AlertTriangle, text: 'Rollback' },
    };

    const config = statusConfig[logStatus as keyof typeof statusConfig] || statusConfig.FAILED;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color} text-white`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.text}
      </span>
    );
  };

  /**
   * Formata duração em formato legível
   */
  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sistema de Atualizações</h1>
          <p className="text-muted-foreground">
            Gerencie atualizações automáticas do sistema via Git
          </p>
        </div>

        <Button
          onClick={async () => {
            await Promise.all([loadStatus(), refreshVersion()]);
          }}
          disabled={loading.status || versionLoading}
          variant="outline"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading.status ? 'animate-spin' : ''}`} />
          Atualizar Status
        </Button>
      </div>


      {isMaintenanceActive && (
        <div className="flex items-start gap-3 p-4 border border-amber-200 bg-amber-50 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            Sistema em manutencao: {maintenanceReason}. Acoes criticas estao temporariamente bloqueadas.
          </div>
        </div>
      )}
      <div className="space-y-6">
        {/* Navegação por botões */}
        <div className="flex gap-2 border-b pb-4">
          <Button
            variant={activeTab === 'status' ? 'default' : 'outline'}
            onClick={() => setActiveTab('status')}
          >
            Status & Atualizações
          </Button>
          <Button
            variant={activeTab === 'config' ? 'default' : 'outline'}
            onClick={() => setActiveTab('config')}
          >
            Configurações
          </Button>
          <Button
            variant={activeTab === 'backup' ? 'default' : 'outline'}
            onClick={() => setActiveTab('backup')}
          >
            <Database className="w-4 h-4 mr-2" />
            Backup & Restore
          </Button>
          <Button
            variant={activeTab === 'history' ? 'default' : 'outline'}
            onClick={() => setActiveTab('history')}
          >
            Histórico
          </Button>
        </div>

        {/* Aba Status & Atualizações */}
        {activeTab === 'status' && (
          <div className="space-y-6">
            {/* Card de Status Atual */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Status do Sistema
                </CardTitle>
                <CardDescription>
                  Informações sobre a versão atual e atualizações disponíveis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {status && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Versão Atual</Label>
                      <div className="text-2xl font-bold text-blue-600">
                        {versionLoading ? 'carregando...' : version}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Versão Disponível</Label>
                      <div className="text-2xl font-bold">
                        {status.availableVersion ? (
                          <span className="text-green-600">{status.availableVersion}</span>
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Status</Label>
                      <div>
                        {status.updateAvailable ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500 text-white">
                            <Download className="w-3 h-3 mr-1" />
                            Atualização Disponível
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Atualizado
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Modo de Instalação</Label>
                      <div className="flex items-center gap-2">
                        {status.mode === 'docker' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            <Settings className="w-3 h-3 mr-1" />
                            Container Docker
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            <Monitor className="w-3 h-3 mr-1" />
                            Nativo (PM2)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Commit</Label>
                      <div className="text-sm font-mono break-all text-muted-foreground">
                        {versionInfo.commitSha || 'N/A'}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Data do Build</Label>
                      <div className="text-sm text-muted-foreground">
                        {formatBuildDate(versionInfo.buildDate)}
                      </div>
                    </div>

                    {canShowVersionSource && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Origem da Versão</Label>
                        <div className="text-sm font-mono text-muted-foreground">{versionInfo.source}</div>
                      </div>
                    )}
                  </div>
                )}

                {status?.lastCheck && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground pt-2">
                    <div>
                      Última verificação: {new Date(status.lastCheck).toLocaleString('pt-BR')}
                    </div>
                    {status.mode === 'native' && (
                      <div className="flex items-center text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Aviso: Build nativo pode levar até 10 minutos.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Alertas e Ações */}
            {!status?.isConfigured && (
              <div className="flex items-start gap-3 p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  Sistema não configurado. Configure o repositório Git na aba &quot;Configurações&quot; para habilitar atualizações automáticas.
                </div>
              </div>
            )}

            {status?.updateAvailable && (
              <div className="flex items-start gap-3 p-4 border border-blue-200 bg-blue-50 rounded-lg">
                <Download className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  Nova versão disponível: {status.availableVersion}.
                  Clique em &quot;Executar Atualização&quot; para atualizar o sistema.
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-4">
              <Button
                onClick={checkForUpdates}
                disabled={loading.check || !status?.isConfigured || isMaintenanceActive}
                variant="outline"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading.check ? 'animate-spin' : ''}`} />
                Verificar Atualizações
              </Button>

              {status?.updateAvailable && (
                <Button
                  onClick={() => setShowUpdateConfirm(true)}
                  disabled={loading.update || isMaintenanceActive}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Executar Atualização
                </Button>
              )}
            </div>

            {/* Modal de Confirmação */}
            {showUpdateConfirm && (
              <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-yellow-800 space-y-3">
                    <p className="font-medium">
                      Confirma a atualização para a versão {status?.availableVersion}?
                    </p>
                    <p className="text-sm">
                      Esta operação irá:
                    </p>
                    <ul className="text-sm list-disc list-inside space-y-1">
                      <li>Criar backup completo do sistema</li>
                      <li>Atualizar código para nova versão</li>
                      <li>Executar migrações do banco de dados</li>
                      <li>Reinstalar dependências</li>
                      <li>Reiniciar serviços</li>
                    </ul>
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={executeUpdate}
                        disabled={loading.update || isMaintenanceActive}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {loading.update ? (
                          <>
                            <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                            Atualizando...
                          </>
                        ) : (
                          'Confirmar Atualização'
                        )}
                      </Button>
                      <Button
                        onClick={() => setShowUpdateConfirm(false)}
                        variant="outline"
                        size="sm"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Aba Configurações (bloco legado oculto) */}
        {false && activeTab === 'config' && (
          <div className="space-y-6">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gitUsername">Usuário GitHub</Label>
                    <Input
                      id="gitUsername"
                      value={config.gitUsername}
                      onChange={(e) => setConfig(prev => ({ ...prev, gitUsername: e.target.value }))}
                      placeholder="ex: meuusuario"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gitRepository">Repositório</Label>
                    <Input
                      id="gitRepository"
                      value={config.gitRepository}
                      onChange={(e) => setConfig(prev => ({ ...prev, gitRepository: e.target.value }))}
                      placeholder="ex: meu-projeto"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gitToken">Token de Acesso</Label>
                    <Input
                      id="gitToken"
                      type="password"
                      value={config.gitToken}
                      onChange={(e) => setConfig(prev => ({ ...prev, gitToken: e.target.value }))}
                      placeholder={hasSavedGitToken ? 'Token já salvo. Preencha apenas para trocar.' : 'Token GitHub (opcional para repos públicos)'}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gitReleaseBranch">Branch de Release</Label>
                    <Input
                      id="gitReleaseBranch"
                      value={config.gitReleaseBranch}
                      onChange={(e) => setConfig(prev => ({ ...prev, gitReleaseBranch: e.target.value }))}
                      placeholder="main"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="packageManager">Gerenciador de Pacotes</Label>
                    <select
                      id="packageManager"
                      value={config.packageManager}
                      onChange={(e) => setConfig(prev => ({ ...prev, packageManager: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="docker">docker</option>
                      <option value="npm">npm</option>
                      <option value="pnpm">pnpm</option>
                      <option value="yarn">yarn</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={config.updateCheckEnabled}
                        onChange={(e) => setConfig(prev => ({ ...prev, updateCheckEnabled: e.target.checked }))}
                        className="rounded"
                      />
                      Verificação Automática
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Verificar atualizações automaticamente (diariamente)
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    onClick={saveConfig}
                    disabled={loading.config || isMaintenanceActive}
                  >
                    {loading.config ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar Configurações'
                    )}
                  </Button>

                  <Button
                    onClick={testConnection}
                    variant="outline"
                    disabled={!config.gitUsername || !config.gitRepository || isMaintenanceActive}
                  >
                    Testar Conexão
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Aba Backup & Restore */}
        {activeTab === 'backup' && (
          <div className="space-y-6">
            {/* Seção de Backup */}
            <BackupSection onBackupComplete={loadBackupLogs} disabled={isMaintenanceActive} disabledReason={maintenanceReason} />

            {/* Seção de Restore */}
            <RestoreSection onRestoreComplete={loadBackupLogs} disabled={isMaintenanceActive} disabledReason={maintenanceReason} />

            {/* Histórico de Backups */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Histórico de Backups e Restores
                </CardTitle>
                <CardDescription>
                  Registro de operações de backup e restore executadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                {backupLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma operação registrada
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Área de rolagem com altura máxima para 5 itens */}
                    <div className="max-h-[640px] overflow-y-auto pr-2 space-y-4">
                      {backupLogs.map((log) => (
                        <div key={log.id} className="border rounded-lg p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="font-medium">
                                {log.operationType === 'BACKUP' ? '💾 Backup' : '⬆️ Restore'}
                              </span>
                              <span className={`px-2 py-1 text-xs rounded-full ${log.status === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                                log.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                {log.status}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {new Date(log.startedAt).toLocaleString('pt-BR')}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Arquivo:</span> {log.fileName}
                            </div>
                            <div>
                              <span className="font-medium">Tamanho:</span>{' '}
                              {log.fileSize ? (log.fileSize / 1024 / 1024).toFixed(2) + ' MB' : 'N/A'}
                            </div>
                            <div>
                              <span className="font-medium">Duração:</span>{' '}
                              {log.durationSeconds ? `${log.durationSeconds}s` : 'N/A'}
                            </div>
                            <div>
                              <span className="font-medium">Executado por:</span> {log.executedBy}
                            </div>
                          </div>

                          {log.errorMessage && (
                            <div className="flex items-start gap-2 mt-2 p-3 border border-red-200 bg-red-50 rounded-lg">
                              <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                              <div className="text-sm text-red-800">
                                <strong>Erro:</strong> {log.errorMessage}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Indicador de total de registros */}
                    {backupLogs.length > 5 && (
                      <div className="text-center pt-2 text-sm text-muted-foreground border-t">
                        Total de {backupLogs.length} registros (role para ver todos)
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Aba Configurações */}
        {activeTab === 'config' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Configurações do Sistema
                </CardTitle>
                <CardDescription>
                  Configure o repositório Git e parâmetros de atualização
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="gitUsername">Usuário GitHub</Label>
                    <Input
                      id="gitUsername"
                      value={config.gitUsername}
                      onChange={(e) => setConfig(prev => ({ ...prev, gitUsername: e.target.value }))}
                      placeholder="ex: meuusuario"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gitRepository">Repositório</Label>
                    <Input
                      id="gitRepository"
                      value={config.gitRepository}
                      onChange={(e) => setConfig(prev => ({ ...prev, gitRepository: e.target.value }))}
                      placeholder="ex: meu-projeto"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gitToken">Token de Acesso</Label>
                    <Input
                      id="gitToken"
                      type="password"
                      value={config.gitToken}
                      onChange={(e) => setConfig(prev => ({ ...prev, gitToken: e.target.value }))}
                      placeholder={hasSavedGitToken ? 'Token já salvo. Preencha apenas para trocar.' : 'Token GitHub (opcional para repos públicos)'}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gitReleaseBranch">Branch de Release</Label>
                    <Input
                      id="gitReleaseBranch"
                      value={config.gitReleaseBranch}
                      onChange={(e) => setConfig(prev => ({ ...prev, gitReleaseBranch: e.target.value }))}
                      placeholder="main"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="packageManager">Gerenciador de Pacotes</Label>
                    <select
                      id="packageManager"
                      value={config.packageManager}
                      onChange={(e) => setConfig(prev => ({ ...prev, packageManager: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="docker">docker</option>
                      <option value="npm">npm</option>
                      <option value="pnpm">pnpm</option>
                      <option value="yarn">yarn</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={config.updateCheckEnabled}
                        onChange={(e) => setConfig(prev => ({ ...prev, updateCheckEnabled: e.target.checked }))}
                        className="rounded"
                      />
                      Verificação Automática
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Verificar atualizações automaticamente (diariamente)
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    onClick={saveConfig}
                    disabled={loading.config || isMaintenanceActive}
                  >
                    {loading.config ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Salvar Configurações'
                    )}
                  </Button>

                  <Button
                    onClick={testConnection}
                    variant="outline"
                    disabled={!config.gitUsername || !config.gitRepository || isMaintenanceActive}
                  >
                    Testar Conexão
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Aba Histórico */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Histórico de Atualizações
                </CardTitle>
                <CardDescription>
                  Registro de todas as atualizações executadas no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading.logs ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                    Carregando histórico...
                  </div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma atualização registrada
                  </div>
                ) : (
                  <div className="space-y-4">
                    {logs.map((log) => (
                      <div key={log.id} className="border rounded-lg p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-medium">Versão {log.version}</span>
                            {renderStatusBadge(log.status)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {new Date(log.startedAt).toLocaleString('pt-BR')}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Duração:</span> {formatDuration(log.duration)}
                          </div>
                          <div>
                            <span className="font-medium">Package Manager:</span> {log.packageManager}
                          </div>
                          <div>
                            <span className="font-medium">Executado por:</span> {log.executedBy || 'Sistema'}
                          </div>
                          <div>
                            <span className="font-medium">Status:</span> {log.status}
                          </div>
                        </div>

                        {log.errorMessage && (
                          <div className="flex items-start gap-2 mt-2 p-3 border border-red-200 bg-red-50 rounded-lg">
                            <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-red-800">
                              <strong>Erro:</strong> {log.errorMessage}
                            </div>
                          </div>
                        )}

                        {log.rollbackReason && (
                          <div className="flex items-start gap-2 mt-2 p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
                            <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-yellow-800">
                              <strong>Rollback:</strong> {log.rollbackReason}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

