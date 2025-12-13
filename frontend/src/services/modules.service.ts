/**
 * SERVIÇO DE MÓDULOS - INTEGRAÇÃO COM BACKEND
 * 
 * Responsável por gerenciar módulos via API do backend
 */

import api from '@/lib/api';

export interface TenantModule {
  name: string;
  displayName: string;
  description: string;
  version: string;
  isActive: boolean;
  config?: any;
}

export interface TenantModulesResponse {
  activeModules: string[];
  modules: TenantModule[];
}

class ModulesService {
  /**
   * Busca módulos ativos do tenant atual
   */
  async getMyTenantActiveModules(): Promise<TenantModulesResponse> {
    try {
      const response = await api.get('/tenants/my-tenant/modules/active');
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao buscar módulos ativos:', error);
      throw error;
    }
  }

  /**
   * Busca módulos de um tenant específico (SUPER_ADMIN apenas)
   */
  async getTenantActiveModules(tenantId: string): Promise<TenantModulesResponse> {
    try {
      const response = await api.get(`/tenants/${tenantId}/modules/active`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erro ao buscar módulos do tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Ativa um módulo para um tenant específico (SUPER_ADMIN apenas)
   */
  async activateModuleForTenant(tenantId: string, moduleName: string): Promise<any> {
    try {
      const response = await api.post(`/tenants/${tenantId}/modules/${moduleName}/activate`);
      console.log(`✅ Módulo ${moduleName} ativado para tenant ${tenantId}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erro ao ativar módulo ${moduleName} para tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Desativa um módulo para um tenant específico (SUPER_ADMIN apenas)
   */
  async deactivateModuleForTenant(tenantId: string, moduleName: string): Promise<any> {
    try {
      const response = await api.post(`/tenants/${tenantId}/modules/${moduleName}/deactivate`);
      console.log(`❌ Módulo ${moduleName} desativado para tenant ${tenantId}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erro ao desativar módulo ${moduleName} para tenant ${tenantId}:`, error);
      throw error;
    }
  }

  /**
   * Configura um módulo para um tenant específico (SUPER_ADMIN apenas)
   */
  async configureTenantModule(tenantId: string, moduleName: string, config: any): Promise<any> {
    try {
      const response = await api.put(`/tenants/${tenantId}/modules/${moduleName}/config`, config);
      console.log(`⚙️ Módulo ${moduleName} configurado para tenant ${tenantId}`);
      return response.data;
    } catch (error) {
      console.error(`❌ Erro ao configurar módulo ${moduleName} para tenant ${tenantId}:`, error);
      throw error;
    }
  }
}

// Exporta instância singleton
export const modulesService = new ModulesService();