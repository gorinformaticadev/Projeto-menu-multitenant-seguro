/**
 * HOOK SIMPLIFICADO PARA GERENCIAMENTO DE MÓDULOS
 *
 * PRINCÍPIO: Frontend apenas CONSUME dados da API
 * Não gerencia estado complexo, apenas delega para moduleRegistry
 */

import { useState, useCallback, useEffect } from 'react';
import { moduleRegistry } from '@/lib/module-registry';

export interface ModuleData {
  slug: string;
  name?: string;
  description?: string;
  isActive?: boolean;
  enabled?: boolean;
  menus?: any[];
  config?: any;
}

export function useModulesManager() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modules, setModules] = useState<ModuleData[]>([]);

  /**
   * Carrega módulos da API e atualiza estado local
   * IMPORTANTE: NÃO chama automaticamente, deve ser chamado manualmente
   */
  const loadModules = useCallback(async () => {
    if (loading) return;

    try {
      setLoading(true);
      setError(null);

      await moduleRegistry.loadModules();
      
      // Obtém módulos do registry e atualiza estado
      const availableModules = moduleRegistry.getAvailableModules();
      const modulesData = availableModules.map(slug => ({
        slug,
        isActive: true,
        enabled: true,
        menus: moduleRegistry.getModuleMenus(slug),
        config: {} // TODO: buscar config se necessário
      }));
      
      setModules(modulesData);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar módulos';
      setError(errorMessage);
      console.error('❌ Erro ao carregar módulos:', err);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return {
    modules,
    loading,
    error,
    loadModules
  };
}