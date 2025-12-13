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

      // Verificar se existe o arquivo module.config.json (prioridade) ou module.json (legado)
      let moduleJsonPath = path.join(modulePath, 'module.config.json');
      let isLegacy = false;

      if (!fs.existsSync(moduleJsonPath)) {
        moduleJsonPath = path.join(modulePath, 'module.json');
        isLegacy = true; // Marca como legado para tratamento diferenciado se necessário
        if (!fs.existsSync(moduleJsonPath)) {
          this.logger.warn(`Módulo ${moduleName} não possui arquivo module.config.json ou module.json, pulando`);
          return;
        }
      }

      // Ler e parsear o arquivo
      const moduleJsonContent = fs.readFileSync(moduleJsonPath, 'utf8');
      const moduleConfig = JSON.parse(moduleJsonContent);

      // Validar campos obrigatórios
      if (!moduleConfig.name || (!moduleConfig.displayName && !moduleConfig.name) || !moduleConfig.version) {
        this.logger.warn(`Módulo ${moduleName} possui campos obrigatórios faltando, pulando`);
        return;
      }

      // Normalizar configuração
      // Se for module.config.json, menu/routes/permissions estão na raiz, mas o DB espera em 'config'
      // O frontend espera 'menu' como array
      let finalConfig = moduleConfig.config || {};

      // Helper para garantir array
      const ensureArray = (item: any) => Array.isArray(item) ? item : (item ? [item] : []);

      // Lista de propriedades "especiais" que devem ser movidas para 'config' se existirem na raiz
      // Adicione aqui qualquer nova propriedade que os módulos possam definir na raiz
      const specialProps = ['menu', 'routes', 'permissions', 'notifications', 'userMenu', 'dashboardWidgets', 'slots'];

      specialProps.forEach(prop => {
        if (moduleConfig[prop]) {
          // Tratamento especial para menu (garantir array)
          if (prop === 'menu') {
            // Lógica de compatibilidade: se já tinha menu em finalConfig, mantém, senão usa o da raiz
            if (!finalConfig.menu) {
              finalConfig.menu = ensureArray(moduleConfig[prop]);
            } else {
              finalConfig.menu = ensureArray(finalConfig.menu);
            }
          } else {
            // Para outras propriedades, apenas copia se não existir em finalConfig
            if (!finalConfig[prop]) {
              finalConfig[prop] = moduleConfig[prop];
            }
          }
        } else if (prop === 'menu' && finalConfig.menu) {
          // Se menu está apenas em config, garante array
          finalConfig.menu = ensureArray(finalConfig.menu);
        }
      });

      // Fusão Genérica: Copiar quaisquer outras propriedades da raiz que não sejam metadados padrão
      const metadataProps = ['name', 'displayName', 'description', 'version', 'author', 'dependencies', 'config'];
      Object.keys(moduleConfig).forEach(key => {
        if (!metadataProps.includes(key) && !specialProps.includes(key) && !finalConfig[key]) {
          finalConfig[key] = moduleConfig[key];
        }
      });

      // Verificar se o módulo já existe no banco de dados
      const existingModule = await this.prisma.module.findUnique({
        where: { name: moduleConfig.name }
      });

      const moduleData = {
        name: moduleConfig.name,
        displayName: moduleConfig.displayName || moduleConfig.name,
        description: moduleConfig.description || '',
        version: moduleConfig.version,
        isActive: true,
        config: JSON.stringify(finalConfig)
      };

      if (existingModule) {
        // Opcional: Atualizar módulo existente se a versão mudou ou forçar atualização
        // Por enquanto, apenas logamos, mas poderíamos atualizar a configuração
        this.logger.log(`Módulo ${moduleName} já registrado. Atualizando configuração...`);
        await this.prisma.module.update({
          where: { name: moduleConfig.name },
          data: moduleData
        });
      } else {
        // Registrar o módulo no banco de dados
        await this.prisma.module.create({
          data: moduleData
        });
        this.logger.log(`Módulo ${moduleName} registrado automaticamente com sucesso`);
      }

      // Atualizar/Criar vínculo com todos os tenants existentes
      // Isso garante que o módulo apareça para todos, conforme regra de negócio
      const allTenants = await this.prisma.tenant.findMany({ select: { id: true } });

      if (allTenants.length > 0) {
        // Usamos createMany com skipDuplicates para ser eficiente
        // Se já existe, não faz nada (mantém configurações personalizadas se houver)
        // Se não existe, cria ativo por padrão
        await this.prisma.tenantModule.createMany({
          data: allTenants.map(tenant => ({
            tenantId: tenant.id,
            moduleName: moduleConfig.name,
            isActive: true
          })),
          skipDuplicates: true
        });
        this.logger.log(`Módulo ${moduleName} vinculado a ${allTenants.length} tenants`);
      }

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