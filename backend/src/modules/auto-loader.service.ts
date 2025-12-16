import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AutoLoaderService {
  private readonly logger = new Logger(AutoLoaderService.name);
  private readonly modulesPath = path.join(process.cwd(), '..', 'modules');

  constructor(private prisma: PrismaService) {
    // Verificar se o diretÃ³rio de mÃ³dulos existe
    if (!fs.existsSync(this.modulesPath)) {
      this.logger.log(`DiretÃ³rio de mÃ³dulos nÃ£o encontrado: ${this.modulesPath}`);
      return;
    }

    // Carregar mÃ³dulos automaticamente na inicializaÃ§Ã£o
    this.loadModulesFromDirectory();
  }

  /**
   * Carrega automaticamente os mÃ³dulos do diretÃ³rio de mÃ³dulos
   */
  async loadModulesFromDirectory() {
    try {
      // Verificar se o diretÃ³rio de mÃ³dulos existe
      if (!fs.existsSync(this.modulesPath)) {
        this.logger.log('DiretÃ³rio de mÃ³dulos nÃ£o encontrado, pulando carregamento automÃ¡tico');
        return;
      }

      // Ler todos os diretÃ³rios no diretÃ³rio de mÃ³dulos
      const moduleDirs = fs.readdirSync(this.modulesPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      this.logger.log(`Encontrados ${moduleDirs.length} diretÃ³rios de mÃ³dulos`);

      // Processar cada diretÃ³rio de mÃ³dulo
      for (const moduleName of moduleDirs) {
        await this.processModuleDirectory(moduleName);
      }

      this.logger.log('Carregamento automÃ¡tico de mÃ³dulos concluÃ­do');
    } catch (error) {
      this.logger.error('Erro ao carregar mÃ³dulos automaticamente:', error);
    }
  }

  /**
   * Processa um diretÃ³rio de mÃ³dulo especÃ­fico
   * @param moduleName Nome do mÃ³dulo
   */
  private async processModuleDirectory(moduleName: string) {
    try {
      const modulePath = path.join(this.modulesPath, moduleName);

      // Verificar se existe o arquivo module.config.json (prioridade) ou module.json (legado)
      let moduleJsonPath = path.join(modulePath, 'module.config.json');
      let isLegacy = false;

      if (!fs.existsSync(moduleJsonPath)) {
        moduleJsonPath = path.join(modulePath, 'module.json');
        isLegacy = true; // Marca como legado para tratamento diferenciado se necessÃ¡rio
        if (!fs.existsSync(moduleJsonPath)) {
          this.logger.warn(`MÃ³dulo ${moduleName} nÃ£o possui arquivo module.config.json ou module.json, pulando`);
          return;
        }
      }

      // Ler e parsear o arquivo
      const moduleJsonContent = fs.readFileSync(moduleJsonPath, 'utf8');
      const moduleConfig = JSON.parse(moduleJsonContent);

      // Validar campos obrigatÃ³rios
      if (!moduleConfig.name || (!moduleConfig.displayName && !moduleConfig.name) || !moduleConfig.version) {
        this.logger.warn(`MÃ³dulo ${moduleName} possui campos obrigatÃ³rios faltando, pulando`);
        return;
      }

      // Normalizar configuraÃ§Ã£o
      // Se for module.config.json, menu/routes/permissions estÃ£o na raiz, mas o DB espera em 'config'
      // O frontend espera 'menu' como array
      let finalConfig = moduleConfig.config || {};

      // Helper para garantir array
      const ensureArray = (item: any) => Array.isArray(item) ? item : (item ? [item] : []);

      // Lista de propriedades "especiais" que devem ser movidas para 'config' se existirem na raiz
      // Adicione aqui qualquer nova propriedade que os mÃ³dulos possam definir na raiz
      const specialProps = ['menu', 'routes', 'permissions', 'notifications', 'userMenu', 'dashboardWidgets', 'slots'];

      specialProps.forEach(prop => {
        if (moduleConfig[prop]) {
          // Tratamento especial para menu (garantir array)
          if (prop === 'menu') {
            // LÃ³gica de compatibilidade: se jÃ¡ tinha menu em finalConfig, mantÃ©m, senÃ£o usa o da raiz
            if (!finalConfig.menu) {
              finalConfig.menu = ensureArray(moduleConfig[prop]);
            } else {
              finalConfig.menu = ensureArray(finalConfig.menu);
            }
          } else {
            // Para outras propriedades, apenas copia se nÃ£o existir em finalConfig
            if (!finalConfig[prop]) {
              finalConfig[prop] = moduleConfig[prop];
            }
          }
        } else if (prop === 'menu' && finalConfig.menu) {
          // Se menu estÃ¡ apenas em config, garante array
          finalConfig.menu = ensureArray(finalConfig.menu);
        }
      });

      // FusÃ£o GenÃ©rica: Copiar quaisquer outras propriedades da raiz que nÃ£o sejam metadados padrÃ£o
      const metadataProps = ['name', 'displayName', 'description', 'version', 'author', 'dependencies', 'config'];
      Object.keys(moduleConfig).forEach(key => {
        if (!metadataProps.includes(key) && !specialProps.includes(key) && !finalConfig[key]) {
          finalConfig[key] = moduleConfig[key];
        }
      });

      // Verificar se o mÃ³dulo jÃ¡ existe no banco de dados
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
        // Opcional: Atualizar mÃ³dulo existente se a versÃ£o mudou ou forÃ§ar atualizaÃ§Ã£o
        // Por enquanto, apenas logamos, mas poderÃ­amos atualizar a configuraÃ§Ã£o
        this.logger.log(`MÃ³dulo ${moduleName} jÃ¡ registrado. Atualizando configuraÃ§Ã£o...`);
        await this.prisma.module.update({
          where: { name: moduleConfig.name },
          data: moduleData
        });
      } else {
        // Registrar o mÃ³dulo no banco de dados
        await this.prisma.module.create({
          data: moduleData
        });
        this.logger.log(`MÃ³dulo ${moduleName} registrado automaticamente com sucesso`);
      }

      // Atualizar/Criar vÃ­nculo com todos os tenants existentes
      // Isso garante que o mÃ³dulo apareÃ§a para todos, conforme regra de negÃ³cio
      const allTenants = await this.prisma.tenant.findMany({ select: { id: true } });

      if (allTenants.length > 0) {
        // Usamos createMany com skipDuplicates para ser eficiente
        // Se jÃ¡ existe, nÃ£o faz nada (mantÃ©m configuraÃ§Ãµes personalizadas se houver)
        // Se nÃ£o existe, cria ativo por padrÃ£o
        await this.prisma.tenantModule.createMany({
          data: allTenants.map(tenant => ({
            tenantId: tenant.id,
            moduleName: moduleConfig.name,
            isActive: true
          })),
          skipDuplicates: true
        });
        this.logger.log(`MÃ³dulo ${moduleName} vinculado a ${allTenants.length} tenants`);
      }

    } catch (error) {
      this.logger.error(`Erro ao processar mÃ³dulo ${moduleName}:`, error);
    }
  }

  /**
   * Verifica se um mÃ³dulo estÃ¡ disponÃ­vel no diretÃ³rio
   * @param moduleName Nome do mÃ³dulo
   * @returns true se o mÃ³dulo estiver disponÃ­vel, false caso contrÃ¡rio
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
   * ObtÃ©m a configuraÃ§Ã£o de um mÃ³dulo do diretÃ³rio
   * @param moduleName Nome do mÃ³dulo
   * @returns ConfiguraÃ§Ã£o do mÃ³dulo ou null se nÃ£o encontrado
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
      this.logger.error(`Erro ao ler configuraÃ§Ã£o do mÃ³dulo ${moduleName}:`, error);
      return null;
    }
  }
}
