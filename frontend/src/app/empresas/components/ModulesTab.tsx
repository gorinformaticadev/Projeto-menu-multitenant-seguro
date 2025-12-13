"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Package } from "lucide-react";
import { moduleRegistry } from "@/lib/module-registry";
import { modulesService, TenantModule } from "@/services/modules.service";

export function ModulesTab({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [modules, setModules] = useState<TenantModule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Debounce para evitar múltiplas chamadas
    const timeoutId = setTimeout(() => {
      loadModules();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [tenantId]);

  const loadModules = async () => {
    try {
      setLoading(true);
      
      let response;
      
      // Se for o próprio tenant do usuário, usa endpoint específico
      if (user?.tenantId === tenantId) {
        response = await modulesService.getMyTenantActiveModules();
      } else {
        // Se for SUPER_ADMIN gerenciando outro tenant
        response = await modulesService.getTenantActiveModules(tenantId);
      }
      
      setModules(response.modules);
      
      console.log('📦 Módulos carregados do backend:', response.modules);
      console.log('✅ Módulos ativos:', response.activeModules);
      
    } catch (error: any) {
      console.error('❌ Erro ao carregar módulos:', error);
      toast({
        title: "Erro ao carregar módulos",
        description: error.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
      
      // Em caso de erro, carrega módulos padrão
      setModules([
        {
          name: 'module-exemplo',
          displayName: 'Module Exemplo',
          description: 'Módulo de exemplo para demonstração do sistema modular',
          version: '1.0.0',
          isActive: false
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleModuleStatus = async (moduleName: string, currentStatus: boolean) => {
    try {
      // Usar o novo método toggle que alterna automaticamente o status
      const result = await modulesService.toggleModuleForTenant(tenantId, moduleName);
      
      const newStatus = result.isActive;
      
      // Atualizar registry local (apenas se for o próprio tenant)
      if (user?.tenantId === tenantId) {
        if (newStatus) {
          moduleRegistry.activateModule(moduleName);
        } else {
          moduleRegistry.deactivateModule(moduleName);
        }
      }
      
      toast({
        title: newStatus ? "Módulo ativado" : "Módulo desativado",
        description: `O módulo ${moduleName} foi ${newStatus ? 'ativado' : 'desativado'} com sucesso.`,
      });
      
      // Atualizar lista de módulos
      await loadModules();
      
      // Forçar atualização da sidebar e outros componentes (apenas se for o próprio tenant)
      if (user?.tenantId === tenantId) {
        window.dispatchEvent(new CustomEvent('moduleStatusChanged', { 
          detail: { moduleName, active: newStatus } 
        }));
      }
      
    } catch (error: any) {
      console.error('❌ Erro ao alterar status do módulo:', error);
      toast({
        title: "Erro ao atualizar módulo",
        description: error.response?.data?.message || "Ocorreu um erro ao alterar o status do módulo",
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
                      {module.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                    <Switch
                      checked={module.isActive}
                      onCheckedChange={(checked) => toggleModuleStatus(module.name, module.isActive)}
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