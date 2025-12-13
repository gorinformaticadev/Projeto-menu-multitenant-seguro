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
        console.log('Resposta do endpoint /tenants/my-tenant/modules/active:', response.data);
        
        const tenantModulesData = response.data;
        const activeModules: string[] = tenantModulesData.activeModules;
        
        console.log('Módulos ativos encontrados:', activeModules);
        
        // Carregar configuração de cada módulo ativo
        const moduleMenus: ModuleMenu[] = [];
        
        for (const moduleName of activeModules) {
          try {
            console.log(`Carregando configuração do módulo: ${moduleName}`);
            const configResponse = await api.get(`/modules/${moduleName}/config`);
            console.log(`Configuração do módulo ${moduleName}:`, configResponse.data);
            
            // A resposta do endpoint tem uma estrutura específica
            const moduleConfigResponse: ModuleConfigResponse = configResponse.data;
            const moduleConfig = moduleConfigResponse.config;
            
            // Adicionar menus do módulo se existirem
            if (moduleConfig && moduleConfig.menu && Array.isArray(moduleConfig.menu)) {
              console.log(`Menus encontrados no módulo ${moduleName}:`, moduleConfig.menu);
              moduleMenus.push(...moduleConfig.menu);
            } else {
              console.log(`Nenhum menu encontrado no módulo ${moduleName}`);
            }
          } catch (err: any) {
            console.warn(`Failed to load config for module ${moduleName}:`, err);
            // Continuar com os próximos módulos mesmo se um falhar
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