"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { Package } from "lucide-react";
import { moduleRegistry } from "@/lib/module-registry";

interface ModuleConfig {
  name: string;
  displayName: string;
  description: string;
  version: string;
}

interface TenantModuleStatus {
  moduleName: string;
  active: boolean;
}

export function ModulesTab({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [moduleStatus, setModuleStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadModules();
  }, [tenantId]);

  const loadModules = async () => {
    try {
      setLoading(true);
      
      // Módulos disponíveis (incluindo Module Exemplo)
      const availableModules = [
        {
          name: 'module-exemplo',
          displayName: 'Module Exemplo',
          description: 'Módulo de exemplo para demonstração do sistema modular',
          version: '1.0.0'
        }
      ];
      
      setModules(availableModules);
      
      // Sincronizar status com o Module Registry
      const statusMap: Record<string, boolean> = {};
      availableModules.forEach(module => {
        statusMap[module.name] = moduleRegistry.isModuleActive(module.name);
      });
      
      setModuleStatus(statusMap);
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

  const toggleModuleStatus = async (moduleName: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;
      
      if (newStatus) {
        // Ativar módulo
        moduleRegistry.activateModule(moduleName);
        toast({
          title: "Módulo ativado",
          description: `O módulo ${moduleName} foi ativado com sucesso.`,
        });
      } else {
        // Desativar módulo
        moduleRegistry.deactivateModule(moduleName);
        toast({
          title: "Módulo desativado",
          description: `O módulo ${moduleName} foi desativado com sucesso.`,
        });
      }
      
      // Atualizar status local
      setModuleStatus((prev: Record<string, boolean>) => ({
        ...prev,
        [moduleName]: newStatus
      }));
      
      // Forçar atualização da sidebar e outros componentes
      window.dispatchEvent(new CustomEvent('moduleStatusChanged', { 
        detail: { moduleName, active: newStatus } 
      }));
      
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar módulo",
        description: "Ocorreu um erro ao alterar o status do módulo",
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
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5" />
            Gerenciamento de Módulos
          </CardTitle>
          <CardDescription className="text-sm">
            Ative ou desative módulos específicos para este tenant
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {modules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>Nenhum módulo disponível no momento</p>
            </div>
          ) : (
            <div className="space-y-3">
              {modules.map((module) => (
                <div key={module.name} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4">
                  <div className="flex-1 space-y-1 min-w-0">
                    <h3 className="font-medium text-sm sm:text-base truncate">{module.displayName}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 overflow-hidden">{module.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-muted px-2 py-1 rounded font-mono">
                        v{module.version}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    <span className="text-xs text-muted-foreground sm:hidden">
                      {moduleStatus[module.name] ? 'Ativo' : 'Inativo'}
                    </span>
                    <Switch
                      checked={moduleStatus[module.name] || false}
                      onCheckedChange={(checked) => toggleModuleStatus(module.name, moduleStatus[module.name] || false)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}