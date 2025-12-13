/**
 * HOOK PARA INICIALIZAÇÃO DO MODULE REGISTRY - FRONTEND PRINCIPAL
 * 
 * Responsável por inicializar o registry e registrar módulos
 * de forma determinística e controlada
 * Agora integrado com o sistema centralizado de módulos
 */

import { useEffect, useState } from 'react';
import { loadAllModules } from '@/lib/module-loader';
import { useModulesManager } from './useModulesManager';

export function useModuleRegistry() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loadModules } = useModulesManager();

  useEffect(() => {
    initializeRegistry();
  }, []);

  const initializeRegistry = async () => {
    try {
      console.log('🔄 Inicializando Module Registry...');
      
      // 1. Carrega módulos do backend usando o sistema centralizado
      await loadModules();
      
      // 2. Inicializa o registry com dados do backend
      const { moduleRegistry } = await import('@/lib/module-registry');
      await moduleRegistry.initializeFromBackend();
      
      // 3. Carrega todos os módulos de forma explícita e determinística
      await loadAllModules();

      setIsInitialized(true);
      console.log('✅ Module Registry inicializado com sucesso');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('❌ Erro ao inicializar Module Registry:', err);
    }
  };

  return {
    isInitialized,
    error,
    reinitialize: initializeRegistry
  };
}