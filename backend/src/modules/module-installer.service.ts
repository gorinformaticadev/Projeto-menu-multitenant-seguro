import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@core/prisma/prisma.service';
import { ModuleMigrationService } from './module-migration.service';
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

  constructor(
    private prisma: PrismaService,
    private moduleMigrationService: ModuleMigrationService
  ) {
    // Criar diretÃ³rios se nÃ£o existirem
    this.ensureDirectories();
  }

  private ensureDirectories() {
    try {
      if (!fs.existsSync(this.modulesPath)) {
        this.logger.log(`Criando diretÃ³rio de mÃ³dulos: ${this.modulesPath}`);
        fs.mkdirSync(this.modulesPath, { recursive: true, mode: 0o755 });
      }
      if (!fs.existsSync(this.uploadsPath)) {
        this.logger.log(`Criando diretÃ³rio de uploads: ${this.uploadsPath}`);
        fs.mkdirSync(this.uploadsPath, { recursive: true, mode: 0o755 });
      }

      // Verificar permissÃµes de escrita
      fs.accessSync(this.modulesPath, fs.constants.W_OK);
      fs.accessSync(this.uploadsPath, fs.constants.W_OK);

      this.logger.log('DiretÃ³rios verificados e com permissÃ£o de escrita');
    } catch (error) {
      this.logger.error(`Erro ao verificar diretÃ³rios: ${error.message}`);
      throw new Error(`Erro de permissÃ£o nos diretÃ³rios: ${error.message}`);
    }
  }

  async uploadModule(file: Express.Multer.File): Promise<any> {
    this.logger.log(`Iniciando upload do mÃ³dulo: ${file.originalname}`);

    try {
      // Validar arquivo ZIP
      if (!file.originalname.endsWith('.zip')) {
        throw new BadRequestException('Apenas arquivos ZIP sÃ£o aceitos');
      }

      // Verificar se o buffer existe
      if (!file.buffer) {
        throw new BadRequestException('Arquivo nÃ£o contÃ©m dados vÃ¡lidos');
      }

      this.logger.log(`Tamanho do arquivo: ${file.size} bytes`);
      this.logger.log(`Tipo do buffer: ${typeof file.buffer}`);
      this.logger.log(`Ã‰ Buffer: ${Buffer.isBuffer(file.buffer)}`);

      // Salvar arquivo temporariamente
      const tempPath = path.join(this.uploadsPath, `temp_${Date.now()}_${file.originalname}`);

      try {
        // Garantir que temos um Buffer vÃ¡lido
        let bufferData: Buffer;

        if (Buffer.isBuffer(file.buffer)) {
          bufferData = file.buffer;
        } else {
          // Tentar converter para Buffer usando diferentes mÃ©todos
          try {
            // MÃ©todo 1: ConversÃ£o direta
            bufferData = Buffer.from(file.buffer as any);
          } catch (e1) {
            try {
              // MÃ©todo 2: Se for um objeto com propriedade data
              const bufferObj = file.buffer as any;
              if (bufferObj && bufferObj.data) {
                bufferData = Buffer.from(bufferObj.data);
              } else {
                // MÃ©todo 3: Converter valores do objeto
                bufferData = Buffer.from(Object.values(bufferObj || {}));
              }
            } catch (e2) {
              this.logger.error(`Falha em todas as tentativas de conversÃ£o: ${e1.message}, ${e2.message}`);
              throw new Error('NÃ£o foi possÃ­vel converter o buffer do arquivo');
            }
          }
        }

        fs.writeFileSync(tempPath, bufferData);
        this.logger.log(`Arquivo temporÃ¡rio salvo: ${tempPath} (${bufferData.length} bytes)`);
      } catch (error) {
        this.logger.error(`Erro ao salvar arquivo temporÃ¡rio: ${error.message}`);
        this.logger.error(`Tipo do file.buffer: ${typeof file.buffer}`);
        throw new BadRequestException(`Erro de permissÃ£o ao salvar arquivo: ${error.message}`);
      }

      // Descompactar e obter informaÃ§Ãµes do mÃ³dulo
      const moduleInfo = await this.extractModule(tempPath);

      // Limpar arquivo temporÃ¡rio
      fs.unlinkSync(tempPath);

      this.logger.log(`MÃ³dulo ${moduleInfo.name} descompactado com sucesso`);

      // Verificar se o mÃ³dulo jÃ¡ existe no banco
      const existingModule = await this.prisma.module.findUnique({
        where: { name: moduleInfo.name }
      });

      const modulePath = path.join(this.modulesPath, moduleInfo.name);

      // Executar migraÃ§Ãµes se existirem
      await this.runMigrations(moduleInfo, modulePath);

      // Instalar dependÃªncias NPM se existir package.json
      await this.installDependencies(modulePath);

      let moduleRecord;

      if (existingModule) {
        // Atualizar mÃ³dulo existente
        this.logger.log(`Atualizando registro do mÃ³dulo ${moduleInfo.name} no banco de dados...`);
        moduleRecord = await this.prisma.module.update({
          where: { name: moduleInfo.name },
          data: {
            displayName: moduleInfo.displayName,
            description: moduleInfo.description || '',
            version: moduleInfo.version,
            config: moduleInfo.config ? JSON.stringify(moduleInfo.config) : null,
            isActive: true // MantÃ©m ativo se jÃ¡ estava instalado
          }
        });
        this.logger.log(`MÃ³dulo ${moduleInfo.name} atualizado com sucesso`);
      } else {
        // Criar novo mÃ³dulo - INSTALADO MAS INATIVO GLOBALMENTE
        this.logger.log(`Registrando novo mÃ³dulo ${moduleInfo.name} no banco de dados...`);
        moduleRecord = await this.prisma.module.create({
          data: {
            name: moduleInfo.name,
            displayName: moduleInfo.displayName,
            description: moduleInfo.description || '',
            version: moduleInfo.version,
            config: moduleInfo.config ? JSON.stringify(moduleInfo.config) : null,
            isActive: true // MÃ³dulo instalado e disponÃ­vel globalmente
          }
        });
        this.logger.log(`MÃ³dulo ${moduleInfo.name} registrado com sucesso`);
        
        // NÃ£o criar automaticamente TenantModule para nenhuma tenant
        // Cada tenant deve ativar o mÃ³dulo individualmente
        this.logger.log(
          `MÃ³dulo ${moduleInfo.name} instalado globalmente. ` +
          `Tenants devem ativÃ¡-lo individualmente em suas configuraÃ§Ãµes.`
        );
      }

      // **NOVO:** Descobrir e registrar migrations/seeds apÃ³s instalaÃ§Ã£o
      try {
        this.logger.log(`Descobrindo migrations/seeds de ${moduleInfo.name}...`);
        await this.moduleMigrationService.discoverModuleMigrations(moduleInfo.name);
        this.logger.log(`Migrations/seeds descobertos e registrados`);
      } catch (error) {
        this.logger.warn(`Erro ao descobrir migrations (nÃ£o crÃ­tico): ${error.message}`);
      }

      return {
        success: true,
        module: {
          ...moduleInfo,
          id: moduleRecord.id,
          isActive: moduleRecord.isActive,
          createdAt: moduleRecord.createdAt,
          updatedAt: moduleRecord.updatedAt
        },
        message: existingModule
          ? `MÃ³dulo '${moduleInfo.name}' atualizado com sucesso`
          : `MÃ³dulo '${moduleInfo.name}' instalado com sucesso`,
        action: existingModule ? 'updated' : 'installed'
      };

    } catch (error) {
      this.logger.error(`Erro ao descompactar mÃ³dulo: ${error.message}`);
      throw error;
    }
  }

  private async extractModule(zipPath: string): Promise<any> {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    this.logger.log(`Descompactando ZIP com ${entries.length} arquivos`);

    // Procurar por module.json para obter o nome do mÃ³dulo
    let moduleJsonEntry = entries.find(entry => entry.entryName === 'module.json');

    if (!moduleJsonEntry) {
      // Procurar em subpastas
      moduleJsonEntry = entries.find(entry => entry.entryName.endsWith('/module.json'));
    }

    if (!moduleJsonEntry) {
      throw new BadRequestException('Arquivo module.json nÃ£o encontrado no ZIP');
    }

    // Ler apenas o nome do mÃ³dulo
    const moduleConfig = JSON.parse(moduleJsonEntry.getData().toString());
    const moduleName = moduleConfig.name;

    if (!moduleName) {
      throw new BadRequestException('Nome do mÃ³dulo nÃ£o encontrado no module.json');
    }

    this.logger.log(`MÃ³dulo identificado: ${moduleName}`);

    // Definir caminho de destino
    const modulePath = path.join(this.modulesPath, moduleName);

    // Verificar se a pasta do mÃ³dulo jÃ¡ existe
    if (fs.existsSync(modulePath)) {
      this.logger.log(`Pasta do mÃ³dulo ${moduleName} jÃ¡ existe, sobrescrevendo...`);
      try {
        fs.rmSync(modulePath, { recursive: true });
      } catch (error) {
        this.logger.error(`Erro ao remover pasta existente: ${error.message}`);
        throw new BadRequestException(`Erro de permissÃ£o ao remover pasta existente: ${error.message}`);
      }
    }

    // Criar diretÃ³rio do mÃ³dulo
    try {
      fs.mkdirSync(modulePath, { recursive: true, mode: 0o755 });
      this.logger.log(`DiretÃ³rio criado: ${modulePath}`);
    } catch (error) {
      this.logger.error(`Erro ao criar diretÃ³rio do mÃ³dulo: ${error.message}`);
      throw new BadRequestException(`Erro de permissÃ£o ao criar diretÃ³rio: ${error.message}`);
    }

    // Descompactar arquivos
    this.logger.log(`Descompactando para: ${modulePath}`);

    // Verificar se hÃ¡ pasta pai no ZIP
    const hasParentFolder = entries.some(entry => entry.entryName.startsWith(`${moduleName}/`));

    if (hasParentFolder) {
      // Extrair apenas o conteÃºdo da pasta do mÃ³dulo
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

    this.logger.log(`DescompactaÃ§Ã£o concluÃ­da para o mÃ³dulo: ${moduleName}`);

    return {
      name: moduleName,
      displayName: moduleConfig.displayName || moduleName,
      version: moduleConfig.version || '1.0.0',
      description: moduleConfig.description || '',
      config: moduleConfig.config || null,
      author: moduleConfig.author || null,
      category: moduleConfig.category || null
    };
  }

  private async extractAndValidateModule(zipPath: string): Promise<any> {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    this.logger.log(`Analisando conteÃºdo do ZIP: ${entries.length} arquivos encontrados`);

    // Procurar por module.json na raiz ou em subpastas
    let moduleJsonEntry = entries.find(entry => entry.entryName === 'module.json');

    if (!moduleJsonEntry) {
      // Procurar em subpastas (caso o ZIP tenha uma pasta pai)
      moduleJsonEntry = entries.find(entry => entry.entryName.endsWith('/module.json'));
    }

    if (!moduleJsonEntry) {
      this.logger.error('Arquivos no ZIP:', entries.map(e => e.entryName));
      throw new BadRequestException('Arquivo module.json nÃ£o encontrado no ZIP');
    }

    this.logger.log(`Arquivo module.json encontrado: ${moduleJsonEntry.entryName}`);

    // Ler configuraÃ§Ã£o do mÃ³dulo
    const moduleConfig = JSON.parse(moduleJsonEntry.getData().toString());
    this.logger.log(`ConfiguraÃ§Ã£o do mÃ³dulo: ${JSON.stringify(moduleConfig, null, 2)}`);

    // Validar campos obrigatÃ³rios
    if (!moduleConfig.name || !moduleConfig.displayName || !moduleConfig.version) {
      throw new BadRequestException('Campos obrigatÃ³rios ausentes no module.json (name, displayName, version)');
    }

    // Validar nome do mÃ³dulo (apenas letras, nÃºmeros, underscore e hÃ­fen)
    if (!/^[a-zA-Z0-9_-]+$/.test(moduleConfig.name)) {
      throw new BadRequestException('Nome do mÃ³dulo deve conter apenas letras, nÃºmeros, underscore e hÃ­fen');
    }

    // Verificar se hÃ¡ uma pasta pai no ZIP
    const hasParentFolder = entries.some(entry => entry.entryName.startsWith(`${moduleConfig.name}/`));
    moduleConfig._hasParentFolder = hasParentFolder;

    this.logger.log(`MÃ³dulo ${moduleConfig.name} validado com sucesso. Pasta pai no ZIP: ${hasParentFolder}`);

    return moduleConfig;
  }

  private async installNewModule(moduleInfo: any, zipPath: string): Promise<void> {
    const zip = new AdmZip(zipPath);
    const modulePath = path.join(this.modulesPath, moduleInfo.name);

    this.logger.log(`Instalando novo mÃ³dulo: ${moduleInfo.name}`);
    this.logger.log(`Caminho de destino: ${modulePath}`);

    // Verificar se a pasta do mÃ³dulo jÃ¡ existe
    const moduleExists = fs.existsSync(modulePath);
    this.logger.log(`Pasta do mÃ³dulo existe: ${moduleExists}`);

    if (moduleExists) {
      this.logger.log('Removendo pasta existente do mÃ³dulo...');
      fs.rmSync(modulePath, { recursive: true });
    }

    // Criar diretÃ³rio do mÃ³dulo
    this.logger.log('Criando diretÃ³rio do mÃ³dulo...');
    fs.mkdirSync(modulePath, { recursive: true });

    // Extrair arquivos baseado na estrutura do ZIP
    await this.extractModuleFiles(zip, moduleInfo, modulePath);

    // Executar migraÃ§Ãµes se existirem
    await this.runMigrations(moduleInfo, modulePath);

    // Instalar dependÃªncias NPM se existir package.json
    await this.installDependencies(modulePath);

    // Registrar mÃ³dulo no banco
    this.logger.log('Registrando mÃ³dulo no banco de dados...');
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

    this.logger.log(`MÃ³dulo ${moduleInfo.name} instalado com sucesso`);
  }

  private async updateExistingModule(moduleInfo: any, zipPath: string): Promise<void> {
    const zip = new AdmZip(zipPath);
    const modulePath = path.join(this.modulesPath, moduleInfo.name);

    this.logger.log(`Atualizando mÃ³dulo existente: ${moduleInfo.name}`);

    // Backup do mÃ³dulo atual
    const backupPath = path.join(this.modulesPath, `${moduleInfo.name}_backup_${Date.now()}`);
    if (fs.existsSync(modulePath)) {
      this.logger.log('Criando backup do mÃ³dulo atual...');
      fs.renameSync(modulePath, backupPath);
    }

    try {
      // Criar novo diretÃ³rio
      this.logger.log('Criando novo diretÃ³rio do mÃ³dulo...');
      fs.mkdirSync(modulePath, { recursive: true });

      // Extrair novos arquivos
      await this.extractModuleFiles(zip, moduleInfo, modulePath);

      // Executar migraÃ§Ãµes
      await this.runMigrations(moduleInfo, modulePath);

      // Instalar dependÃªncias
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
        this.logger.log('Removendo backup apÃ³s sucesso...');
        fs.rmSync(backupPath, { recursive: true });
      }

      this.logger.log(`MÃ³dulo ${moduleInfo.name} atualizado com sucesso`);

    } catch (error) {
      this.logger.error(`Erro na atualizaÃ§Ã£o, restaurando backup: ${error.message}`);
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
      this.logger.log(`Nenhuma migraÃ§Ã£o encontrada para o mÃ³dulo ${moduleInfo.name}`);
      return;
    }

    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const migrationFile of migrationFiles) {
      const migrationPath = path.join(migrationsPath, migrationFile);
      const migrationSql = fs.readFileSync(migrationPath, 'utf8');

      try {
        this.logger.log(`Executando migraÃ§Ã£o: ${migrationFile}`);
        
        // Dividir comandos SQL por ponto e vÃ­rgula e executar cada um separadamente
        const sqlCommands = this.splitSqlCommands(migrationSql);
        
        for (const [index, sqlCommand] of sqlCommands.entries()) {
          const cleanCommand = sqlCommand.trim();
          if (cleanCommand) {
            this.logger.log(`Executando comando ${index + 1}/${sqlCommands.length} da migraÃ§Ã£o ${migrationFile}`);
            await this.prisma.$executeRawUnsafe(cleanCommand);
          }
        }
        
        this.logger.log(`MigraÃ§Ã£o ${migrationFile} executada com sucesso`);
      } catch (error) {
        this.logger.error(`Erro ao executar migraÃ§Ã£o ${migrationFile}: ${error.message}`);
        throw new BadRequestException(`Erro na migraÃ§Ã£o ${migrationFile}: ${error.message}`);
      }
    }
  }

  private splitSqlCommands(sqlContent: string): string[] {
    // Dividir por ponto e vÃ­rgula, mas preservar comentÃ¡rios
    const commands: string[] = [];
    let currentCommand = '';
    let inComment = false;
    let inBlockComment = false;
    
    for (let i = 0; i < sqlContent.length; i++) {
      const char = sqlContent[i];
      const nextChar = sqlContent[i + 1];
      
      // Verificar inÃ­cio/fim de comentÃ¡rios
      if (!inBlockComment && char === '-' && nextChar === '-') {
        inComment = true;
      } else if (char === '\n') {
        inComment = false;
      } else if (char === '/' && nextChar === '*') {
        inBlockComment = true;
      } else if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++; // Pular o prÃ³ximo caractere
        continue;
      }
      
      // Adicionar caractere ao comando atual
      currentCommand += char;
      
      // Se encontramos um ponto e vÃ­rgula e nÃ£o estamos em comentÃ¡rio, finalizar comando
      if (char === ';' && !inComment && !inBlockComment) {
        if (currentCommand.trim()) {
          commands.push(currentCommand.trim());
        }
        currentCommand = '';
      }
    }
    
    // Adicionar Ãºltimo comando se existir
    if (currentCommand.trim()) {
      commands.push(currentCommand.trim());
    }
    
    return commands.filter(cmd => cmd.length > 0);
  }

  private async extractModuleFiles(zip: AdmZip, moduleInfo: any, modulePath: string): Promise<void> {
    const entries = zip.getEntries();

    this.logger.log(`Extraindo ${entries.length} arquivos para ${modulePath}`);

    if (moduleInfo._hasParentFolder) {
      // Se o ZIP tem uma pasta pai com o nome do mÃ³dulo, extrair apenas o conteÃºdo dessa pasta
      this.logger.log(`ZIP contÃ©m pasta pai "${moduleInfo.name}", extraindo conteÃºdo...`);

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
          // Criar diretÃ³rio
          fs.mkdirSync(targetPath, { recursive: true });
        } else {
          // Criar diretÃ³rio pai se necessÃ¡rio
          const targetDir = path.dirname(targetPath);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          // Extrair arquivo
          fs.writeFileSync(targetPath, entry.getData());
        }
      }

      this.logger.log(`${filteredEntries.length} arquivos extraÃ­dos (removendo pasta pai)`);
    } else {
      // Se nÃ£o hÃ¡ pasta pai, extrair tudo diretamente
      this.logger.log('ZIP nÃ£o contÃ©m pasta pai, extraindo tudo diretamente...');
      zip.extractAllTo(modulePath, true);
      this.logger.log('Todos os arquivos extraÃ­dos diretamente');
    }

    // Verificar se o module.json estÃ¡ no local correto
    const moduleJsonPath = path.join(modulePath, 'module.json');
    if (!fs.existsSync(moduleJsonPath)) {
      throw new BadRequestException('Erro na extraÃ§Ã£o: module.json nÃ£o encontrado no destino');
    }

    this.logger.log('ExtraÃ§Ã£o concluÃ­da com sucesso');
  }

  private async installDependencies(modulePath: string): Promise<void> {
    const packageJsonPath = path.join(modulePath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
      this.logger.log('Nenhum package.json encontrado, pulando instalaÃ§Ã£o de dependÃªncias');
      return;
    }

    try {
      this.logger.log('Instalando dependÃªncias do mÃ³dulo...');
      await execAsync('npm install', { cwd: modulePath });
      this.logger.log('DependÃªncias instaladas com sucesso');
    } catch (error) {
      this.logger.warn(`Aviso: Erro ao instalar dependÃªncias: ${error.message}`);
      // NÃ£o falhar a instalaÃ§Ã£o por causa das dependÃªncias
    }
  }

  async removeModule(moduleName: string): Promise<any> {
    this.logger.log(`Iniciando remoÃ§Ã£o do mÃ³dulo: ${moduleName}`);

    try {
      // Verificar se mÃ³dulo existe
      const module = await this.prisma.module.findUnique({
        where: { name: moduleName }
      });

      if (!module) {
        throw new BadRequestException(`MÃ³dulo '${moduleName}' nÃ£o encontrado`);
      }

      // Verificar se hÃ¡ tenants com este mÃ³dulo ativo
      const activeTenantModules = await this.prisma.tenantModule.findMany({
        where: {
          moduleName,
          isActive: true
        },
        include: {
          tenant: {
            select: {
              id: true,
              nomeFantasia: true,
              email: true
            }
          }
        }
      });

      if (activeTenantModules.length > 0) {
        const tenantNames = activeTenantModules
          .map(tm => tm.tenant.nomeFantasia)
          .join(', ');

        this.logger.warn(
          `Tentativa de remover mÃ³dulo '${moduleName}' bloqueada. ` +
          `MÃ³dulo ativo em ${activeTenantModules.length} tenant(s): ${tenantNames}`
        );

        throw new BadRequestException(
          `NÃ£o Ã© possÃ­vel remover o mÃ³dulo '${moduleName}' pois estÃ¡ ativo em ${activeTenantModules.length} tenant(s): ${tenantNames}. ` +
          `Desative o mÃ³dulo em todos os tenants antes de desinstalÃ¡-lo.`
        );
      }

      // Remover arquivos fÃ­sicos
      const modulePath = path.join(this.modulesPath, moduleName);
      if (fs.existsSync(modulePath)) {
        fs.rmSync(modulePath, { recursive: true });
      }

      // Remover do banco
      await this.prisma.module.delete({
        where: { name: moduleName }
      });

      this.logger.log(`MÃ³dulo ${moduleName} removido com sucesso`);
      return {
        success: true,
        message: `MÃ³dulo '${moduleName}' removido com sucesso`
      };

    } catch (error) {
      this.logger.error(`Erro ao remover mÃ³dulo: ${error.message}`);
      throw error;
    }
  }

  async getModuleTenants(moduleName: string): Promise<any> {
    this.logger.log(`Buscando tenants que usam o mÃ³dulo: ${moduleName}`);

    // Verificar se mÃ³dulo existe
    const module = await this.prisma.module.findUnique({
      where: { name: moduleName }
    });

    if (!module) {
      throw new BadRequestException(`MÃ³dulo '${moduleName}' nÃ£o encontrado`);
    }

    // Buscar todos os tenants que tÃªm este mÃ³dulo (ativos e inativos)
    const tenantModules = await this.prisma.tenantModule.findMany({
      where: {
        moduleName
      },
      include: {
        tenant: {
          select: {
            id: true,
            nomeFantasia: true,
            email: true,
            ativo: true
          }
        }
      },
      orderBy: [
        { isActive: 'desc' }, // Ativos primeiro
        { tenant: { nomeFantasia: 'asc' } }
      ]
    });

    const activeTenants = tenantModules.filter(tm => tm.isActive);
    const inactiveTenants = tenantModules.filter(tm => !tm.isActive);

    return {
      module: {
        name: module.name,
        displayName: module.displayName,
        version: module.version
      },
      summary: {
        total: tenantModules.length,
        active: activeTenants.length,
        inactive: inactiveTenants.length,
        canUninstall: activeTenants.length === 0
      },
      activeTenants: activeTenants.map(tm => ({
        tenantId: tm.tenant.id,
        tenantName: tm.tenant.nomeFantasia,
        tenantEmail: tm.tenant.email,
        tenantActive: tm.tenant.ativo,
        activatedAt: tm.activatedAt,
        config: tm.config ? JSON.parse(tm.config) : null
      })),
      inactiveTenants: inactiveTenants.map(tm => ({
        tenantId: tm.tenant.id,
        tenantName: tm.tenant.nomeFantasia,
        tenantEmail: tm.tenant.email,
        tenantActive: tm.tenant.ativo,
        deactivatedAt: tm.deactivatedAt,
        config: tm.config ? JSON.parse(tm.config) : null
      }))
    };
  }

  async listInstalledModules(): Promise<any[]> {
    const modules = await this.prisma.module.findMany({
      orderBy: { displayName: 'asc' }
    });

    const modulesWithUpdates = await Promise.all(
      modules.map(async (module) => {
        const modulePath = path.join(this.modulesPath, module.name);
        const isInstalled = fs.existsSync(modulePath);

        // **NOVO:** Usar ModuleMigrationService para verificar pendÃªncias
        let hasDatabaseUpdates = false;
        let pendingMigrationsCount = 0;
        let pendingSeedsCount = 0;
        let failedMigrationsCount = 0;
        let migrationStatus: 'updated' | 'pending' | 'error' | 'unknown' = 'unknown';
        
        if (isInstalled) {
          try {
            // Obter contadores de migrations/seeds
            const counts = await this.moduleMigrationService.getMigrationCounts(module.name);
            
            pendingMigrationsCount = counts.pendingMigrations;
            pendingSeedsCount = counts.pendingSeeds;
            failedMigrationsCount = counts.failedMigrations + counts.failedSeeds;
            
            // Verificar se hÃ¡ pendÃªncias
            hasDatabaseUpdates = await this.moduleMigrationService.hasPendingUpdates(module.name);
            
            // Determinar status visual
            if (failedMigrationsCount > 0) {
              migrationStatus = 'error';
            } else if (hasDatabaseUpdates) {
              migrationStatus = 'pending';
            } else if (counts.completedMigrations > 0 || counts.completedSeeds > 0) {
              migrationStatus = 'updated';
            } else {
              migrationStatus = 'unknown';
            }
            
          } catch (error) {
            this.logger.warn(`Erro ao verificar migrations de ${module.name}: ${error.message}`);
            migrationStatus = 'unknown';
          }
        }

        return {
          ...module,
          config: module.config ? JSON.parse(module.config) : null,
          isInstalled,
          hasDatabaseUpdates,
          pendingMigrationsCount,
          pendingSeedsCount,
          failedMigrationsCount,
          migrationStatus,
          databaseVersion: module.databaseVersion
        };
      })
    );

    return modulesWithUpdates;
  }

  async getModuleInfo(moduleName: string): Promise<any> {
    const module = await this.prisma.module.findUnique({
      where: { name: moduleName }
    });

    if (!module) {
      throw new BadRequestException(`MÃ³dulo '${moduleName}' nÃ£o encontrado`);
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

  async updateModuleDatabase(moduleName: string, userId?: string): Promise<any> {
    this.logger.log(`Iniciando atualizaÃ§Ã£o do banco de dados para o mÃ³dulo: ${moduleName}`);

    try {
      // Verificar se mÃ³dulo existe
      const module = await this.prisma.module.findUnique({
        where: { name: moduleName }
      });

      if (!module) {
        throw new BadRequestException(`MÃ³dulo '${moduleName}' nÃ£o encontrado`);
      }

      const modulePath = path.join(this.modulesPath, moduleName);
      if (!fs.existsSync(modulePath)) {
        throw new BadRequestException(`Arquivos do mÃ³dulo '${moduleName}' nÃ£o encontrados no sistema`);
      }

      // **NOVO:** Verificar se hÃ¡ pendÃªncias antes de executar
      const hasPending = await this.moduleMigrationService.hasPendingUpdates(moduleName);
      if (!hasPending) {
        this.logger.log(`Nenhuma migration/seed pendente para ${moduleName}`);
        return {
          success: true,
          message: `Nenhuma atualizaÃ§Ã£o pendente para o mÃ³dulo '${moduleName}'`,
          executed: [],
          timestamp: new Date().toISOString()
        };
      }

      // Criar backup antes de executar as operaÃ§Ãµes
      const backupPath = await this.createDatabaseBackup(moduleName);

      try {
        // **NOVO:** Executar migrations usando novo service
        const migrationResults = await this.moduleMigrationService.executePendingMigrations(
          moduleName,
          userId
        );
  
        // **NOVO:** Executar seeds usando novo service
        const seedResults = await this.moduleMigrationService.executePendingSeeds(
          moduleName,
          userId
        );
  
        // Atualizar versÃ£o do banco no mÃ³dulo
        await this.prisma.module.update({
          where: { name: moduleName },
          data: { databaseVersion: module.version }
        });
  
        this.logger.log(`Banco de dados atualizado com sucesso para o mÃ³dulo ${moduleName}`);
        this.logger.log(`VersÃ£o do banco atualizada para: ${module.version}`);
  
        return {
          success: true,
          message: `Banco de dados atualizado com sucesso para o mÃ³dulo '${moduleName}' (versÃ£o ${module.version})`,
          backupPath,
          databaseVersion: module.version,
          migrationsExecuted: migrationResults.length,
          seedsExecuted: seedResults.length,
          results: {
            migrations: migrationResults,
            seeds: seedResults
          },
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        // Em caso de erro, tentar restaurar backup
        this.logger.error(`Erro na atualizaÃ§Ã£o, tentando restaurar backup: ${error.message}`);
        await this.restoreDatabaseBackup(backupPath);
        throw error;
      }

    } catch (error) {
      this.logger.error(`Erro ao atualizar banco de dados do mÃ³dulo ${moduleName}: ${error.message}`);
      throw error;
    }
  }

  async checkModuleUpdates(moduleName: string): Promise<any> {
    this.logger.log(`Verificando atualizaÃ§Ãµes para o mÃ³dulo: ${moduleName}`);

    try {
      const module = await this.prisma.module.findUnique({
        where: { name: moduleName }
      });

      if (!module) {
        throw new BadRequestException(`MÃ³dulo '${moduleName}' nÃ£o encontrado`);
      }

      const modulePath = path.join(this.modulesPath, moduleName);
      if (!fs.existsSync(modulePath)) {
        return {
          hasUpdates: false,
          reason: 'Module files not found'
        };
      }

      // Verificar se hÃ¡ migraÃ§Ãµes
      const migrationsPath = path.join(modulePath, 'migrations');
      const hasMigrations = fs.existsSync(migrationsPath) &&
        fs.readdirSync(migrationsPath).filter(file => file.endsWith('.sql')).length > 0;

      // Verificar se hÃ¡ seed
      const hasSeed = fs.existsSync(path.join(modulePath, 'seed.sql'));

      return {
        hasUpdates: hasMigrations || hasSeed,
        migrations: hasMigrations ? this.getMigrationList(migrationsPath) : [],
        hasSeed,
        needsUpdate: hasMigrations || hasSeed
      };

    } catch (error) {
      this.logger.error(`Erro ao verificar atualizaÃ§Ãµes do mÃ³dulo ${moduleName}: ${error.message}`);
      throw error;
    }
  }

  private async createDatabaseBackup(moduleName: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup_${moduleName}_${timestamp}.sql`;
    const backupPath = path.join(this.uploadsPath, 'backups', backupFileName);

    // Criar diretÃ³rio de backups se nÃ£o existir
    const backupsDir = path.dirname(backupPath);
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }

    try {
      // Criar backup usando mysqldump (se disponÃ­vel) ou mÃ©todo alternativo
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl && dbUrl.includes('mysql')) {
        // Backup MySQL usando mysqldump
        const dbName = dbUrl.split('/').pop()?.split('?')[0];
        const dbUser = dbUrl.match(/mysql:\/\/([^:]+):/)?.[1] || 'root';
        const dbHost = dbUrl.match(/mysql:\/\/[^@]+@([^:]+):/)?.[1] || 'localhost';
        
        const mysqldumpCmd = `mysqldump -h ${dbHost} -u ${dbUser} ${dbName} > ${backupPath}`;
        await execAsync(mysqldumpCmd);
      } else {
        // Backup alternativo - criar arquivo vazio como placeholder
        fs.writeFileSync(backupPath, `-- Backup created for module ${moduleName} at ${timestamp}\n-- Note: Automated backup requires mysqldump configuration\n`);
      }

      this.logger.log(`Backup criado: ${backupPath}`);
      return backupPath;

    } catch (error) {
      this.logger.warn(`Aviso: NÃ£o foi possÃ­vel criar backup automÃ¡tico: ${error.message}`);
      // Retornar caminho mesmo com erro para nÃ£o bloquear o processo
      return backupPath;
    }
  }

  private async restoreDatabaseBackup(backupPath: string): Promise<void> {
    if (!fs.existsSync(backupPath)) {
      this.logger.warn(`Backup nÃ£o encontrado: ${backupPath}`);
      return;
    }

    try {
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl && dbUrl.includes('mysql')) {
        // Restaurar MySQL usando mysql
        const dbName = dbUrl.split('/').pop()?.split('?')[0];
        const dbUser = dbUrl.match(/mysql:\/\/([^:]+):/)?.[1] || 'root';
        const dbHost = dbUrl.match(/mysql:\/\/[^@]+@([^:]+):/)?.[1] || 'localhost';
        
        const mysqlCmd = `mysql -h ${dbHost} -u ${dbUser} ${dbName} < ${backupPath}`;
        await execAsync(mysqlCmd);
        
        this.logger.log(`Backup restaurado: ${backupPath}`);
      } else {
        this.logger.warn('Restore nÃ£o suportado para este tipo de banco de dados');
      }
    } catch (error) {
      this.logger.error(`Erro ao restaurar backup: ${error.message}`);
      throw new BadRequestException(`Erro ao restaurar backup: ${error.message}`);
    }
  }

  private async runSeed(moduleName: string, modulePath: string): Promise<void> {
    const seedPath = path.join(modulePath, 'seed.sql');

    if (!fs.existsSync(seedPath)) {
      this.logger.log(`Nenhum seed encontrado para o mÃ³dulo ${moduleName}`);
      return;
    }

    try {
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      this.logger.log(`Executando seed para o mÃ³dulo ${moduleName}`);
      
      // Dividir comandos SQL por ponto e vÃ­rgula e executar cada um separadamente
      const sqlCommands = this.splitSqlCommands(seedSql);
      
      for (const [index, sqlCommand] of sqlCommands.entries()) {
        const cleanCommand = sqlCommand.trim();
        if (cleanCommand) {
          this.logger.log(`Executando comando ${index + 1}/${sqlCommands.length} do seed`);
          await this.prisma.$executeRawUnsafe(cleanCommand);
        }
      }
      
      this.logger.log(`Seed executado com sucesso para o mÃ³dulo ${moduleName}`);
    } catch (error) {
      this.logger.error(`Erro ao executar seed para o mÃ³dulo ${moduleName}: ${error.message}`);
      throw new BadRequestException(`Erro no seed: ${error.message}`);
    }
  }

  private getMigrationList(migrationsPath: string): string[] {
    if (!fs.existsSync(migrationsPath)) {
      return [];
    }

    return fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();
  }

  /**
   * Compara duas versÃµes semÃ¢nticas
   * @param version1 VersÃ£o atual do mÃ³dulo
   * @param version2 VersÃ£o do banco de dados
   * @returns 1 se version1 > version2, -1 se version1 < version2, 0 se iguais
   */
  private compareVersions(version1: string, version2: string): number {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  }
}
