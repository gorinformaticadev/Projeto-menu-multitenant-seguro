/**
 * HOOK PARA INICIALIZAÇÃO DO MODULE REGISTRY
 * 
 * Responsável por carregar módulos da API de forma controlada
 */

import { useEffect, useState } from 'react';
import { moduleRegistry } from '@/lib/module-registry';

export function useModuleRegistry() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeRegistry();
  }, []);

  const initializeRegistry = async () => {
    try {
      // Carrega módulos da API
      await moduleRegistry.loadModules();

      setIsInitialized(true);
      console.log('Module Registry inicializado com sucesso');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('Erro ao inicializar Module Registry:', err);
    }
  };

  return {
    isInitialized,
    error,
    reinitialize: initializeRegistry
  };
}