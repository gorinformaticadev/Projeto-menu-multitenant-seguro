import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as AdmZip from 'adm-zip';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

@Injectable()
export class ModuleInstallerService {
  private readonly logger = new Logger(ModuleInstallerService.name);
  private readonly modulesPath = path.join(process.cwd(), 'modules');
  private readonly uploadsPath = path.join(process.cwd(), 'uploads', 'modules');

  constructor(private prisma: PrismaService) {
    // Criar diretórios se não existirem
    this.ensureDirectories();
  }

  private ensureDirectories() {
    if (!fs.existsSync(this.modulesPath)) {
      fs.mkdirSync(this.modulesPath, { recursive: true });
    }
    if (!fs.existsSync(this.uploadsPath)) {
      fs.mkdirSync(this.uploadsPath, { recursive: true });
    }
  }

  async uploadModule(file: Express.Multer.File): Promise<any> {
    this.logger.log(`Iniciando upload do módulo: ${file.originalname}`);
    this.logger.log(`Tipo do arquivo: ${typeof file}`);
    this.logger.log(`Propriedades do arquivo: ${Object.keys(file)}`);
    this.logger.log(`Buffer existe: ${!!file.buffer}`);
    this.logger.log(`Tipo do buffer: ${typeof file.buffer}`);
    this.logger.log(`Buffer é Buffer: ${Buffer.isBuffer(file.buffer)}`);
    this.logger.log(`Tamanho do buffer: ${file.buffer?.length || 'N/A'}`);

    try {
      // Validar arquivo ZIP
      if (!file.originalname.endsWith('.zip')) {
        throw new BadRequestException('Apenas arquivos ZIP são aceitos');
      }

      // Verificar se o buffer existe e é válido
      if (!file.buffer || !Buffer.isBuffer(file.buffer)) {
        throw new BadRequestException('Arquivo não contém dados válidos ou buffer inválido');
      }

      // Salvar arquivo temporariamente
      const tempPath = path.join(this.uploadsPath, `temp_${Date.now()}_${file.originalname}`);
      fs.writeFileSync(tempPath, file.buffer);

      // Extrair e validar conteúdo
      const moduleInfo = await this.extractAndValidateModule(tempPath);

      // Verificar se módulo já existe
      const existingModule = await this.prisma.module.findUnique({
        where: { name: moduleInfo.name }
      });

      if (existingModule) {
        // Atualizar módulo existente
        await this.updateExistingModule(moduleInfo, tempPath);
      } else {
        // Instalar novo módulo
        await this.installNewModule(moduleInfo, tempPath);
      }

      // Limpar arquivo temporário
      fs.unlinkSync(tempPath);

      this.logger.log(`Módulo ${moduleInfo.name} instalado com sucesso`);
      return {
        success: true,
        module: moduleInfo,
        message: existingModule ? 'Módulo atualizado com sucesso' : 'Módulo instalado com sucesso'
      };

    } catch (error) {
      this.logger.error(`Erro ao instalar módulo: ${error.message}`);
      throw error;
    }
  }

  private async extractAndValidateModule(zipPath: string): Promise<any> {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    // Procurar por module.json
    const moduleJsonEntry = entries.find(entry => entry.entryName === 'module.json');
    if (!moduleJsonEntry) {
      throw new BadRequestException('Arquivo module.json não encontrado no ZIP');
    }

    // Ler configuração do módulo
    const moduleConfig = JSON.parse(moduleJsonEntry.getData().toString());

    // Validar campos obrigatórios
    if (!moduleConfig.name || !moduleConfig.displayName || !moduleConfig.version) {
      throw new BadRequestException('Campos obrigatórios ausentes no module.json (name, displayName, version)');
    }

    // Validar nome do módulo (apenas letras, números, underscore e hífen)
    if (!/^[a-zA-Z0-9_-]+$/.test(moduleConfig.name)) {
      throw new BadRequestException('Nome do módulo deve conter apenas letras, números, underscore e hífen');
    }

    return moduleConfig;
  }

  private async installNewModule(moduleInfo: any, zipPath: string): Promise<void> {
    const zip = new AdmZip(zipPath);
    const modulePath = path.join(this.modulesPath, moduleInfo.name);

    // Criar diretório do módulo
    if (fs.existsSync(modulePath)) {
      fs.rmSync(modulePath, { recursive: true });
    }
    fs.mkdirSync(modulePath, { recursive: true });

    // Extrair arquivos
    zip.extractAllTo(modulePath, true);

    // Executar migrações se existirem
    await this.runMigrations(moduleInfo, modulePath);

    // Instalar dependências NPM se existir package.json
    await this.installDependencies(modulePath);

    // Registrar módulo no banco
    await this.prisma.module.create({
      data: {
        name: moduleInfo.name,
        displayName: moduleInfo.displayName,
        description: moduleInfo.description || '',
        version: moduleInfo.version,
        config: moduleInfo.config ? JSON.stringify(moduleInfo.config) : null,
        isActive: true
      }
    });
  }

