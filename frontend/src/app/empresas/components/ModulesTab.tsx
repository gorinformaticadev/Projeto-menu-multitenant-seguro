"use client";

import { useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Package, Loader2 } from "lucide-react";
import { useModulesManager } from "@/hooks/useModulesManager";

export function ModulesTab({ tenantId }: { tenantId: string }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { modules, loading, error, loadModules } = useModulesManager();
  
  // Debounce para evitar cliques múltiplos
  const lastClickTime = useRef<{ [key: string]: number }>({});
  const DEBOUNCE_DELAY = 1000; // 1 segundo
  
  // Flag para evitar múltiplas chamadas
  const hasLoadedRef = useRef(false);
  const currentTenantRef = useRef<string | null>(null);

  useEffect(() => {
    // Evita carregar múltiplas vezes para o mesmo tenant
    if (hasLoadedRef.current && currentTenantRef.current === tenantId) {
      console.log('⏭️ [MODULES_TAB] Módulos já carregados para este tenant, pulando...');
      return;
    }
    
    // Marca como carregado para este tenant
    hasLoadedRef.current = true;
    currentTenantRef.current = tenantId;
    
    console.log('📦 [MODULES_TAB] Carregando módulos para tenant:', tenantId);
    // useModulesManager não aceita parâmetros, usa /me/modules sempre
    loadModules();
  }, [tenantId, loadModules]);

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

  const handleToggleModule = useCallback(async (moduleName: string, currentStatus: boolean) => {
    const now = Date.now();
    const lastClick = lastClickTime.current[moduleName] || 0;
    
    console.log(`🖱️ [MODULES_TAB] Clique no toggle: ${moduleName}, status atual: ${currentStatus}, tempo desde último clique: ${now - lastClick}ms`);
    
    // Debounce - ignora cliques muito rápidos
    if (now - lastClick < DEBOUNCE_DELAY) {
      console.warn(`⚠️ [MODULES_TAB] Clique muito rápido em ${moduleName} - IGNORANDO (debounce)`);
      return;
    }

    // Atualiza timestamp do último clique
    lastClickTime.current[moduleName] = now;

    try {
      toast({
        title: "Funcionalidade em desenvolvimento",
        description: "O gerenciamento de módulos está em desenvolvimento.",
        variant: "default",
      });
      
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar módulo",
        description: error.message || "Ocorreu um erro ao alterar o status do módulo",
        variant: "destructive",
      });
    }
  }, [toast]);

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
                    <h3 className="font-medium text-sm sm:text-base truncate">{module.name || module.slug}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 overflow-hidden">{module.description || 'Sem descrição'}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-muted px-2 py-1 rounded font-mono">
                        {module.slug}
                      </span>
                      {module.isActive && (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          Ativo
                        </span>
                      )}
                      {!module.isActive && (
                        <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                          Inativo
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-2">
                    <span className="text-xs text-muted-foreground sm:hidden">
                      {module.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={module.isActive}
                        disabled={true}
                        onCheckedChange={(checked) => {
                          console.log(`🔄 [SWITCH] onCheckedChange disparado: ${module.name}, checked: ${checked}`);
                          handleToggleModule(module.name || module.slug, module.isActive || false);
                        }}
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