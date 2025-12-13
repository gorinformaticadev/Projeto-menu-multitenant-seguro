import { useState, useEffect } from 'react';
import api from '@/lib/api';

export interface ModuleMenu {
  name: string;
  icon: string;
  path: string;
  permission: string;
}

// Interface para a resposta do endpoint /modules/:name/config
export interface ModuleConfigResponse {
  displayName: string;
  description: string;
  version: string;
  config: ModuleConfig | null;
}

// Interface para o conteúdo do campo config
export interface ModuleConfig {
  menu: ModuleMenu[];
  // Outras propriedades podem ser adicionadas conforme necessário
}

/**
 * React hook para carregar menus de módulos
 */
export function useModuleMenus() {
  const [menus, setMenus] = useState<ModuleMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadModuleMenus = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('=== INICIANDO CARREGAMENTO DE MENUS DE MÓDULOS ===');

        // Obter módulos ativos do tenant atual
        console.log('Buscando módulos ativos do tenant...');
        const response = await api.get('/tenants/my-tenant/modules/active');
        console.log('🔍 [DEBUG] Module Menus Response:', response.data);
        console.log('Resposta do endpoint /tenants/my-tenant/modules/active:', response.data);

        const modulesData = response.data.modules || [];

        // Coletar menus dos módulos retornados
        const moduleMenus: ModuleMenu[] = [];

        for (const mod of modulesData) {
          // A configuração já vem resolvida do backend (com fallback para config do módulo)
          const moduleConfig = mod.config;

          // Adicionar menus do módulo se existirem
          // Suporta tanto array direto (novo) quanto objeto com propriedade menu
          if (moduleConfig) {
            if (moduleConfig.menu) {
              if (Array.isArray(moduleConfig.menu)) {
                console.log(`Menus (Array) encontrados no módulo ${mod.name}:`, moduleConfig.menu);
                moduleMenus.push(...moduleConfig.menu);
              } else if (typeof moduleConfig.menu === 'object') {
                // Suporte a objeto único de menu
                console.log(`Menu (Objeto) encontrado no módulo ${mod.name}:`, moduleConfig.menu);
                moduleMenus.push(moduleConfig.menu);
              }
            } else if (Array.isArray(moduleConfig)) {
              // Caso a config seja o próprio array de menu (legado)
              moduleMenus.push(...moduleConfig);
            }
          }
        }

        console.log('Menus finais coletados:', moduleMenus);

        if (mounted) {
          setMenus(moduleMenus);
        }
      } catch (err: any) {
        console.error('Erro geral no carregamento de menus:', err);
        if (mounted) {
          setError(err.message || 'Failed to load module menus');
          setMenus([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadModuleMenus();

    return () => {
      mounted = false;
    };
  }, []);

  return {
    menus,
    loading,
    error,
    refreshMenus: () => {
      // Forçar recarregamento
      setMenus([]);
      setLoading(true);
      setError(null);

      // Re-executar o efeito
      setTimeout(() => {
        window.location.reload();
      }, 100);
    }
  };
}