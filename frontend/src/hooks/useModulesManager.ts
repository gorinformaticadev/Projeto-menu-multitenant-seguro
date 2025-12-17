/**
 * HOOK SIMPLIFICADO PARA GERENCIAMENTO DE MÓDULOS
 *
 * PRINCÍPIO: Frontend apenas CONSUME dados da API
 * Não gerencia estado complexo, apenas delega para moduleRegistry
 */

import { useState, useCallback } from 'react';
import { moduleRegistry } from '@/lib/module-registry';

export function useModulesManager() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Carrega módulos da API
   */
  const loadModules = useCallback(async () => {
    if (loading) return;

    try {
      setLoading(true);
      setError(null);

      await moduleRegistry.loadModules();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar módulos';
      setError(errorMessage);
      console.error('❌ Erro ao carregar módulos:', err);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return {
    loading,
    error,
    loadModules
  };
}