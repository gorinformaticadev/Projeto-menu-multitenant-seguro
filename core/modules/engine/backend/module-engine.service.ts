import { Injectable, OnModuleInit } from '@nestjs/common';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';

@Injectable()
export class ModuleEngineService implements OnModuleInit {
  private modules: Map<string, any> = new Map();
  private moduleConfigs: Map<string, any> = new Map();

  async onModuleInit() {
    await this.discoverModules();
  }

  /**
   * Descobre e carrega todos os módulos disponíveis
   */
  private async discoverModules() {
    const modulesPath = join(process.cwd(), '..', '..', 'modules');
    
    if (!existsSync(modulesPath)) {
      console.log('Nenhum diretório de módulos encontrado');
      return;
    }

    const moduleDirs = readdirSync(modulesPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const moduleName of moduleDirs) {
      try {
        const modulePath = join(modulesPath, moduleName);
        const configPath = join(modulePath, 'module.config.json');
        
        // Carregar configuração do módulo
        if (existsSync(configPath)) {
          const config = require(configPath);
          this.moduleConfigs.set(moduleName, config);
        }

        // Carregar módulo backend se existir
        const backendIndexPath = join(modulePath, 'backend', 'index.ts');
        if (existsSync(backendIndexPath)) {
          const module = await import(backendIndexPath);
          this.modules.set(moduleName, module);
          console.log(`Módulo carregado: ${moduleName}`);
        }
      } catch (error) {
        console.error(`Erro ao carregar módulo ${moduleName}:`, error);
      }
    }
  }

  /**
   * Retorna lista de módulos disponíveis
   */
  getAvailableModules() {
    return Array.from(this.moduleConfigs.keys());
  }

  /**
   * Retorna configuração de um módulo específico
   */
  getModuleConfig(moduleName: string) {
    return this.moduleConfigs.get(moduleName);
  }

  /**
   * Verifica se um módulo está ativo para um tenant específico
   */
  async isModuleActiveForTenant(moduleName: string, tenantId: string): Promise<boolean> {
    // Esta implementação seria expandida para consultar o banco de dados
    // e verificar se o módulo está ativo para o tenant específico
    try {
      // Importar Prisma dinamicamente
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      
      const tenantModule = await prisma.tenantModule.findUnique({
        where: {
          tenantId_moduleName: {
            tenantId,
            moduleName
          }
        }
      });
      
      await prisma.$disconnect();
      
      return tenantModule?.active ?? false;
    } catch (error) {
      console.error('Erro ao verificar status do módulo:', error);
      return false;
    }
  }
}