'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, CheckCircle, AlertCircle, FileDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

interface BackupSectionProps {
  onBackupComplete?: () => void;
}

interface AvailableBackup {
  fileName: string;
  fileSize: number;
  createdAt: string;
  backupId?: string;
}

export function BackupSection({ onBackupComplete }: BackupSectionProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [availableBackups, setAvailableBackups] = useState<AvailableBackup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Cleanup do EventSource ao desmontar
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Timer para atualizar tempo decorrido
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (loading && startTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [loading, startTime]);

  // Carregar backups disponíveis ao montar
  useEffect(() => {
    loadAvailableBackups();
  }, []);

  /**
   * Carrega lista de backups disponíveis
   */
  const loadAvailableBackups = async () => {
    try {
      setLoadingBackups(true);
      const response = await api.get('/api/backup/available');
      setAvailableBackups(response.data.data || []);
    } catch (error) {
      console.error('Erro ao carregar backups:', error);
    } finally {
      setLoadingBackups(false);
    }
  };

  /**
   * Faz download manual de um backup usando fetch para forçar download
   */
  const handleDownloadBackup = async (fileName: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const downloadUrl = `${apiUrl}/api/backup/download-file/${encodeURIComponent(fileName)}`;
      
      // Usar fetch para baixar o arquivo
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        throw new Error(`Erro ao baixar arquivo: ${response.statusText}`);
      }
      
      // Converter resposta em blob
      const blob = await response.blob();
      
      // Criar URL temporária do blob
      const url = window.URL.createObjectURL(blob);
      
      // Criar link e simular clique
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      
      // Limpar
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: 'Download concluído',
        description: `Arquivo baixado: ${fileName}`,
        variant: 'default',
      });
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      toast({
        title: 'Erro no download',
        description: 'Não foi possível baixar o arquivo. Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateBackup = async () => {
    try {
      setLoading(true);
      setStartTime(Date.now());
      setProgress('Iniciando backup...');
      setProgressMessages([]);

      // Gerar sessionId único
      const sessionId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Obter token JWT do localStorage (o sistema usa a chave "@App:token")
      // Tentar diferentes locais onde o token pode estar armazenado
      let token: string | null = null;
      
      // 1. Tentar buscar do localStorage com chave @App:token (codificado)
      const encryptedToken = localStorage.getItem('@App:token');
      if (encryptedToken) {
        try {
          token = atob(encryptedToken);
          console.log('✅ Token encontrado no localStorage (@App:token)');
        } catch (e) {
          console.error('❌ Erro ao decodificar token do localStorage:', e);
        }
      }
      
      // 2. Tentar buscar do sessionStorage
      if (!token) {
        const sessionToken = sessionStorage.getItem('@App:token');
        if (sessionToken) {
          try {
            token = atob(sessionToken);
            console.log('✅ Token encontrado no sessionStorage (@App:token)');
          } catch (e) {
            console.error('❌ Erro ao decodificar token do sessionStorage:', e);
          }
        }
      }
      
      // 3. Tentar extrair do cookie
      if (!token) {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const [name, value] = cookie.trim().split('=');
          if (name === 'accessToken') {
            token = value;
            console.log('✅ Token encontrado nos cookies (accessToken)');
            break;
          }
        }
      }
      
      if (!token) {
        console.error('❌ Token não encontrado em nenhum local!');
        console.log('localStorage.getItem("@App:token"):', localStorage.getItem('@App:token'));
        console.log('sessionStorage.getItem("@App:token"):', sessionStorage.getItem('@App:token'));
        console.log('document.cookie:', document.cookie);
        throw new Error('Token de autenticação não encontrado. Faça login novamente.');
      }

      // Conectar ao SSE endpoint com token na URL
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const eventSource = new EventSource(
        `${apiUrl}/api/backup/progress/${sessionId}?token=${encodeURIComponent(token)}`
      );
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.message) {
            setProgress(data.message);
            setProgressMessages(prev => [...prev.slice(-4), data.message]); // Manter últimas 5 mensagens
          }
          if (data.completed) {
            eventSource.close();
          }
        } catch (e) {
          console.error('Erro ao parsear mensagem SSE:', e);
        }
      };

      eventSource.onerror = (error) => {
        console.error('Erro no SSE:', error);
        eventSource.close();
      };

      // Iniciar backup
      const response = await api.post('/api/backup/create', {
        includeMetadata: true,
        compressionLevel: 'default',
        sessionId,
      });

      if (response.data.success) {
        const duration = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
        setProgress(`Backup concluído em ${duration}s`);
        
        toast({
          title: 'Backup criado com sucesso',
          description: `Arquivo: ${response.data.data.fileName} (${(response.data.data.fileSize / 1024 / 1024).toFixed(2)} MB)`,
          variant: 'default',
        });

        // Recarregar lista de backups disponíveis
        await loadAvailableBackups();

        onBackupComplete?.();
      }
    } catch (error: unknown) {
      console.error('Erro ao criar backup:', error);
      setProgress('Erro ao criar backup');
      toast({
        title: 'Erro ao criar backup',
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro interno do servidor',
        variant: 'destructive',
      });
    } finally {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      setLoading(false);
      setStartTime(null);
      setTimeout(() => {
        setProgress('');
        setElapsedTime(0);
        setProgressMessages([]);
      }, 5000);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="w-5 h-5" />
          Criar Backup do Banco de Dados
        </CardTitle>
        <CardDescription>
          Exportar snapshot completo de todos os dados do sistema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 p-4 border border-blue-200 bg-blue-50 rounded-lg">
          <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Sobre o Backup:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Inclui todas as tabelas, dados, índices e constraints</li>
              <li>Formato compactado para reduzir tamanho do arquivo</li>
              <li>Recomendado antes de atualizações importantes</li>
              <li>Arquivo será salvo no servidor e aparecerá na lista abaixo</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-4">
          <Button
            onClick={handleCreateBackup}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700"
          >
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
        </div>

        {loading && (
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 animate-spin text-blue-600 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Processando backup...</p>
                <p className="text-xs text-gray-600 mt-1">{progress || 'Aguardando resposta...'}</p>
              </div>
            </div>
            
            {/* Mensagens de progresso em tempo real */}
            {progressMessages.length > 0 && (
              <div className="bg-white rounded border border-gray-200 p-3 max-h-40 overflow-y-auto">
                <p className="text-xs font-semibold text-gray-700 mb-2">Log de progresso:</p>
                {progressMessages.map((msg, idx) => (
                  <div key={idx} className="text-xs text-gray-600 font-mono py-0.5 flex items-start gap-2">
                    <span className="text-blue-500 flex-shrink-0">•</span>
                    <span className="flex-1">{msg}</span>
                  </div>
                ))}
              </div>
            )}
            
            {/* Indicador de tempo decorrido */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Tempo decorrido: {elapsedTime}s</span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                Em andamento
              </span>
            </div>
            
            {/* Barra de progresso indeterminada */}
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
              <div className="h-full bg-blue-600 animate-pulse" style={{ width: '70%' }}></div>
            </div>
            
            <p className="text-xs text-gray-500 italic flex items-center gap-2">
              <AlertCircle className="h-3 w-3" />
              Aguarde... Isso pode levar alguns minutos dependendo do tamanho do banco de dados.
            </p>
          </div>
        )}

        {/* Lista de Backups Disponíveis */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Backups Disponíveis</h3>
              <p className="text-xs text-gray-500 mt-1">Arquivos salvos no servidor</p>
            </div>
            <Button
              onClick={loadAvailableBackups}
              disabled={loadingBackups}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${loadingBackups ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {loadingBackups ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 animate-spin text-gray-400 mr-2" />
              <span className="text-sm text-gray-500">Carregando backups...</span>
            </div>
          ) : availableBackups.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
              <FileDown className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Nenhum backup encontrado</p>
              <p className="text-xs text-gray-400 mt-1">Crie um backup para começar</p>
            </div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Nome do Arquivo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tamanho
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Data de Criação
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {availableBackups.map((backup, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileDown className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {backup.fileName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">
                            {(backup.fileSize / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">
                            {new Date(backup.createdAt).toLocaleString('pt-BR')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            onClick={() => handleDownloadBackup(backup.fileName)}
                            size="sm"
                            variant="outline"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Download className="w-3 h-3 mr-1" />
                            Baixar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
