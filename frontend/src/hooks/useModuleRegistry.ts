/**
 * HOOK PARA INICIALIZAÇÃO DO MODULE REGISTRY - FRONTEND PRINCIPAL
 *
 * Responsável por inicializar o registry consumindo dados da API
 * PRINCÍPIO: Frontend NUNCA define módulos, apenas CONSUME da API
 * 
 * IMPORTANTE: Só carrega módulos APÓS autenticação
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { moduleRegistry } from '@/lib/module-registry';

export function useModuleRegistry() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    // Só inicializa se o usuário estiver autenticado
    if (user) {
      initializeRegistry();
    } else {
      // Se não houver usuário, marca como não inicializado
      setIsInitialized(false);
      setError(null);
    }
  }, [user]); // Reexecuta quando o estado de autenticação mudar

  const initializeRegistry = async () => {
    try {
      console.log('🔄 Inicializando Module Registry...');

      // Carrega módulos da API /api/me/modules
      await moduleRegistry.loadModules();

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