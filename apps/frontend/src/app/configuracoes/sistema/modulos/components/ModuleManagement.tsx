"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { Upload, Package, Trash2, Info, Settings, Power, PowerOff, Database, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  getAllowedModuleActions,
  getStatusBadgeConfig,
  getStatusGuidance,
  getDisabledTooltip,
  type InstalledModule
} from "@/lib/module-utils";

// **NOVAS INTERFACES:** Controle de Migrations

// interface ModuleMigrationStatus {
//   moduleName: string;
//   pendingMigrations: number;
//   pendingSeeds: number;
//   completedMigrations: number;
//   completedSeeds: number;
//   failedMigrations: number;
//   failedSeeds: number;
//   migrations: MigrationRecord[];
//   seeds: MigrationRecord[];
// }

// **INTERFACE ATUALIZADA** - Agora importada de module-utils
// interface InstalledModule já está definida em @/lib/module-utils

interface ModuleInstallerCapabilities {
  environment: string;
  overrideEnabled: boolean;
  mutableModuleOpsAllowed: boolean;
  reason: 'development' | 'explicit_override' | 'blocked';
  message: string;
}

export function ModuleManagement() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [modules, setModules] = useState<InstalledModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInfoDialog, setShowInfoDialog] = useState(false);
  const [selectedModule, setSelectedModule] = useState<InstalledModule | null>(null);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState("upload");
  const [updatingDatabase, setUpdatingDatabase] = useState<string | null>(null);
  const [dbUpdateStatus, setDbUpdateStatus] = useState<string>("");
  const [reloadingConfig, setReloadingConfig] = useState<string | null>(null);
  const [runningMigrationsSeeds, setRunningMigrationsSeeds] = useState<string | null>(null);
  const [showMigrationsSeedsDialog, setShowMigrationsSeedsDialog] = useState(false);
  const [installerCapabilities, setInstallerCapabilities] = useState<ModuleInstallerCapabilities | null>(null);
  const [loadingCapabilities, setLoadingCapabilities] = useState(true);
  const moduleUploadEnabled = installerCapabilities?.mutableModuleOpsAllowed ?? false;
  const [selectedModuleForMigrations, setSelectedModuleForMigrations] = useState<InstalledModule | null>(null);

  const loadInstalledModules = useCallback(async () => {
    try {
      setLoading(true);
      // Usa o endpoint correto /configuracoes/sistema/modulos que retorna módulos globais
      const response = await api.get("/configuracoes/sistema/modulos");
      // A API retorna array de módulos com status
      setModules(response.data || []);
    } catch (error: unknown) {
      toast({
        title: "Erro ao carregar módulos",
        description: (error as unknown as { response?: { data?: { message?: string } } })?.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadInstallerCapabilities = useCallback(async () => {
    try {
      setLoadingCapabilities(true);
      const response = await api.get("/configuracoes/sistema/modulos/capabilities");
      setInstallerCapabilities(response.data);
    } catch {
      setInstallerCapabilities({
        environment: 'unknown',
        overrideEnabled: false,
        mutableModuleOpsAllowed: false,
        reason: 'blocked',
        message: 'Nao foi possivel validar no backend se o instalador interno esta liberado para alteracoes de modulos.',
      });
    } finally {
      setLoadingCapabilities(false);
    }
  }, []);

  useEffect(() => {
    void loadInstalledModules();
    void loadInstallerCapabilities();
  }, [loadInstalledModules, loadInstallerCapabilities]);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      return;
    }

    // Validar arquivo
    if (!file.name.endsWith('.zip')) {
      toast({
        title: "Arquivo inválido",
        description: "Apenas arquivos ZIP são aceitos",
        variant: "destructive",
      });
      setSelectedFile(null);
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 50MB",
        variant: "destructive",
      });
      setSelectedFile(null);
      return;
    }

    // Apenas armazenar o arquivo selecionado
    setSelectedFile(file);

    toast({
      title: "Arquivo selecionado",
      description: `Arquivo "${file.name}" pronto para upload`,
    });
  };

  const uploadModule = async () => {
    if (!moduleUploadEnabled) {
      toast({ title: 'Operacao bloqueada', description: installerCapabilities?.message || 'Operacoes mutaveis de modulos estao bloqueadas neste ambiente.', variant: 'destructive' });
      return;
    }

    if (!selectedFile) return;

    setUploading(true);
    const formData = new FormData();
    // O backend espera o campo 'file', não 'module'
    formData.append('file', selectedFile);

    try {
      // Endpoint correto: /configuracoes/sistema/modulos/upload
      const response = await api.post("/configuracoes/sistema/modulos/upload", formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast({
        title: "Sucesso!",
        description: response.data.message || "Módulo instalado com sucesso",
      });

      // Recarregar lista de módulos
      await loadInstalledModules();

      // Redirecionar para a aba "Módulos Instalados"
      setActiveTab("installed");

      // Limpar seleção
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error: unknown) {
      toast({
        title: "Erro no upload",
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Erro ao fazer upload do módulo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const [confirmationInput, setConfirmationInput] = useState("");

  const handleRemoveModule = async () => {
    if (!moduleUploadEnabled) {
      toast({ title: 'Operacao bloqueada', description: installerCapabilities?.message || 'Operacoes mutaveis de modulos estao bloqueadas neste ambiente.', variant: 'destructive' });
      return;
    }

    if (!selectedModule) return;

    // Validação frontend básica da confirmação
    if (confirmationInput !== selectedModule.slug) {
      toast({
        title: "Confirmação incorreta",
        description: "Digite o slug exato do módulo para confirmar.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Endpoint correto: /configuracoes/sistema/modulos/:slug/uninstall
      // Enviando BODY com confirmationName e dataRemovalOption
      await api.delete(`/configuracoes/sistema/modulos/${selectedModule.slug}/uninstall`, {
        data: {
          confirmationName: confirmationInput,
          dataRemovalOption: 'full' // Padrão: remover tudo
        }
      });

      toast({
        title: "Módulo removido",
        description: "Módulo removido com sucesso",
      });

      setShowRemoveDialog(false);
      setSelectedModule(null);
      setConfirmationInput(""); // Limpa input
      await loadInstalledModules();

    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { message?: string }, status?: number } })?.response?.data?.message || "Ocorreu um erro no servidor";
      const status = (error as { response?: { status?: number } })?.response?.status;

      // Se não encontrado, atualiza a lista para remover o fantasma
      if (errorMessage === 'Módulo não encontrado' || status === 404) {
        toast({
          title: "Módulo não encontrado",
          description: "O módulo já foi removido ou não existe. Atualizando lista...",
          variant: "default",
        });
        setShowRemoveDialog(false);
        setSelectedModule(null);
        setConfirmationInput("");
        await loadInstalledModules();
        return;
      }

      toast({
        title: "Erro ao remover módulo",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const openRemoveDialog = (module: InstalledModule) => {
    setSelectedModule(module);
    setConfirmationInput(""); // Reset input ao abrir
    setShowRemoveDialog(true);
  };




  const openInfoDialog = async (module: InstalledModule) => {
    try {
      // Endpoint correto: /configuracoes/sistema/modulos/:slug/status
      const response = await api.get(`/configuracoes/sistema/modulos/${module.slug}/status`);
      // O endpoint status retorna wrapping object { module: ... } e outras infos
      // Ajustamos para exibir o módulo
      setSelectedModule(response.data.module);
      setShowInfoDialog(true);
    } catch (error: unknown) {
      toast({
        title: "Erro ao carregar informações",
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    }
  };



  const updateModuleDatabase = async (moduleName: string) => {
    setUpdatingDatabase(moduleName);
    setDbUpdateStatus("Rodando Migrations...");

    try {
      // 1. Executar Migrations
      const migResponse = await api.post(`/configuracoes/sistema/modulos/${moduleName}/run-migrations`);

      toast({
        title: "Migrations ok",
        description: `${migResponse.data.count} migrations executadas com sucesso.`,
      });

      setDbUpdateStatus("Aguardando...");
      // Pequena espera UX
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 2. Executar Seeds
      setDbUpdateStatus("Rodando Seeds...");
      await api.post(`/configuracoes/sistema/modulos/${moduleName}/run-seeds`);

      toast({
        title: "Banco de dados atualizado!",
        description: "Migrações e seeds finalizados. Módulo pronto para uso.",
        className: "bg-green-50 border-green-200 text-green-800",
      });

      // Recarregar lista de módulos para atualizar o status
      await loadInstalledModules();

    } catch (error: unknown) {
      toast({
        title: "Erro ao atualizar banco de dados",
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    } finally {
      setUpdatingDatabase(null);
      setDbUpdateStatus("");
    }
  };

  const activateModule = async (moduleName: string) => {
    try {
      // Endpoint para ativar módulo: /configuracoes/sistema/modulos/:slug/activate
      const response = await api.post(`/configuracoes/sistema/modulos/${moduleName}/activate`);

      toast({
        title: "Módulo ativado!",
        description: response.data.message || "Módulo ativado com sucesso",
      });

      // Recarregar lista de módulos para atualizar o status
      await loadInstalledModules();

    } catch (error: unknown) {
      toast({
        title: "Erro ao ativar módulo",
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    }
  };

  const deactivateModule = async (moduleName: string) => {
    try {
      // Endpoint para desativar módulo: /configuracoes/sistema/modulos/:slug/deactivate
      const response = await api.post(`/configuracoes/sistema/modulos/${moduleName}/deactivate`);

      toast({
        title: "Módulo desativado!",
        description: response.data.message || "Módulo desativado com sucesso",
      });

      // Recarregar lista de módulos para atualizar o status
      await loadInstalledModules();

    } catch (error: unknown) {
      toast({
        title: "Erro ao desativar módulo",
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    }
  };

  const reloadModuleConfig = async (moduleName: string) => {
    if (!moduleUploadEnabled) {
      toast({ title: 'Operacao bloqueada', description: installerCapabilities?.message || 'Operacoes mutaveis de modulos estao bloqueadas neste ambiente.', variant: 'destructive' });
      return;
    }

    setReloadingConfig(moduleName);

    try {
      // Endpoint: /configuracoes/sistema/modulos/:slug/reload-config
      await api.post(`/configuracoes/sistema/modulos/${moduleName}/reload-config`);

      toast({
        title: "Configuração Recarregada!",
        description: `Menus e configurações do módulo ${moduleName} foram atualizados.`,
      });

      // Recarregar lista de módulos
      await loadInstalledModules();

    } catch (error: unknown) {
      toast({
        title: "Erro ao recarregar configuração",
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Ocorreu um erro ao recarregar a configuração",
        variant: "destructive",
      });
    } finally {
      setReloadingConfig(null);
    }
  };

  const runMigrationsAndSeeds = async (moduleName: string) => {
    setRunningMigrationsSeeds(moduleName);

    try {
      console.log(`🔄 Frontend: Executando migrations/seeds para ${moduleName}`);

      // Endpoint: /configuracoes/sistema/modulos/:slug/run-migrations-seeds
      const response = await api.post(`/configuracoes/sistema/modulos/${moduleName}/run-migrations-seeds`);

      console.log(`✅ Frontend: Sucesso ao executar migrations/seeds:`, response.data);

      toast({
        title: "Migrations e Seeds Executados!",
        description: `${response.data.module.migrationsExecuted} migrations e ${response.data.module.seedsExecuted} seeds foram executados novamente.`,
      });

      // Recarregar lista de módulos
      await loadInstalledModules();

    } catch (error: unknown) {
      console.error(`❌ Frontend: Erro ao executar migrations/seeds:`, error);

      toast({
        title: "Erro ao executar migrations/seeds",
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Ocorreu um erro ao executar migrations e seeds",
        variant: "destructive",
      });
    } finally {
      setRunningMigrationsSeeds(null);
      setShowMigrationsSeedsDialog(false);
      setSelectedModuleForMigrations(null);
    }
  };

  const handleMigrationsSeedsClick = (module: InstalledModule) => {
    setSelectedModuleForMigrations(module);
    setShowMigrationsSeedsDialog(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload">Instalar Módulos</TabsTrigger>
          <TabsTrigger value="installed">Módulos Instalados</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-6">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Instalação de Módulos
              </CardTitle>
              <CardDescription>
                Faça upload de módulos em formato ZIP para instalar globalmente no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!loadingCapabilities && installerCapabilities && !moduleUploadEnabled && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-medium">Instalador interno em modo restrito</p>
                  <p className="mt-1">
                    Ambiente atual: <strong>{installerCapabilities.environment}</strong>. {installerCapabilities.message}
                  </p>
                </div>
              )}

              {!selectedFile ? (
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">Selecione um arquivo ZIP</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Arraste e solte ou clique para selecionar um módulo (.zip, máx. 50MB)
                  </p>
                  <Button onClick={handleFileSelect} disabled={uploading || loadingCapabilities || !moduleUploadEnabled}>
                    Selecionar Arquivo
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Informações do arquivo selecionado */}
                  <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Package className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-green-800">Arquivo Selecionado</h3>
                          <p className="text-sm text-green-700">Pronto para instalação</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSelectedFile}
                        className="text-green-600 hover:text-green-700"
                      >
                        ✕
                      </Button>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-green-800">Nome do arquivo:</span>
                        <span className="text-sm font-mono text-green-700">{selectedFile.name}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-green-800">Tamanho:</span>
                        <span className="text-sm text-green-700">{formatFileSize(selectedFile.size)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-green-800">Tipo:</span>
                        <span className="text-sm text-green-700">{selectedFile.type || 'application/zip'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-green-800">Última modificação:</span>
                        <span className="text-sm text-green-700">
                          {new Date(selectedFile.lastModified).toLocaleString('pt-BR')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botões de ação */}
                  <div className="flex gap-3">
                    <Button
                      onClick={uploadModule}
                      disabled={uploading || loadingCapabilities || !moduleUploadEnabled}
                      className="flex-1"
                    >
                      {uploading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Instalando módulo...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Instalar Módulo
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={clearSelectedFile}
                      disabled={uploading || loadingCapabilities || !moduleUploadEnabled}
                    >
                      Cancelar
                    </Button>
                  </div>

                  {/* Input oculto para seleção de novo arquivo */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}

              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Estrutura do Módulo
                </h4>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>• <code className="bg-muted px-1 rounded">module.json</code> - Configuração do módulo (obrigatório)</p>
                  <p>• <code className="bg-muted px-1 rounded">migrations/</code> - Scripts SQL para banco de dados (opcional)</p>
                  <p>• <code className="bg-muted px-1 rounded">package.json</code> - Dependências NPM (opcional)</p>
                  <p>• Outros arquivos do módulo (componentes, assets, etc.)</p>
                </div>
              </div>

              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium mb-2 text-blue-800 flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Instalação Global
                </h4>
                <p className="text-sm text-blue-700">
                  Os módulos instalados aqui ficam disponíveis para todos os tenants do sistema.
                  Cada tenant pode ativar/desativar os módulos individualmente em suas configurações.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="installed" className="mt-6">
          {/* Installed Modules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Módulos Instalados no Sistema
              </CardTitle>
              <CardDescription>
                Gerencie os módulos instalados globalmente no sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              {modules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p>Nenhum módulo instalado no sistema</p>
                  <p className="text-sm mt-2">Use a aba &quot;Instalar Módulos&quot; para adicionar novos módulos</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {modules.map((module) => {
                    // Obtém ações permitidas baseadas no status
                    const allowedActions = getAllowedModuleActions(module.status);
                    const badgeConfig = getStatusBadgeConfig(module.status);
                    const guidance = getStatusGuidance(module.status);

                    return (
                      <div key={module.slug} className="p-4 border rounded-lg">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          {/* Informações do Módulo */}
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-medium">{module.name}</h3>
                              <Badge className={`${badgeConfig.color} border`}>
                                {badgeConfig.icon} {badgeConfig.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">v{module.version}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">{module.description}</p>

                            {/* Mensagem de orientação */}
                            <div className="p-2 bg-muted/50 rounded text-xs">
                              <p className="font-medium">{guidance.title}</p>
                              <p className="text-muted-foreground">{guidance.message}</p>
                              {guidance.suggestion && (
                                <p className="text-primary mt-1">➡️ {guidance.suggestion}</p>
                              )}
                            </div>

                            {module.stats && (
                              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                <span>📊 {module.stats.tenants} tenant(s)</span>
                                <span>🗃️ {module.stats.migrations} migration(s)</span>
                                <span>📑 {module.stats.menus} menu(s)</span>
                              </div>
                            )}
                          </div>

                          {/* Botões de Ação - Controlados por Status */}
                          <TooltipProvider>
                            <div className="flex flex-wrap items-center gap-2">


                              {/* Botão Recarregar Config (Novo) */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => reloadModuleConfig(module.slug)}
                                    disabled={reloadingConfig === module.slug || loadingCapabilities || !moduleUploadEnabled}
                                  >
                                    {reloadingConfig === module.slug ? (
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                    ) : (
                                      <RefreshCw className="h-4 w-4 text-blue-600" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Recarregar configurações e menus do disco (module.json)
                                </TooltipContent>
                              </Tooltip>

                              {/* Botão Executar Migrations/Seeds */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleMigrationsSeedsClick(module)}
                                    disabled={!allowedActions.runMigrationsSeeds || runningMigrationsSeeds === module.slug}
                                  >
                                    {runningMigrationsSeeds === module.slug ? (
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                                    ) : (
                                      <Database className="h-4 w-4 text-green-600" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {allowedActions.runMigrationsSeeds
                                    ? 'Executar migrations e seeds pendentes'
                                    : getDisabledTooltip('runMigrationsSeeds', module.status)}
                                </TooltipContent>
                              </Tooltip>

                              {/* Botão Detalhes (sempre ativo) */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openInfoDialog(module)}
                                  >
                                    <Info className="h-4 w-4 mr-1" />
                                    Detalhes
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ver informações detalhadas</TooltipContent>
                              </Tooltip>

                              {/* Botão Atualizar Banco */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => updateModuleDatabase(module.slug)}
                                    disabled={!allowedActions.updateDatabase || updatingDatabase === module.slug}
                                  >
                                    {updatingDatabase === module.slug ? (
                                      <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                        {dbUpdateStatus || "Atualizando..."}
                                      </>
                                    ) : (
                                      <>
                                        <Database className="h-4 w-4 mr-1" />
                                        Atualizar Banco
                                      </>
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {allowedActions.updateDatabase
                                    ? 'Executar migrations e seeds'
                                    : getDisabledTooltip('updateDatabase', module.status)}
                                </TooltipContent>
                              </Tooltip>

                              {/* Botão Ativar */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => activateModule(module.slug)}
                                    disabled={!allowedActions.activate}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <Power className="h-4 w-4 mr-1" />
                                    Ativar
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {allowedActions.activate
                                    ? 'Ativar módulo no sistema'
                                    : getDisabledTooltip('activate', module.status)}
                                </TooltipContent>
                              </Tooltip>

                              {/* Botão Desativar */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => deactivateModule(module.slug)}
                                    disabled={!allowedActions.deactivate}
                                  >
                                    <PowerOff className="h-4 w-4 mr-1" />
                                    Desativar
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {allowedActions.deactivate
                                    ? 'Desativar módulo temporariamente'
                                    : getDisabledTooltip('deactivate', module.status)}
                                </TooltipContent>
                              </Tooltip>

                              {/* Botão Desinstalar */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => openRemoveDialog(module)}
                                    disabled={!allowedActions.uninstall || loadingCapabilities || !moduleUploadEnabled}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Desinstalar
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {allowedActions.uninstall
                                    ? 'Remover módulo do sistema'
                                    : getDisabledTooltip('uninstall', module.status)}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Info Dialog */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Módulo</DialogTitle>
            <DialogDescription>
              Informações técnicas e configurações do módulo
            </DialogDescription>
          </DialogHeader>
          {selectedModule && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nome Técnico</label>
                <p className="font-mono text-sm">{selectedModule.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Descrição</label>
                <p className="text-sm">{selectedModule.description}</p>
              </div>
              {/* Configuração padrão removida - não faz parte da resposta do backend */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  <strong>Nota:</strong> Este módulo está instalado globalmente no sistema.
                  Cada tenant pode ativá-lo ou desativá-lo individualmente em suas configurações.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInfoDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Dialog */}
      <Dialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Desinstalar Módulo</DialogTitle>
            <DialogDescription>
              Esta ação removerá permanentemente o módulo do sistema.
            </DialogDescription>
          </DialogHeader>
          {selectedModule && (
            <div className="space-y-4">
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm font-medium text-destructive mb-2">⚠️ Atenção!</p>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Todos os arquivos do módulo serão removidos do sistema</li>
                  <li>O módulo será desativado automaticamente em todos os tenants</li>
                  <li>Esta ação não pode ser desfeita</li>
                  <li>Dados relacionados ao módulo podem ser perdidos</li>
                </ul>
              </div>
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <p className="text-sm"><strong>Módulo:</strong> {selectedModule.name}</p>
                <p className="text-sm"><strong>Slug (Nome Técnico):</strong> <code className="bg-white px-1 rounded border">{selectedModule.slug}</code></p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">
                  Digite o slug do módulo (<strong>{selectedModule.slug}</strong>) para confirmar:
                </label>
                <input
                  type="text"
                  value={confirmationInput}
                  onChange={(e) => setConfirmationInput(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-destructive/50"
                  placeholder={`Digite ${selectedModule.slug}`}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRemoveDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveModule}
              disabled={selectedModule ? confirmationInput !== selectedModule.slug : true}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Confirmar Desinstalação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação para Migrations/Seeds */}
      <Dialog open={showMigrationsSeedsDialog} onOpenChange={setShowMigrationsSeedsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-green-600" />
              Executar Migrations e Seeds Pendentes
            </DialogTitle>
            <DialogDescription asChild>
              <div>
                <p className="mb-4">
                  Deseja executar as migrations e seeds pendentes do módulo <strong>{selectedModuleForMigrations?.name}</strong>?
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4" />
                    <strong>Informação:</strong>
                  </div>
                  <p className="mb-2">Esta ação irá:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Verificar quais migrations e seeds ainda não foram executados</li>
                    <li>Executar apenas os arquivos pendentes</li>
                    <li>Manter os registros das execuções anteriores</li>
                  </ul>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowMigrationsSeedsDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="default"
              onClick={() => selectedModuleForMigrations && runMigrationsAndSeeds(selectedModuleForMigrations.slug)}
              disabled={runningMigrationsSeeds !== null}
            >
              {runningMigrationsSeeds ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              Confirmar Execução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
