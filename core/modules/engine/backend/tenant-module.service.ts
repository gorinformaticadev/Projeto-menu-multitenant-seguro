import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../backend/src/prisma/prisma.service';

@Injectable()
export class TenantModuleService {
  constructor(private prisma: PrismaService) {}

  /**
   * Verifica se um módulo está ativo para um tenant específico
   */
  async isModuleActiveForTenant(moduleName: string, tenantId: string): Promise<boolean> {
    try {
      const tenantModule = await this.prisma.tenantModule.findUnique({
        where: {
          tenantId_moduleName: {
            tenantId,
            moduleName
          }
        }
      });

      return tenantModule?.active ?? false;
    } catch (error) {
      console.error('Erro ao verificar status do módulo:', error);
      return false;
    }
  }

  /**
   * Ativa um módulo para um tenant específico
   */
  async activateModuleForTenant(moduleName: string, tenantId: string): Promise<void> {
    try {
      await this.prisma.tenantModule.upsert({
        where: {
          tenantId_moduleName: {
            tenantId,
            moduleName
          }
        },
        update: {
          active: true
        },
        create: {
          tenantId,
          moduleName,
          active: true
        }
      });
    } catch (error) {
      console.error('Erro ao ativar módulo:', error);
      throw error;
    }
  }

  /**
   * Desativa um módulo para um tenant específico
   */
  async deactivateModuleForTenant(moduleName: string, tenantId: string): Promise<void> {
    try {
      await this.prisma.tenantModule.upsert({
        where: {
          tenantId_moduleName: {
            tenantId,
            moduleName
          }
        },
        update: {
          active: false
        },
        create: {
          tenantId,
          moduleName,
          active: false
        }
      });
    } catch (error) {
      console.error('Erro ao desativar módulo:', error);
      throw error;
    }
  }

  /**
   * Retorna todos os módulos ativos para um tenant específico
   */
  async getActiveModulesForTenant(tenantId: string): Promise<string[]> {
    try {
      const tenantModules = await this.prisma.tenantModule.findMany({
        where: {
          tenantId,
          active: true
        },
        select: {
          moduleName: true
        }
      });

      return tenantModules.map(tm => tm.moduleName);
    } catch (error) {
      console.error('Erro ao obter módulos ativos:', error);
      return [];
    }
  }
}