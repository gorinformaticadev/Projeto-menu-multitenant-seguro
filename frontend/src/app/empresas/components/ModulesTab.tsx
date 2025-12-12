"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import api from "@/lib/api";
import { Package } from "lucide-react";

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
      
      // Obter lista de módulos disponíveis
      const modulesResponse = await api.get("/modules");
      const moduleNames = modulesResponse.data;
      
      // Obter configuração de cada módulo
      const moduleConfigs = await Promise.all(
        moduleNames.map(async (moduleName: string) => {
          const configResponse = await api.get(`/modules/${moduleName}/config`);
          return {
            name: moduleName,
            ...configResponse.data
          };
        })
      );
      
      setModules(moduleConfigs);
      
      // Obter status dos módulos para este tenant
      const statusResponse = await api.get(`/tenants/${tenantId}/modules/active`);
      const statusMap: Record<string, boolean> = {};
      statusResponse.data.activeModules.forEach((moduleName: string) => {
        statusMap[moduleName] = true;
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
      if (currentStatus) {
        // Desativar módulo
        await api.post(`/tenants/${tenantId}/modules/${moduleName}/deactivate`);
        toast({
          title: "Módulo desativado",
          description: `O módulo ${moduleName} foi desativado para este tenant.`,
        });
      } else {
        // Ativar módulo
        await api.post(`/tenants/${tenantId}/modules/${moduleName}/activate`);
        toast({
          title: "Módulo ativado",
          description: `O módulo ${moduleName} foi ativado para este tenant.`,
        });
      }
      
      // Atualizar status local
      setModuleStatus((prev: Record<string, boolean>) => ({
        ...prev,
        [moduleName]: !currentStatus
      }));
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar módulo",
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