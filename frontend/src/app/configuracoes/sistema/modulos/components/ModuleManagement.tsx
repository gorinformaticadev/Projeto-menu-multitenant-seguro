"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { Upload, Package, Trash2, Info, AlertTriangle, CheckCircle, Settings, XCircle, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// **NOVAS INTERFACES:** Controle de Migrations
interface MigrationRecord {
  id: string;
  fileName: string;
  type: 'MIGRATION' | 'SEED';
  status: 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  executedAt: string | null;
  executionTime: number | null;
  errorMessage: string | null;
}

interface ModuleMigrationStatus {
  moduleName: string;
  pendingMigrations: number;
  pendingSeeds: number;
  completedMigrations: number;
  completedSeeds: number;
  failedMigrations: number;
  failedSeeds: number;
  migrations: MigrationRecord[];
  seeds: MigrationRecord[];
}

// **INTERFACE ATUALIZADA**
interface InstalledModule {
  slug: string;
  name: string;
  description: string;
  enabled: boolean;
  menus: any[];
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

  useEffect(() => {
    loadInstalledModules();
  }, []);

  const loadInstalledModules = async () => {
    try {
      setLoading(true);
      // Usa o endpoint correto /me/modules que retorna módulos do usuário
      const response = await api.get("/me/modules");
      // A API retorna { modules: [...] }
      setModules(response.data.modules || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar módulos",
        description: error.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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

    } catch (error: any) {
      toast({
        title: "Erro no upload",
        description: error.response?.data?.message || "Erro ao fazer upload do módulo",
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

  const handleRemoveModule = async (moduleName: string) => {
    try {
      // Endpoint correto: /configuracoes/sistema/modulos/:slug/uninstall
      await api.delete(`/configuracoes/sistema/modulos/${moduleName}/uninstall`);
      
      toast({
        title: "Módulo removido",
        description: "Módulo removido com sucesso",
      });

      setShowRemoveDialog(false);
      setSelectedModule(null);
      await loadInstalledModules();

    } catch (error: any) {
      toast({
        title: "Erro ao remover módulo",
        description: error.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    }
  };

  const openInfoDialog = async (module: InstalledModule) => {
    try {
      // Endpoint correto: /configuracoes/sistema/modulos/:slug/info
      const response = await api.get(`/configuracoes/sistema/modulos/${module.name}/info`);
      setSelectedModule(response.data);
      setShowInfoDialog(true);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar informações",
        description: error.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    }
  };

  const openRemoveDialog = (module: InstalledModule) => {
    setSelectedModule(module);
    setShowRemoveDialog(true);
  };

  const updateModuleDatabase = async (moduleName: string) => {
    setUpdatingDatabase(moduleName);

    try {
      // Endpoint correto: /configuracoes/sistema/modulos/:slug/update-database
      const response = await api.post(`/configuracoes/sistema/modulos/${moduleName}/update-database`);

      toast({
        title: "Banco de dados atualizado!",
        description: response.data.message || "Migrações e seed executados com sucesso",
      });

      // Recarregar lista de módulos para atualizar o status
      await loadInstalledModules();

    } catch (error: any) {
      toast({
        title: "Erro ao atualizar banco de dados",
        description: error.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    } finally {
      setUpdatingDatabase(null);
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

    } catch (error: any) {
      toast({
        title: "Erro ao ativar módulo",
        description: error.response?.data?.message || "Ocorreu um erro no servidor",
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

    } catch (error: any) {
      toast({
        title: "Erro ao desativar módulo",
        description: error.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    }
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
              {!selectedFile ? (
                <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-semibold mb-2">Selecione um arquivo ZIP</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Arraste e solte ou clique para selecionar um módulo (.zip, máx. 50MB)
                  </p>
                  <Button onClick={handleFileSelect} disabled={uploading}>
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
                      disabled={uploading}
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
                      disabled={uploading}
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
                  <p className="text-sm mt-2">Use a aba "Instalar Módulos" para adicionar novos módulos</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {modules.map((module) => (
                    <div key={module.slug} className="p-4 border rounded-lg">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Informações do Módulo */}
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium">{module.name}</h3>
                            <Badge variant={module.enabled ? "default" : "secondary"}>
                              {module.enabled ? "Ativo no Sistema" : "Inativo no Sistema"}
                            </Badge>
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Instalado
                            </Badge>
                          </div>                          <p className="text-sm text-muted-foreground">{module.description}</p>
                          
                          {/* **NOVO:** Contadores de pendências */}
                          {/* Pendências de migração removidas - não fazem parte da resposta do backend */}
                          
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {module.name}
                            </span>
                          </div>
                        </div>

                        {/* Botões de Ação */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openInfoDialog(module)}
                          >
                            <Info className="h-4 w-4 mr-1" />
                            Detalhes
                          </Button>
                          
                          {/* Botão para ativar/desativar módulo */}
                          <Button
                            variant={module.enabled ? "outline" : "default"}
                            size="sm"
                            onClick={() => module.enabled ? deactivateModule(module.name) : activateModule(module.name)}
                          >
                            {module.enabled ? (
                              <>
                                <XCircle className="h-4 w-4 mr-1" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Ativar
                              </>
                            )}
                          </Button>
                          
                          {/* Botão para atualizar banco de dados */}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => updateModuleDatabase(module.name)}
                            disabled={updatingDatabase === module.name}
                          >
                            {updatingDatabase === module.name ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Atualizando...
                              </>
                            ) : (
                              <>
                                <Settings className="h-4 w-4 mr-1" />
                                DB
                              </>
                            )}
                          </Button>
                          
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openRemoveDialog(module)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Desinstalar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
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
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm"><strong>Módulo:</strong> {selectedModule.name}</p>
                <p className="text-sm"><strong>Nome Técnico:</strong> {selectedModule.name}</p>
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
              onClick={() => selectedModule && handleRemoveModule(selectedModule.name)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Desinstalar Módulo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}