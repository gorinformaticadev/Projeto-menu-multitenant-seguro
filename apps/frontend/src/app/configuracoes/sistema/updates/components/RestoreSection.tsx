'use client';

import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import api from '@/lib/api';

interface RestoreSectionProps {
  onRestoreComplete?: () => void;
}

export function RestoreSection({ onRestoreComplete }: RestoreSectionProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; fileInfo?: any; error?: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Timer para atualizar tempo decorrido durante restore
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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setValidationResult(null);

    // Validar arquivo automaticamente
    await validateFile(selectedFile);
  };

  const validateFile = async (fileToValidate: File) => {
    try {
      setValidating(true);

      const formData = new FormData();
      formData.append('file', fileToValidate);

      const response = await api.post('/api/backup/validate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setValidationResult(response.data);

      if (response.data.valid) {
        toast({
          title: 'Arquivo válido',
          description: 'O arquivo de backup foi validado com sucesso',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Arquivo inválido',
          description: response.data.error || 'Arquivo não é um backup válido',
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      console.error('Erro ao validar arquivo:', error);
      setValidationResult({
        valid: false,
        error: 'Erro ao validar arquivo',
      });
      toast({
        title: 'Erro na validação',
        description: 'Não foi possível validar o arquivo',
        variant: 'destructive',
      });
    } finally {
      setValidating(false);
    }
  };

  const handleRestore = async () => {
    if (!file || !validationResult?.valid) return;

    try {
      setLoading(true);
      setStartTime(Date.now());
      setElapsedTime(0);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('confirmationText', confirmationText);

      const response = await api.post('/api/backup/restore', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        const duration = response.data.data.durationSeconds || elapsedTime;
        
        toast({
          title: 'Restore concluído com sucesso',
          description: `Banco de dados restaurado em ${duration}s a partir de ${file.name}`,
          variant: 'default',
        });

        // Limpar estados
        setFile(null);
        setValidationResult(null);
        setConfirmationText('');
        setShowConfirmModal(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        onRestoreComplete?.();
      }
    } catch (error: unknown) {
      console.error('Erro ao executar restore:', error);
      toast({
        title: 'Erro ao executar restore',
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro interno do servidor',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setStartTime(null);
      setTimeout(() => setElapsedTime(0), 3000);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Restaurar Backup do Banco de Dados
          </CardTitle>
          <CardDescription>
            Restaurar dados a partir de um arquivo de backup
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Avisos de Perigo */}
          <div className="flex items-start gap-3 p-4 border border-red-200 bg-red-50 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-800">
              <p className="font-bold mb-1">⚠️ ATENÇÃO: Operação Destrutiva</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Todos os dados atuais serão SUBSTITUÍDOS</li>
                <li>Um backup de segurança será criado automaticamente</li>
                <li>A operação pode levar vários minutos</li>
                <li>Todos os usuários serão desconectados temporariamente</li>
              </ul>
            </div>
          </div>

          {/* Upload de Arquivo */}
          <div className="space-y-2">
            <Label htmlFor="backup-file">Selecionar Arquivo de Backup</Label>
            <Input
              ref={fileInputRef}
              id="backup-file"
              type="file"
              accept=".sql,.dump,.backup"
              onChange={handleFileSelect}
              disabled={validating || loading}
            />
            {file && (
              <p className="text-sm text-gray-600">
                Arquivo selecionado: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          {/* Validação */}
          {validating && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
              <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
              <span className="text-sm text-blue-600">Validando arquivo...</span>
            </div>
          )}

          {validationResult && (
            <div className={`flex items-start gap-3 p-4 rounded-lg border ${
              validationResult.valid 
                ? 'border-green-200 bg-green-50' 
                : 'border-red-200 bg-red-50'
            }`}>
              {validationResult.valid ? (
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className={`text-sm ${validationResult.valid ? 'text-green-800' : 'text-red-800'}`}>
                <p className="font-medium mb-1">
                  {validationResult.valid ? 'Arquivo Válido' : 'Arquivo Inválido'}
                </p>
                {validationResult.error && <p>{validationResult.error}</p>}
                {validationResult.fileInfo && (
                  <div className="space-y-1 mt-2">
                    <p>Formato: {validationResult.fileInfo.format}</p>
                    <p>Tamanho: {(validationResult.fileInfo.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Botão de Restaurar */}
          <Button
            onClick={() => setShowConfirmModal(true)}
            disabled={!file || !validationResult?.valid || loading}
            className="bg-red-600 hover:bg-red-700"
          >
            <Upload className="w-4 h-4 mr-2" />
            Restaurar Backup
          </Button>
        </CardContent>
      </Card>

      {/* Modal de Confirmação */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-6 h-6" />
              <h2 className="text-xl font-bold">Confirmar Restore</h2>
            </div>

            <div className="space-y-3 text-sm text-gray-700">
              <p className="font-medium">Esta ação irá:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Criar um backup de segurança do estado atual</li>
                <li>Substituir TODOS os dados existentes</li>
                <li>Desconectar temporariamente todos os usuários</li>
                <li>Executar o restore do arquivo selecionado</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmation">
                Digite <strong>CONFIRMAR</strong> para prosseguir:
              </Label>
              <Input
                id="confirmation"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder="CONFIRMAR"
                disabled={loading}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmationText('');
                }}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleRestore}
                disabled={confirmationText !== 'CONFIRMAR' || loading}
                className="bg-red-600 hover:bg-red-700"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Restaurando...
                  </>
                ) : (
                  'Confirmar Restore'
                )}
              </Button>
            </div>

            {loading && (
              <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">Executando restore...</p>
                    <p className="text-xs text-blue-700 mt-1">Restaurando dados do backup</p>
                  </div>
                </div>
                
                {/* Indicador de tempo decorrido */}
                <div className="flex items-center justify-between text-xs text-blue-700">
                  <span>Tempo decorrido: {elapsedTime}s</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                    Processando
                  </span>
                </div>
                
                {/* Barra de progresso indeterminada */}
                <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-blue-600 animate-pulse" style={{ width: '70%' }}></div>
                </div>
                
                <p className="text-xs text-blue-600 italic font-medium">
                  ⚠️ Não feche esta janela. A operação pode levar vários minutos.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
