"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Package } from "lucide-react";
import api from "@/lib/api";
import { modulesService } from "@/services/modules.service";

interface SystemModule {
  slug: string;
  name: string;
  version: string;
  description: string | null;
  status: 'detected' | 'installed' | 'db_ready' | 'active' | 'disabled';
  hasBackend: boolean;
  hasFrontend: boolean;
  installedAt: string;
  activatedAt: string | null;
}

interface TenantModuleStatus {
  slug: string;
  enabled: boolean;
}

export function ModulesTab({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const [systemModules, setSystemModules] = useState<SystemModule[]>([]);
  const [tenantModules, setTenantModules] = useState<TenantModuleStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // Debounce para evitar cliques múltiplos
  const lastClickTime = useRef<{ [key: string]: number }>({});
  const DEBOUNCE_DELAY = 1000; // 1 segundo

  const loadModulesData = useCallback(async () => {
    try {
      setLoading(true);

      // Buscar módulos do sistema
      const systemModulesResponse = await api.get('/configuracoes/sistema/modulos');
      setSystemModules(systemModulesResponse.data);

      // Buscar módulos habilitados para o tenant
      const tenantModulesResponse = await api.get(`/tenants/${tenantId}/modules/active`);
      const enabledModules = tenantModulesResponse.data.modules || [];

      // Mapear para formato de status
      const tenantStatus: TenantModuleStatus[] = systemModulesResponse.data.map((mod: SystemModule) => ({
        slug: mod.slug,
        enabled: enabledModules.some((tm: { name: string; isActive: boolean }) => tm.name === mod.slug && tm.isActive)
      }));

      setTenantModules(tenantStatus);

    } catch (error: unknown) {
      console.error('Erro ao carregar módulos:', error);
      toast({
        title: "Erro ao carregar módulos",
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Ocorreu um erro no servidor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [tenantId, toast]);

  useEffect(() => {
    loadModulesData();
  }, [loadModulesData]);

  const handleToggleModule = useCallback(async (moduleSlug: string, currentStatus: boolean) => {
    const now = Date.now();
    const lastClick = lastClickTime.current[moduleSlug] || 0;

    // Debounce - ignora cliques muito rápidos
    if (now - lastClick < DEBOUNCE_DELAY) {
      console.warn(`⚠️ [MODULES_TAB] Clique muito rápido em ${moduleSlug} - IGNORANDO (debounce)`);
      return;
    }

    // Atualiza timestamp do último clique
    lastClickTime.current[moduleSlug] = now;

    try {
      // Optimistic update
      setTenantModules(prev => prev.map(tm =>
        tm.slug === moduleSlug ? { ...tm, enabled: !currentStatus } : tm
      ));

      // Chamar API de toggle
      if (currentStatus) {
        await modulesService.deactivateModuleForTenant(tenantId, moduleSlug);
        toast({
          title: "Módulo desativado",
          description: `O módulo foi desativado para este tenant.`,
        });
      } else {
        await modulesService.activateModuleForTenant(tenantId, moduleSlug);
        toast({
          title: "Módulo ativado",
          description: `O módulo foi ativado para este tenant.`,
        });
      }

      // Recarregar dados para confirmar
      await loadModulesData();

    } catch (error: unknown) {
      // Reverter optimistic update em caso de erro
      setTenantModules(prev => prev.map(tm =>
        tm.slug === moduleSlug ? { ...tm, enabled: currentStatus } : tm
      ));

      toast({
        title: "Erro ao atualizar módulo",
        description: (error as { response?: { data?: { message?: string } } })?.response?.data?.message || "Ocorreu um erro ao alterar o status do módulo",
        variant: "destructive",
      });
    }
  }, [toast, tenantId, loadModulesData]);

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
          {systemModules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p>Nenhum módulo disponível no momento</p>
            </div>
          ) : (
            <div className="space-y-3">
              {systemModules.map((module) => {
                const tenantStatus = tenantModules.find(tm => tm.slug === module.slug);
                const isEnabled = tenantStatus?.enabled || false;
                const canToggle = module.status === 'active';

                return (
                  <div key={module.slug} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg gap-4">
                    <div className="flex-1 space-y-1 min-w-0">
                      <h3 className="font-medium text-sm sm:text-base truncate">{module.name}</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 overflow-hidden">
                        {module.description || 'Sem descrição'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs bg-muted px-2 py-1 rounded font-mono">
                          v{module.version}
                        </span>
                        {module.status === 'active' && (
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                            Sistema: Ativo
                          </span>
                        )}
                        {module.status !== 'active' && (
                          <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">
                            Sistema: {module.status}
                          </span>
                        )}
                        {isEnabled && (
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            Tenant: Ativo
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-2">
                      <div className="flex flex-col items-end gap-1">
                        <Switch
                          checked={isEnabled}
                          disabled={!canToggle}
                          onCheckedChange={(checked: boolean) => {
                            handleToggleModule(module.slug, isEnabled);
                          }}
                        />
                        {!canToggle && (
                          <span className="text-xs text-muted-foreground">
                            Módulo não ativo
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}