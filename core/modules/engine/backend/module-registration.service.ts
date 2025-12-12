import { Injectable } from '@nestjs/common';
import { ModuleEngineService } from './module-engine.service';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

@Injectable()
export class ModuleRegistrationService {
  constructor(private readonly moduleEngineService: ModuleEngineService) {}

  /**
   * Registra automaticamente todos os módulos encontrados
   */
  async registerAllModules() {
    const modulesPath = join(process.cwd(), '..', '..', 'modules');
    
    if (!existsSync(modulesPath)) {
      console.log('Nenhum diretório de módulos encontrado para registro');
      return;
    }

    const moduleDirs = readdirSync(modulesPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const moduleName of moduleDirs) {
      try {
        await this.registerModule(moduleName);
      } catch (error) {
        console.error(`Erro ao registrar módulo ${moduleName}:`, error);
      }
    }
  }

  /**
   * Registra um módulo específico
   */
  private async registerModule(moduleName: string) {
    const modulePath = join(process.cwd(), '..', '..', 'modules', moduleName);
    const configPath = join(modulePath, 'module.config.json');
    
    if (!existsSync(configPath)) {
      console.warn(`Configuração não encontrada para o módulo ${moduleName}`);
      return;
    }

    // Ler configuração do módulo
    const configBuffer = readFileSync(configPath);
    const config = JSON.parse(configBuffer.toString());

    // Registrar rotas, permissões, etc.
    console.log(`Módulo registrado: ${moduleName}`, config);
    
    // Aqui poderíamos adicionar lógica para:
    // - Registrar rotas da API
    // - Registrar permissões
    // - Executar migrações do Prisma específicas do módulo
    // - Registrar listeners de eventos
  }
}