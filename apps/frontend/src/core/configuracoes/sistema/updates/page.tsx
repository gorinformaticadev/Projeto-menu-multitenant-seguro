'use client';

import { useState, useEffect } from 'react';
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
  Info
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

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

function normalizeVersionTag(version: string): string {
  const value = (version || '').trim();
  if (!value) return value;
  return value.startsWith('v') ? value : `v${value}`;
}

export default function UpdatesPage() {
  const { toast } = useToast();

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

  // Carregar dados iniciais
  useEffect(() => {
    loadStatus();
    loadLogs();
  }, []);

  /**
   * Carrega status atual do sistema
   */
  const loadStatus = async () => {
    try {
      setLoading(prev => ({ ...prev, status: true }));
      const response = await api.get('/api/update/status');
      setStatus(response.data);
    } catch (error: unknown) {
      const message = (error as any).response?.data?.message || (error instanceof Error ? error.message : 'Erro interno do servidor');
      toast({
        title: 'Erro ao carregar status',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, status: false }));
    }
  };

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
      const message = (error as any).response?.data?.message || (error instanceof Error ? error.message : 'Erro interno do servidor');
      toast({
        title: 'Erro na verificação',
        description: message,
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
      const message = (error as any).response?.data?.message || (error instanceof Error ? error.message : 'Erro interno do servidor');
      toast({
        title: 'Erro na atualização',
        description: message,
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

      const response = await api.put('/api/update/config', config);

      toast({
        title: 'Configurações salvas',
        description: response.data.message,
        variant: 'default',
      });

      await loadStatus();
    } catch (error: unknown) {
      const message = (error as any).response?.data?.message || (error instanceof Error ? error.message : 'Erro interno do servidor');
      toast({
        title: 'Erro ao salvar configurações',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, config: false }));
    }
  };

  /**
   * Carrega histórico de atualizações
   */
  const loadLogs = async () => {
    try {
      setLoading(prev => ({ ...prev, logs: true }));
      const response = await api.get('/api/update/logs?limit=20');
      setLogs(response.data.data || []);
    } catch (error: unknown) {
      const message = (error as any).response?.data?.message || (error instanceof Error ? error.message : 'Erro interno do servidor');
      toast({
        title: 'Erro ao carregar histórico',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(prev => ({ ...prev, logs: false }));
    }
  };

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
      const message = (error as any).response?.data?.message || (error instanceof Error ? error.message : 'Erro interno do servidor');
      toast({
        title: 'Erro no teste de conexão',
        description: message,
        variant: 'destructive',
      });
    }
  };

  /**
   * Renderiza badge de status
   */
  const renderStatusBadge = (logStatus: string) => {
    const statusConfig = {
      STARTED: { color: 'bg-skin-info', icon: Clock, text: 'Em Andamento' },
      SUCCESS: { color: 'bg-skin-success', icon: CheckCircle, text: 'Sucesso' },
      FAILED: { color: 'bg-skin-danger', icon: XCircle, text: 'Falhou' },
      ROLLED_BACK: { color: 'bg-skin-warning', icon: AlertTriangle, text: 'Rollback' },
    };

    const config = statusConfig[logStatus as keyof typeof statusConfig] || statusConfig.FAILED;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color} text-skin-text-inverse`}>
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
          <p className="text-skin-text-muted">
            Gerencie atualizações automáticas do sistema via Git
          </p>
        </div>

        <Button
          onClick={loadStatus}
          disabled={loading.status}
          variant="outline"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading.status ? 'animate-spin' : ''}`} />
          Atualizar Status
        </Button>
      </div>

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
                      <div className="text-2xl font-bold text-skin-info">
                        {status.currentVersion}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Versão Disponível</Label>
                      <div className="text-2xl font-bold">
                        {status.availableVersion ? (
                          <span className="text-skin-success">{status.availableVersion}</span>
                        ) : (
                          <span className="text-skin-text-muted">N/A</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Status</Label>
                      <div>
                        {status.updateAvailable ? (
                          <>
                          <span className="inline-flex items-center rounded-full bg-skin-success px-2.5 py-0.5 text-xs font-medium text-skin-text-inverse">
                              <Download className="w-3 h-3 mr-1" />
                              Atualização Disponível
                            </span>
                            <span className="ml-2">Clique em &quot;Executar Atualização&quot; para atualizar o sistema.</span>
                          </>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-skin-background-elevated px-2.5 py-0.5 text-xs font-medium text-skin-text">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Atualizado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {status?.lastCheck && (
                  <div className="text-sm text-skin-text-muted">
                    Última verificação: {new Date(status.lastCheck).toLocaleString('pt-BR')}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Alertas e Ações */}
            {!status?.isConfigured && (
              <div className="flex items-start gap-3 rounded-lg border border-skin-warning/30 bg-skin-warning/10 p-4">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-skin-warning" />
                <div className="text-sm text-skin-warning">
                  Sistema não configurado. Configure o repositório Git na aba &quot;Configurações&quot; para habilitar atualizações automáticas.
                </div>
              </div>
            )}

            {status?.updateAvailable && (
              <div className="flex items-start gap-3 rounded-lg border border-skin-info/30 bg-skin-info/10 p-4">
                <Download className="mt-0.5 h-4 w-4 flex-shrink-0 text-skin-info" />
                <div className="text-sm text-skin-info">
                  Nova versão disponível: {status.availableVersion}.
                  Clique em &quot;Executar Atualização&quot; para atualizar o sistema.
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="flex gap-4">
              <Button
                onClick={checkForUpdates}
                disabled={loading.check || !status?.isConfigured}
                variant="outline"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading.check ? 'animate-spin' : ''}`} />
                Verificar Atualizações
              </Button>

              {status?.updateAvailable && (
                <Button
                  onClick={() => setShowUpdateConfirm(true)}
                  disabled={loading.update}
                  className="bg-skin-success text-skin-text-inverse hover:bg-skin-success/90"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Executar Atualização
                </Button>
              )}
            </div>

            {/* Modal de Confirmação */}
            {showUpdateConfirm && (
              <div className="rounded-lg border border-skin-warning/30 bg-skin-warning/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-skin-warning" />
                  <div className="space-y-3 text-skin-warning">
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
                        disabled={loading.update}
                        size="sm"
                        className="bg-skin-success text-skin-text-inverse hover:bg-skin-success/90"
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
                      placeholder="Token GitHub (opcional para repos públicos)"
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
                      className="w-full rounded-md border border-skin-input-border bg-skin-input-background px-3 py-2 text-skin-text focus:outline-none focus:ring-2 focus:ring-skin-focus-ring"
                    >
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
                    <p className="text-sm text-skin-text-muted">
                      Verificar atualizações automaticamente (diariamente)
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    onClick={saveConfig}
                    disabled={loading.config}
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
                    disabled={!config.gitUsername || !config.gitRepository}
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
                  <div className="text-center py-8 text-skin-text-muted">
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
                          <div className="text-sm text-skin-text-muted">
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
                          <div className="mt-2 flex items-start gap-2 rounded-lg border border-skin-danger/30 bg-skin-danger/10 p-3">
                            <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-skin-danger" />
                            <div className="text-sm text-skin-danger">
                              <strong>Erro:</strong> {log.errorMessage}
                            </div>
                          </div>
                        )}

                        {log.rollbackReason && (
                          <div className="mt-2 flex items-start gap-2 rounded-lg border border-skin-warning/30 bg-skin-warning/10 p-3">
                            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-skin-warning" />
                            <div className="text-sm text-skin-warning">
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
