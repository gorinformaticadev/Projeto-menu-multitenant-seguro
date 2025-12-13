import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { useRequestLimiter } from '@/lib/request-limiter';

export interface ModuleMenu {
  name: string;
  icon: string;
  path?: string;
  permission?: string;
  children?: ModuleMenu[];
}

export interface ModuleConfigResponse {
  displayName: string;
  description: string;
  version: string;
  config: ModuleConfig | null;
}

export interface ModuleConfig {
  menu: ModuleMenu[];
}

/**
 * Hook otimizado para carregar menus de módulos com rate limiting e cache
 */
export function useModuleMenus() {
  const [menus, setMenus] = useState<ModuleMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const limiter = useRequestLimiter('module-menus');
  const mountedRef = useRef(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadModuleMenus = useCallback(async (isFirstLoad = false): Promise<boolean> => {
    try {
      if (isFirstLoad) {
        setLoading(true);
        setError(null);
      }

      // Verificar cache primeiro
      const cachedData = limiter.getCachedData();
      if (cachedData && !isFirstLoad) {
        console.log('🎯 [ModuleMenus] Usando dados do cache');
        if (mountedRef.current) {
          setMenus(cachedData);
        }
        return true;
      }

      // Verificar rate limit
      if (!limiter.canMakeRequest()) {
        console.warn('🚫 [ModuleMenus] Rate limit atingido, usando cache ou dados atuais');
        return false;
      }

      console.log('🔄 [ModuleMenus] Carregando menus dos módulos...');
      const response = await api.get('/tenants/my-tenant/modules/active');
      const modulesData = response.data.modules || [];

      const moduleMenus: ModuleMenu[] = [];

      for (const mod of modulesData) {
        const moduleConfig = mod.config;

        if (moduleConfig) {
          if (moduleConfig.menu) {
            if (Array.isArray(moduleConfig.menu)) {
              moduleMenus.push(...moduleConfig.menu);
            } else if (typeof moduleConfig.menu === 'object') {
              moduleMenus.push(moduleConfig.menu);
            }
          } else if (Array.isArray(moduleConfig)) {
            moduleMenus.push(...moduleConfig);
          }
        }
      }

      // Armazenar no cache
      limiter.setCachedData(moduleMenus);
      limiter.recordSuccess();

      if (mountedRef.current) {
        setMenus(prev => {
          const hasChanged = JSON.stringify(prev) !== JSON.stringify(moduleMenus);
          if (hasChanged) {
            console.log('✅ [ModuleMenus] Menus atualizados');
          }
          return moduleMenus;
        });
        
        if (isFirstLoad) {
          setError(null);
        }
      }

      return true;
    } catch (err: any) {
      console.error('❌ [ModuleMenus] Erro ao carregar menus:', err);
      limiter.recordFailure();

      if (mountedRef.current && isFirstLoad) {
        setError(err.message || 'Falha ao carregar menus dos módulos');
      }

      // Em caso de erro, tentar usar cache mesmo que expirado
      const cachedData = limiter.getCachedData();
      if (cachedData && mountedRef.current) {
        console.log('🔄 [ModuleMenus] Usando cache expirado devido ao erro');
        setMenus(cachedData);
      }

      return false;
    } finally {
      if (mountedRef.current && isFirstLoad) {
        setLoading(false);
      }
    }
  }, [limiter]);

  const refreshMenus = useCallback(() => {
    limiter.clearKey();
    loadModuleMenus(true);
  }, [limiter, loadModuleMenus]);

  useEffect(() => {
    mountedRef.current = true;

    // Carregamento inicial
    loadModuleMenus(true);

    // Polling inteligente - apenas se não houver circuit breaker ativo
    intervalRef.current = setInterval(() => {
      if (mountedRef.current) {
        loadModuleMenus(false);
      }
    }, 30000); // Aumentado para 30 segundos

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loadModuleMenus]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    menus,
    loading,
    error,
    refreshMenus,
    stats: limiter.getStats()
  };
}