"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';

interface ModuleConfig {
  name: string;
  displayName: string;
  description: string;
  version: string;
  active: boolean;
}

export function ModuleManagement() {
  const { user } = useAuth();
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      loadAvailableModules();
    }
  }, [user]);

  const loadAvailableModules = async () => {
    try {
      setLoading(true);
      // Obter lista de módulos disponíveis
      const response = await api.get('/modules');
      const moduleNames = response.data;
      
      // Obter configuração de cada módulo
      const moduleConfigs = await Promise.all(
        moduleNames.map(async (moduleName: string) => {
          const configResponse = await api.get(`/modules/${moduleName}/config`);
          return {
            name: moduleName,
            ...configResponse.data
          };
        })
      );
      
      setModules(moduleConfigs);
    } catch (error) {
      console.error('Erro ao carregar módulos:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleModuleStatus = async (moduleName: string, currentStatus: boolean) => {
    if (!selectedTenantId) return;
    
    try {
      // Atualizar status do módulo para o tenant selecionado
      await api.post(`/tenants/${selectedTenantId}/modules/${moduleName}/${currentStatus ? 'deactivate' : 'activate'}`);
      
      // Recarregar lista de módulos
      loadAvailableModules();
    } catch (error) {
      console.error('Erro ao atualizar status do módulo:', error);
    }
  };

  if (user?.role !== 'SUPER_ADMIN') {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Gerenciamento de Módulos</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <div key={module.name} className="border rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{module.displayName}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {module.description}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs bg-muted px-2 py-1 rounded">
                      v{module.version}
                    </span>
                  </div>
                </div>
                <div className="flex items-center">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={module.active}
                      onChange={() => toggleModuleStatus(module.name, module.active)}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}