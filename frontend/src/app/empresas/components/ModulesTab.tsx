"use client";

import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Package, Loader2 } from "lucide-react";
import { useModulesManager } from "@/hooks/useModulesManager";

export function ModulesTab({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { modules, loading, error, loadModules, toggleModule, isToggling } = useModulesManager();

  useEffect(() => {
    // Carrega módulos ao montar o componente
    const targetTenantId = user?.tenantId === tenantId ? undefined : tenantId;
    loadModules(targetTenantId);
  }, [tenantId, user?.tenantId, loadModules]);

  // Mostra toast de erro se houver
  useEffect(() => {
    if (error) {
      toast({
        title: "Erro ao carregar módulos",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const handleToggleModule = async (moduleName: string, currentStatus: boolean) => {
    // Verifica se já está processando este módulo
    if (isToggling(moduleName)) {
      return;
    }

    try {
      const targetTenantId = user?.tenantId === tenantId ? undefined : tenantId;
      await toggleModule(moduleName, targetTenantId);
      
      const newStatus = !currentStatus;
      toast({
        title: newStatus ? "Módulo ativado" : "Módulo desativado",
        description: `O módulo ${moduleName} foi ${newStatus ? 'ativado' : 'desativado'} com sucesso.`,
      });
      
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar módulo",
        description: error.message || "Ocorreu um erro ao alterar o status do módulo",
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
                      {module.isActive && module.activatedAt && (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          Ativo desde {new Date(module.activatedAt).toLocaleDateString()}
                        </span>
                      )}
                      {!module.isActive && module.deactivatedAt && (
                        <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                          Desativado em {new Date(module.deactivatedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    <span className="text-xs text-muted-foreground sm:hidden">
                      {module.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                    <div className="flex items-center gap-2">
                      {isToggling(module.name) && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      <Switch
                        checked={module.isActive}
                        disabled={isToggling(module.name)}
                        onCheckedChange={() => handleToggleModule(module.name, module.isActive)}
                      />
                    </div>
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