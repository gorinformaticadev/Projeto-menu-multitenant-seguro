/**
 * HOOK CENTRALIZADO PARA GERENCIAMENTO DE MÓDULOS
 * 
 * Responsável por:
 * - Carregar módulos uma única vez
 * - Gerenciar estado global dos módulos
 * - Controlar operações de toggle com lock
 * - Evitar requisições duplicadas
 */

import React, { useState, useCallback, useRef } from 'react';
import { modulesService, TenantModule } from '@/services/modules.service';
import { moduleRegistry } from '@/lib/module-registry';

interface ModulesState {
  modules: TenantModule[];
  loading: boolean;
  error: string | null;
  lastUpdated: number;
}

interface ToggleState {
  [moduleName: string]: boolean;
}

// Estado global compartilhado entre todas as instâncias
let globalState: ModulesState = {
  modules: [],
  loading: false,
  error: null,
  lastUpdated: 0
};

// Controle de concorrência
let loadingPromise: Promise<void> | null = null;
const toggleLocks: ToggleState = {};

// Cache de requisições para evitar duplicatas
const requestCache = new Map<string, Promise<any>>();
const REQUEST_CACHE_TTL = 5000; // 5 segundos

// Listeners para notificar mudanças
const listeners = new Set<() => void>();

export function useModulesManager(tenantId?: string) {
  const [state, setState] = useState<ModulesState>(globalState);
  const listenerRef = useRef<() => void>();

  // Registra listener para atualizações
  const updateState = useCallback(() => {
    setState({ ...globalState });
  }, []);

  // Registra/desregistra listener
  React.useEffect(() => {
    listenerRef.current = updateState;
    listeners.add(updateState);

    return () => {
      if (listenerRef.current) {
        listeners.delete(listenerRef.current);
      }
    };
  }, []); // Remove updateState da dependência para evitar loops

  // Notifica todos os listeners
  const notifyListeners = useCallback(() => {
    listeners.forEach(listener => listener());
  }, []);

  // Atualiza estado global e notifica listeners
  const updateGlobalState = useCallback((newState: Partial<ModulesState>) => {
    globalState = { ...globalState, ...newState };
    notifyListeners();
  }, []); // Remove notifyListeners da dependência para evitar loops

  /**
   * Carrega módulos do backend (apenas uma vez por sessão)
   */
  const loadModules = useCallback(async (targetTenantId?: string, forceReload = false) => {
    const now = Date.now();
    const CACHE_DURATION = 30000; // 30 segundos

    // Se já tem dados válidos e não é reload forçado, retorna
    if (!forceReload && globalState.modules.length > 0 && (now - globalState.lastUpdated) < CACHE_DURATION) {
      return;
    }

    // Se já está carregando, aguarda a promise existente
    if (loadingPromise) {
      return loadingPromise;
    }

    // Cria nova promise de carregamento
    loadingPromise = performLoad(targetTenantId);

    try {
      await loadingPromise;
    } finally {
      loadingPromise = null;
    }
  }, []); // Remove updateGlobalState da dependência

  /**
   * Executa o carregamento real
   */
  const performLoad = async (targetTenantId?: string) => {
    try {
      globalState = { ...globalState, loading: true, error: null };
      notifyListeners();

      let response;
      if (targetTenantId) {
        response = await modulesService.getTenantActiveModules(targetTenantId);
      } else {
        response = await modulesService.getMyTenantActiveModules();
      }

      globalState = {
        ...globalState,
        modules: response.modules,
        loading: false,
        lastUpdated: Date.now()
      };
      notifyListeners();

      console.log('📦 Módulos carregados:', response.modules.length);

    } catch (error: any) {
      console.error('❌ Erro ao carregar módulos:', error);

      globalState = {
        ...globalState,
        error: error.response?.data?.message || 'Erro ao carregar módulos',
        loading: false,
        // Em caso de erro, mantém módulos existentes ou usa fallback
        modules: globalState.modules.length > 0 ? globalState.modules : [{
          name: 'module-exemplo',
          displayName: 'Module Exemplo',
          description: 'Módulo de exemplo para demonstração do sistema modular',
          version: '1.0.0',
          isActive: false,
          activatedAt: null,
          deactivatedAt: null
        }],
        lastUpdated: Date.now() // Atualiza timestamp para evitar loop de retentativas imediatas
      };
      notifyListeners();
    }
  };

  /**
   * Toggle de módulo com controle de concorrência e optimistic update
   */
  const toggleModule = useCallback(async (moduleName: string, targetTenantId?: string) => {
    console.log(`🔄 [TOGGLE] Iniciando toggle para módulo: ${moduleName}, tenant: ${targetTenantId || 'my-tenant'}`);

    // Verifica se já existe uma operação em andamento para este módulo
    if (toggleLocks[moduleName]) {
      console.warn(`⚠️ [TOGGLE] Toggle já em andamento para módulo ${moduleName} - IGNORANDO`);
      return;
    }

    // Encontra o módulo atual
    const currentModule = globalState.modules.find(m => m.name === moduleName);
    if (!currentModule) {
      console.error(`❌ Módulo ${moduleName} não encontrado`);
      return;
    }

    // Ativa lock
    toggleLocks[moduleName] = true;
    console.log(`🔒 [TOGGLE] Lock ativado para módulo: ${moduleName}`);

    // Optimistic update - atualiza UI imediatamente
    const newStatus = !currentModule.isActive;
    const updatedModules = globalState.modules.map(module =>
      module.name === moduleName
        ? {
          ...module,
          isActive: newStatus,
          activatedAt: newStatus ? new Date().toISOString() : module.activatedAt,
          deactivatedAt: newStatus ? null : new Date().toISOString()
        }
        : module
    );

    globalState = { ...globalState, modules: updatedModules };
    notifyListeners();

    // Atualiza registry local imediatamente
    if (newStatus) {
      moduleRegistry.activateModule(moduleName);
    } else {
      moduleRegistry.deactivateModule(moduleName);
    }

    try {
      // Cria chave única para a requisição
      const requestKey = `toggle-${targetTenantId || 'my-tenant'}-${moduleName}`;

      // Verifica se já existe uma requisição idêntica em cache
      if (requestCache.has(requestKey)) {
        console.log(`📋 [TOGGLE] Usando requisição em cache para: ${moduleName}`);
        const result = await requestCache.get(requestKey);
        return result;
      }

      // Executa toggle no backend
      console.log(`📡 [TOGGLE] Enviando requisição para backend: ${moduleName}`);
      let requestPromise;

      if (targetTenantId) {
        console.log(`📡 [TOGGLE] Usando toggleModuleForTenant para tenant: ${targetTenantId}`);
        requestPromise = modulesService.toggleModuleForTenant(targetTenantId, moduleName);
      } else {
        console.log(`📡 [TOGGLE] Usando toggleMyTenantModule`);
        requestPromise = modulesService.toggleMyTenantModule(moduleName);
      }

      // Adiciona ao cache
      requestCache.set(requestKey, requestPromise);

      // Remove do cache após TTL
      setTimeout(() => {
        requestCache.delete(requestKey);
      }, REQUEST_CACHE_TTL);

      const result = await requestPromise;

      // Confirma o resultado do backend (pode ser diferente do optimistic)
      const confirmedModules = globalState.modules.map(module =>
        module.name === moduleName
          ? {
            ...module,
            isActive: result.isActive,
            activatedAt: result.activatedAt,
            deactivatedAt: result.deactivatedAt
          }
          : module
      );

      globalState = { ...globalState, modules: confirmedModules };
      notifyListeners();

      // Dispara evento para outros componentes
      window.dispatchEvent(new CustomEvent('moduleStatusChanged', {
        detail: { moduleName, active: result.isActive }
      }));

      console.log(`✅ Toggle concluído: ${moduleName} -> ${result.isActive ? 'ativo' : 'inativo'}`);

    } catch (error: any) {
      console.error(`❌ Erro no toggle de ${moduleName}:`, error);

      // Reverte optimistic update em caso de erro
      const revertedModules = globalState.modules.map(module =>
        module.name === moduleName
          ? currentModule // Volta ao estado original
          : module
      );

      globalState = {
        ...globalState,
        modules: revertedModules,
        error: error.response?.data?.message || 'Erro ao alterar status do módulo'
      };
      notifyListeners();

      // Reverte registry
      if (currentModule.isActive) {
        moduleRegistry.activateModule(moduleName);
      } else {
        moduleRegistry.deactivateModule(moduleName);
      }

    } finally {
      // Remove lock
      delete toggleLocks[moduleName];
      console.log(`🔓 [TOGGLE] Lock removido para módulo: ${moduleName}`);
    }
  }, []); // Remove updateGlobalState da dependência

  /**
   * Verifica se um módulo está sendo processado
   */
  const isToggling = useCallback((moduleName: string) => {
    return !!toggleLocks[moduleName];
  }, []);

  /**
   * Limpa cache e força reload
   */
  const refresh = useCallback(async (targetTenantId?: string) => {
    await loadModules(targetTenantId, true);
  }, []); // Remove loadModules da dependência

  return {
    modules: state.modules,
    loading: state.loading,
    error: state.error,
    loadModules,
    toggleModule,
    isToggling,
    refresh
  };
}