  private async updateExistingModule(moduleInfo: any, zipPath: string): Promise<void> {
    const zip = new AdmZip(zipPath);
    const modulePath = path.join(this.modulesPath, moduleInfo.name);

    // Backup do módulo atual
    const backupPath = path.join(this.modulesPath, `${moduleInfo.name}_backup_${Date.now()}`);
    if (fs.existsSync(modulePath)) {
      fs.renameSync(modulePath, backupPath);
    }

    try {
      // Criar novo diretório
      fs.mkdirSync(modulePath, { recursive: true });

      // Extrair novos arquivos
      zip.extractAllTo(modulePath, true);

      // Executar migrações
      await this.runMigrations(moduleInfo, modulePath);

      // Instalar dependências
      await this.installDependencies(modulePath);

      // Atualizar registro no banco
      await this.prisma.module.update({
        where: { name: moduleInfo.name },
        data: {
          displayName: moduleInfo.displayName,
          description: moduleInfo.description || '',
          version: moduleInfo.version,
          config: moduleInfo.config ? JSON.stringify(moduleInfo.config) : null
        }
      });

      // Remover backup se tudo deu certo
      if (fs.existsSync(backupPath)) {
        fs.rmSync(backupPath, { recursive: true });
      }

    } catch (error) {
      // Restaurar backup em caso de erro
      if (fs.existsSync(backupPath)) {
        if (fs.existsSync(modulePath)) {
          fs.rmSync(modulePath, { recursive: true });
        }
        fs.renameSync(backupPath, modulePath);
      }
      throw error;
    }
  }

  private async runMigrations(moduleInfo: any, modulePath: string): Promise<void> {
    const migrationsPath = path.join(modulePath, 'migrations');
    
    if (!fs.existsSync(migrationsPath)) {
      this.logger.log(`Nenhuma migração encontrada para o módulo ${moduleInfo.name}`);
      return;
    }

    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const migrationFile of migrationFiles) {
      const migrationPath = path.join(migrationsPath, migrationFile);
      const migrationSql = fs.readFileSync(migrationPath, 'utf8');

      try {
        this.logger.log(`Executando migração: ${migrationFile}`);
        await this.prisma.$executeRawUnsafe(migrationSql);
        this.logger.log(`Migração ${migrationFile} executada com sucesso`);
      } catch (error) {
        this.logger.error(`Erro ao executar migração ${migrationFile}: ${error.message}`);
        throw new BadRequestException(`Erro na migração ${migrationFile}: ${error.message}`);
      }
    }
  }

  private async installDependencies(modulePath: string): Promise<void> {
    const packageJsonPath = path.join(modulePath, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      this.logger.log('Nenhum package.json encontrado, pulando instalação de dependências');
      return;
    }

    try {
      this.logger.log('Instalando dependências do módulo...');
      await execAsync('npm install', { cwd: modulePath });
      this.logger.log('Dependências instaladas com sucesso');
    } catch (error) {
      this.logger.warn(`Aviso: Erro ao instalar dependências: ${error.message}`);
      // Não falhar a instalação por causa das dependências
    }
  }

  async removeModule(moduleName: string): Promise<any> {
    this.logger.log(`Iniciando remoção do módulo: ${moduleName}`);

    try {
      // Verificar se módulo existe
      const module = await this.prisma.module.findUnique({
        where: { name: moduleName }
      });

      if (!module) {
        throw new BadRequestException(`Módulo '${moduleName}' não encontrado`);
      }

      // Verificar se há tenants usando este módulo
      const tenantModules = await this.prisma.tenantModule.count({
        where: { moduleName }
      });

      if (tenantModules > 0) {
        throw new BadRequestException(
          `Não é possível remover o módulo '${moduleName}' pois está sendo usado por ${tenantModules} tenant(s)`
        );
      }

      // Remover arquivos físicos
      const modulePath = path.join(this.modulesPath, moduleName);
      if (fs.existsSync(modulePath)) {
        fs.rmSync(modulePath, { recursive: true });
      }

      // Remover do banco
      await this.prisma.module.delete({
        where: { name: moduleName }
      });

      this.logger.log(`Módulo ${moduleName} removido com sucesso`);
      return {
        success: true,
        message: `Módulo '${moduleName}' removido com sucesso`
      };

    } catch (error) {
      this.logger.error(`Erro ao remover módulo: ${error.message}`);
      throw error;
    }
  }

  async listInstalledModules(): Promise<any[]> {
    const modules = await this.prisma.module.findMany({
      orderBy: { displayName: 'asc' }
    });

    return modules.map(module => ({
      ...module,
      config: module.config ? JSON.parse(module.config) : null,
      isInstalled: fs.existsSync(path.join(this.modulesPath, module.name))
    }));
  }

  async getModuleInfo(moduleName: string): Promise<any> {
    const module = await this.prisma.module.findUnique({
      where: { name: moduleName }
    });

    if (!module) {
      throw new BadRequestException(`Módulo '${moduleName}' não encontrado`);
    }

    const modulePath = path.join(this.modulesPath, moduleName);
    const isInstalled = fs.existsSync(modulePath);

    let moduleJson = null;
    if (isInstalled) {
      const moduleJsonPath = path.join(modulePath, 'module.json');
      if (fs.existsSync(moduleJsonPath)) {
        moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf8'));
      }
    }

    return {
      ...module,
      config: module.config ? JSON.parse(module.config) : null,
      isInstalled,
      moduleJson
    };
  }
}