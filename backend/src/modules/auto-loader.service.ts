import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AutoLoaderService {
  private readonly logger = new Logger(AutoLoaderService.name);
  private readonly modulesPath = path.join(process.cwd(), '..', 'modules');

  constructor(private prisma: PrismaService) {
    // Verificar se o diretório de módulos existe
    if (!fs.existsSync(this.modulesPath)) {
      this.logger.log(`Diretório de módulos não encontrado: ${this.modulesPath}`);
      return;
    }

    // Carregar módulos automaticamente na inicialização
    this.loadModulesFromDirectory();
  }

  /**
   * Carrega automaticamente os módulos do diretório de módulos
   */
  async loadModulesFromDirectory() {
    try {
      // Verificar se o diretório de módulos existe
      if (!fs.existsSync(this.modulesPath)) {
        this.logger.log('Diretório de módulos não encontrado, pulando carregamento automático');
        return;
      }

      // Ler todos os diretórios no diretório de módulos
      const moduleDirs = fs.readdirSync(this.modulesPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      this.logger.log(`Encontrados ${moduleDirs.length} diretórios de módulos`);

      // Processar cada diretório de módulo
      for (const moduleName of moduleDirs) {
        await this.processModuleDirectory(moduleName);
      }

      this.logger.log('Carregamento automático de módulos concluído');
    } catch (error) {
      this.logger.error('Erro ao carregar módulos automaticamente:', error);
    }
  }

  /**
   * Processa um diretório de módulo específico
   * @param moduleName Nome do módulo
   */
  private async processModuleDirectory(moduleName: string) {
    try {
      const modulePath = path.join(this.modulesPath, moduleName);
      
      // Verificar se existe o arquivo module.json
      const moduleJsonPath = path.join(modulePath, 'module.json');
      if (!fs.existsSync(moduleJsonPath)) {
        this.logger.warn(`Módulo ${moduleName} não possui arquivo module.json, pulando`);
        return;
      }

      // Ler e parsear o arquivo module.json
      const moduleJsonContent = fs.readFileSync(moduleJsonPath, 'utf8');
      const moduleConfig = JSON.parse(moduleJsonContent);

      // Validar campos obrigatórios
      if (!moduleConfig.name || !moduleConfig.displayName || !moduleConfig.version) {
        this.logger.warn(`Módulo ${moduleName} possui campos obrigatórios faltando, pulando`);
        return;
      }

      // Verificar se o módulo já existe no banco de dados
      const existingModule = await this.prisma.module.findUnique({
        where: { name: moduleConfig.name }
      });

      if (existingModule) {
        this.logger.log(`Módulo ${moduleName} já registrado no banco de dados`);
        return;
      }

      // Registrar o módulo no banco de dados
      await this.prisma.module.create({
        data: {
          name: moduleConfig.name,
          displayName: moduleConfig.displayName,
          description: moduleConfig.description || '',
          version: moduleConfig.version,
          isActive: true,
          config: moduleConfig.config ? JSON.stringify(moduleConfig.config) : null
        }
      });

      this.logger.log(`Módulo ${moduleName} registrado automaticamente com sucesso`);
    } catch (error) {
      this.logger.error(`Erro ao processar módulo ${moduleName}:`, error);
    }
  }

  /**
   * Verifica se um módulo está disponível no diretório
   * @param moduleName Nome do módulo
   * @returns true se o módulo estiver disponível, false caso contrário
   */
  isModuleAvailable(moduleName: string): boolean {
    try {
      const modulePath = path.join(this.modulesPath, moduleName);
      return fs.existsSync(modulePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtém a configuração de um módulo do diretório
   * @param moduleName Nome do módulo
   * @returns Configuração do módulo ou null se não encontrado
   */
  async getModuleConfigFromDirectory(moduleName: string): Promise<any> {
    try {
      const modulePath = path.join(this.modulesPath, moduleName);
      const moduleJsonPath = path.join(modulePath, 'module.json');
      
      if (!fs.existsSync(moduleJsonPath)) {
        return null;
      }

      const moduleJsonContent = fs.readFileSync(moduleJsonPath, 'utf8');
      return JSON.parse(moduleJsonContent);
    } catch (error) {
      this.logger.error(`Erro ao ler configuração do módulo ${moduleName}:`, error);
      return null;
    }
  }
}