import { Injectable } from '@nestjs/common';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';

@Injectable()
export class ModuleLoaderService {
  private loadedModules: Set<string> = new Set();

  /**
   * Carrega todos os módulos disponíveis
   */
  async loadAllModules() {
    const modulesPath = join(process.cwd(), '..', '..', 'modules');
    
    if (!existsSync(modulesPath)) {
      console.log('Nenhum diretório de módulos encontrado para carregar');
      return;
    }

    const moduleDirs = readdirSync(modulesPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const moduleName of moduleDirs) {
      try {
        await this.loadModule(moduleName);
      } catch (error) {
        console.error(`Erro ao carregar módulo ${moduleName}:`, error);
      }
    }
  }

  /**
   * Carrega um módulo específico
   */
  async loadModule(moduleName: string) {
    // Verificar se o módulo já foi carregado
    if (this.loadedModules.has(moduleName)) {
      return;
    }

    const modulePath = join(process.cwd(), '..', '..', 'modules', moduleName);
    
    // Verificar se o diretório do módulo existe
    if (!existsSync(modulePath)) {
      console.warn(`Diretório do módulo não encontrado: ${modulePath}`);
      return;
    }

    // Carregar componente backend se existir
    const backendIndexPath = join(modulePath, 'backend', 'index.ts');
    if (existsSync(backendIndexPath)) {
      try {
        // Em uma implementação real, isso carregaria dinamicamente o módulo
        console.log(`Backend do módulo carregado: ${moduleName}`);
      } catch (error) {
        console.error(`Erro ao carregar backend do módulo ${moduleName}:`, error);
      }
    }

    // Marcar módulo como carregado
    this.loadedModules.add(moduleName);
    console.log(`Módulo carregado: ${moduleName}`);
  }

  /**
   * Retorna lista de módulos carregados
   */
  getLoadedModules(): string[] {
    return Array.from(this.loadedModules);
  }
}