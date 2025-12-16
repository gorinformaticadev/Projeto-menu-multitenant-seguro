/**
 * HOOK PARA INICIALIZAÇÃO DO MODULE REGISTRY
 * 
 * Responsável por inicializar o registry e registrar módulos
 * de forma determinística e controlada
 */

import { useEffect, useState } from 'react';
import { registerCoreModule } from '../../../shared/modules/core-module';
import { loadExternalModules } from '../../../shared/modules/module-loader';

export function useModuleRegistry() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeRegistry();
  }, []);

  const initializeRegistry = async () => {
    try {
      // 1. Registra o módulo core (funcionalidades básicas)
      registerCoreModule();

      // 2. Carrega módulos externos de forma explícita e determinística
      await loadExternalModules();

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