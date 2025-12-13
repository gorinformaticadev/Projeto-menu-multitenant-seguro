"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { Upload, Package, Trash2, Info, AlertTriangle, CheckCircle, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface InstalledModule {
  id: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  isActive: boolean;
  isInstalled: boolean;
  config?: any;
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

  useEffect(() => {
    loadInstalledModules();
  }, []);

  const loadInstalledModules = async () => {
    try {
      setLoading(true);
      const response = await api.get("/modules/installed");
      setModules(response.data);
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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar arquivo
    if (!file.name.endsWith('.zip')) {
      toast({
        title: "Arquivo inválido",
        description: "Apenas arquivos ZIP são aceitos",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 50 * 1024 * 1024) { // 50MB
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 50MB",
        variant: "destructive",
      });
      return;
    }

    await uploadModule(file);
  };

  const uploadModule = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('module', file);

    try {
      const response = await api.post("/modules/upload", formData, {
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

      // Limpar input
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

  const handleRemoveModule = async (moduleName: string) => {
    try {
      await api.delete(`/modules/${moduleName}/uninstall`);
      
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
      const response = await api.get(`/modules/${module.name}/info`);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="upload" className="w-full">
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
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-semibold mb-2">Selecione um arquivo ZIP</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Arraste e solte ou clique para selecionar um módulo (.zip, máx. 50MB)
                </p>
                <Button onClick={handleFileSelect} disabled={uploading}>
                  {uploading ? "Instalando módulo..." : "Selecionar Arquivo"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
              
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
                    <div key={module.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{module.displayName}</h3>
                          <Badge variant={module.isActive ? "default" : "secondary"}>
                            {module.isActive ? "Ativo no Sistema" : "Inativo no Sistema"}
                          </Badge>
                          {module.isInstalled ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Instalado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-600 border-orange-600">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Não Instalado
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{module.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs bg-muted px-2 py-1 rounded font-mono">
                            v{module.version}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {module.name}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openInfoDialog(module)}
                        >
                          <Info className="h-4 w-4 mr-1" />
                          Detalhes
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nome Técnico</label>
                  <p className="font-mono text-sm">{selectedModule.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Versão</label>
                  <p className="font-mono text-sm">{selectedModule.version}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nome de Exibição</label>
                <p className="text-sm">{selectedModule.displayName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Descrição</label>
                <p className="text-sm">{selectedModule.description}</p>
              </div>
              {selectedModule.config && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Configuração Padrão</label>
                  <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40">
                    {JSON.stringify(selectedModule.config, null, 2)}
                  </pre>
                </div>
              )}
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
                <p className="text-sm"><strong>Módulo:</strong> {selectedModule.displayName}</p>
                <p className="text-sm"><strong>Nome Técnico:</strong> {selectedModule.name}</p>
                <p className="text-sm"><strong>Versão:</strong> {selectedModule.version}</p>
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