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
  private readonly modulesPath = path.join(process.cwd(), '..', 'modules');
  private readonly uploadsPath = path.join(process.cwd(), 'uploads', 'modules');

  constructor(private prisma: PrismaService) {
    // Criar diretórios se não existirem
    this.ensureDirectories();
  }

  private ensureDirectories() {
    try {
      if (!fs.existsSync(this.modulesPath)) {
        this.logger.log(`Criando diretório de módulos: ${this.modulesPath}`);
        fs.mkdirSync(this.modulesPath, { recursive: true, mode: 0o755 });
      }
      if (!fs.existsSync(this.uploadsPath)) {
        this.logger.log(`Criando diretório de uploads: ${this.uploadsPath}`);
        fs.mkdirSync(this.uploadsPath, { recursive: true, mode: 0o755 });
      }
      
      // Verificar permissões de escrita
      fs.accessSync(this.modulesPath, fs.constants.W_OK);
      fs.accessSync(this.uploadsPath, fs.constants.W_OK);
      
      this.logger.log('Diretórios verificados e com permissão de escrita');
    } catch (error) {
      this.logger.error(`Erro ao verificar diretórios: ${error.message}`);
      throw new Error(`Erro de permissão nos diretórios: ${error.message}`);
    }
  }

  async uploadModule(file: Express.Multer.File): Promise<any> {
    this.logger.log(`Iniciando upload do módulo: ${file.originalname}`);

    try {
      // Validar arquivo ZIP
      if (!file.originalname.endsWith('.zip')) {
        throw new BadRequestException('Apenas arquivos ZIP são aceitos');
      }

      // Verificar se o buffer existe
      if (!file.buffer) {
        throw new BadRequestException('Arquivo não contém dados válidos');
      }

      this.logger.log(`Tamanho do arquivo: ${file.size} bytes`);
      this.logger.log(`Tipo do buffer: ${typeof file.buffer}`);
      this.logger.log(`É Buffer: ${Buffer.isBuffer(file.buffer)}`);

      // Salvar arquivo temporariamente
      const tempPath = path.join(this.uploadsPath, `temp_${Date.now()}_${file.originalname}`);
      
      try {
        // Garantir que temos um Buffer válido
        let bufferData: Buffer;
        
        if (Buffer.isBuffer(file.buffer)) {
          bufferData = file.buffer;
        } else {
          // Tentar converter para Buffer usando diferentes métodos
          try {
            // Método 1: Conversão direta
            bufferData = Buffer.from(file.buffer as any);
          } catch (e1) {
            try {
              // Método 2: Se for um objeto com propriedade data
              const bufferObj = file.buffer as any;
              if (bufferObj && bufferObj.data) {
                bufferData = Buffer.from(bufferObj.data);
              } else {
                // Método 3: Converter valores do objeto
                bufferData = Buffer.from(Object.values(bufferObj || {}));
              }
            } catch (e2) {
              this.logger.error(`Falha em todas as tentativas de conversão: ${e1.message}, ${e2.message}`);
              throw new Error('Não foi possível converter o buffer do arquivo');
            }
          }
        }
        
        fs.writeFileSync(tempPath, bufferData);
        this.logger.log(`Arquivo temporário salvo: ${tempPath} (${bufferData.length} bytes)`);
      } catch (error) {
        this.logger.error(`Erro ao salvar arquivo temporário: ${error.message}`);
        this.logger.error(`Tipo do file.buffer: ${typeof file.buffer}`);
        throw new BadRequestException(`Erro de permissão ao salvar arquivo: ${error.message}`);
      }

      // Apenas descompactar o módulo
      const moduleInfo = await this.extractModule(tempPath);

      // Limpar arquivo temporário
      fs.unlinkSync(tempPath);

      this.logger.log(`Módulo ${moduleInfo.name} descompactado com sucesso`);
      return {
        success: true,
        module: moduleInfo,
        message: 'Módulo descompactado com sucesso'
      };

    } catch (error) {
      this.logger.error(`Erro ao descompactar módulo: ${error.message}`);
      throw error;
    }
  }

  private async extractModule(zipPath: string): Promise<any> {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    this.logger.log(`Descompactando ZIP com ${entries.length} arquivos`);

    // Procurar por module.json para obter o nome do módulo
    let moduleJsonEntry = entries.find(entry => entry.entryName === 'module.json');
    
    if (!moduleJsonEntry) {
      // Procurar em subpastas
      moduleJsonEntry = entries.find(entry => entry.entryName.endsWith('/module.json'));
    }

    if (!moduleJsonEntry) {
      throw new BadRequestException('Arquivo module.json não encontrado no ZIP');
    }

    // Ler apenas o nome do módulo
    const moduleConfig = JSON.parse(moduleJsonEntry.getData().toString());
    const moduleName = moduleConfig.name;

    if (!moduleName) {
      throw new BadRequestException('Nome do módulo não encontrado no module.json');
    }

    this.logger.log(`Módulo identificado: ${moduleName}`);

    // Definir caminho de destino
    const modulePath = path.join(this.modulesPath, moduleName);

    // Verificar se a pasta do módulo já existe
    if (fs.existsSync(modulePath)) {
      this.logger.log(`Pasta do módulo ${moduleName} já existe, sobrescrevendo...`);
      try {
        fs.rmSync(modulePath, { recursive: true });
      } catch (error) {
        this.logger.error(`Erro ao remover pasta existente: ${error.message}`);
        throw new BadRequestException(`Erro de permissão ao remover pasta existente: ${error.message}`);
      }
    }

    // Criar diretório do módulo
    try {
      fs.mkdirSync(modulePath, { recursive: true, mode: 0o755 });
      this.logger.log(`Diretório criado: ${modulePath}`);
    } catch (error) {
      this.logger.error(`Erro ao criar diretório do módulo: ${error.message}`);
      throw new BadRequestException(`Erro de permissão ao criar diretório: ${error.message}`);
    }

    // Descompactar arquivos
    this.logger.log(`Descompactando para: ${modulePath}`);
    
    // Verificar se há pasta pai no ZIP
    const hasParentFolder = entries.some(entry => entry.entryName.startsWith(`${moduleName}/`));
    
    if (hasParentFolder) {
      // Extrair apenas o conteúdo da pasta do módulo
      const parentFolderPrefix = `${moduleName}/`;
      const filteredEntries = entries.filter(entry => 
        entry.entryName.startsWith(parentFolderPrefix) && 
        entry.entryName !== parentFolderPrefix
      );

      for (const entry of filteredEntries) {
        const relativePath = entry.entryName.substring(parentFolderPrefix.length);
        const targetPath = path.join(modulePath, relativePath);

        if (entry.isDirectory) {
          fs.mkdirSync(targetPath, { recursive: true });
        } else {
          const targetDir = path.dirname(targetPath);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          fs.writeFileSync(targetPath, entry.getData());
        }
      }
    } else {
      // Extrair tudo diretamente
      zip.extractAllTo(modulePath, true);
    }

    this.logger.log(`Descompactação concluída para o módulo: ${moduleName}`);

    return {
      name: moduleName,
      displayName: moduleConfig.displayName || moduleName,
      version: moduleConfig.version || '1.0.0',
      description: moduleConfig.description || ''
    };
  }

  private async extractAndValidateModule(zipPath: string): Promise<any> {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    this.logger.log(`Analisando conteúdo do ZIP: ${entries.length} arquivos encontrados`);

    // Procurar por module.json na raiz ou em subpastas
    let moduleJsonEntry = entries.find(entry => entry.entryName === 'module.json');
    
    if (!moduleJsonEntry) {
      // Procurar em subpastas (caso o ZIP tenha uma pasta pai)
      moduleJsonEntry = entries.find(entry => entry.entryName.endsWith('/module.json'));
    }

    if (!moduleJsonEntry) {
      this.logger.error('Arquivos no ZIP:', entries.map(e => e.entryName));
      throw new BadRequestException('Arquivo module.json não encontrado no ZIP');
    }

    this.logger.log(`Arquivo module.json encontrado: ${moduleJsonEntry.entryName}`);

    // Ler configuração do módulo
    const moduleConfig = JSON.parse(moduleJsonEntry.getData().toString());
    this.logger.log(`Configuração do módulo: ${JSON.stringify(moduleConfig, null, 2)}`);

    // Validar campos obrigatórios
    if (!moduleConfig.name || !moduleConfig.displayName || !moduleConfig.version) {
      throw new BadRequestException('Campos obrigatórios ausentes no module.json (name, displayName, version)');
    }

    // Validar nome do módulo (apenas letras, números, underscore e hífen)
    if (!/^[a-zA-Z0-9_-]+$/.test(moduleConfig.name)) {
      throw new BadRequestException('Nome do módulo deve conter apenas letras, números, underscore e hífen');
    }

    // Verificar se há uma pasta pai no ZIP
    const hasParentFolder = entries.some(entry => entry.entryName.startsWith(`${moduleConfig.name}/`));
    moduleConfig._hasParentFolder = hasParentFolder;

    this.logger.log(`Módulo ${moduleConfig.name} validado com sucesso. Pasta pai no ZIP: ${hasParentFolder}`);

    return moduleConfig;
  }

  private async installNewModule(moduleInfo: any, zipPath: string): Promise<void> {
    const zip = new AdmZip(zipPath);
    const modulePath = path.join(this.modulesPath, moduleInfo.name);

    this.logger.log(`Instalando novo módulo: ${moduleInfo.name}`);
    this.logger.log(`Caminho de destino: ${modulePath}`);

    // Verificar se a pasta do módulo já existe
    const moduleExists = fs.existsSync(modulePath);
    this.logger.log(`Pasta do módulo existe: ${moduleExists}`);

    if (moduleExists) {
      this.logger.log('Removendo pasta existente do módulo...');
      fs.rmSync(modulePath, { recursive: true });
    }

    // Criar diretório do módulo
    this.logger.log('Criando diretório do módulo...');
    fs.mkdirSync(modulePath, { recursive: true });

    // Extrair arquivos baseado na estrutura do ZIP
    await this.extractModuleFiles(zip, moduleInfo, modulePath);

    // Executar migrações se existirem
    await this.runMigrations(moduleInfo, modulePath);

    // Instalar dependências NPM se existir package.json
    await this.installDependencies(modulePath);

    // Registrar módulo no banco
    this.logger.log('Registrando módulo no banco de dados...');
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

    this.logger.log(`Módulo ${moduleInfo.name} instalado com sucesso`);
  }

  private async updateExistingModule(moduleInfo: any, zipPath: string): Promise<void> {
    const zip = new AdmZip(zipPath);
    const modulePath = path.join(this.modulesPath, moduleInfo.name);

    this.logger.log(`Atualizando módulo existente: ${moduleInfo.name}`);

    // Backup do módulo atual
    const backupPath = path.join(this.modulesPath, `${moduleInfo.name}_backup_${Date.now()}`);
    if (fs.existsSync(modulePath)) {
      this.logger.log('Criando backup do módulo atual...');
      fs.renameSync(modulePath, backupPath);
    }

    try {
      // Criar novo diretório
      this.logger.log('Criando novo diretório do módulo...');
      fs.mkdirSync(modulePath, { recursive: true });

      // Extrair novos arquivos
      await this.extractModuleFiles(zip, moduleInfo, modulePath);

      // Executar migrações
      await this.runMigrations(moduleInfo, modulePath);

      // Instalar dependências
      await this.installDependencies(modulePath);

      // Atualizar registro no banco
      this.logger.log('Atualizando registro no banco de dados...');
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
        this.logger.log('Removendo backup após sucesso...');
        fs.rmSync(backupPath, { recursive: true });
      }

      this.logger.log(`Módulo ${moduleInfo.name} atualizado com sucesso`);

    } catch (error) {
      this.logger.error(`Erro na atualização, restaurando backup: ${error.message}`);
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

  private async extractModuleFiles(zip: AdmZip, moduleInfo: any, modulePath: string): Promise<void> {
    const entries = zip.getEntries();
    
    this.logger.log(`Extraindo ${entries.length} arquivos para ${modulePath}`);

    if (moduleInfo._hasParentFolder) {
      // Se o ZIP tem uma pasta pai com o nome do módulo, extrair apenas o conteúdo dessa pasta
      this.logger.log(`ZIP contém pasta pai "${moduleInfo.name}", extraindo conteúdo...`);
      
      const parentFolderPrefix = `${moduleInfo.name}/`;
      const filteredEntries = entries.filter(entry => 
        entry.entryName.startsWith(parentFolderPrefix) && 
        entry.entryName !== parentFolderPrefix
      );

      for (const entry of filteredEntries) {
        // Remover o prefixo da pasta pai do caminho
        const relativePath = entry.entryName.substring(parentFolderPrefix.length);
        const targetPath = path.join(modulePath, relativePath);

        if (entry.isDirectory) {
          // Criar diretório
          fs.mkdirSync(targetPath, { recursive: true });
        } else {
          // Criar diretório pai se necessário
          const targetDir = path.dirname(targetPath);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }
          
          // Extrair arquivo
          fs.writeFileSync(targetPath, entry.getData());
        }
      }

      this.logger.log(`${filteredEntries.length} arquivos extraídos (removendo pasta pai)`);
    } else {
      // Se não há pasta pai, extrair tudo diretamente
      this.logger.log('ZIP não contém pasta pai, extraindo tudo diretamente...');
      zip.extractAllTo(modulePath, true);
      this.logger.log('Todos os arquivos extraídos diretamente');
    }

    // Verificar se o module.json está no local correto
    const moduleJsonPath = path.join(modulePath, 'module.json');
    if (!fs.existsSync(moduleJsonPath)) {
      throw new BadRequestException('Erro na extração: module.json não encontrado no destino');
    }

    this.logger.log('Extração concluída com sucesso');
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