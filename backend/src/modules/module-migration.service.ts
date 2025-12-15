import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Serviço responsável pelo controle de migrations e seeds de módulos
 * 
 * Funcionalidades:
 * - Descoberta de arquivos de migrations e seeds
 * - Cálculo de checksums (SHA-256)
 * - Registro e rastreamento de execuções
 * - Execução controlada de migrations/seeds
 * - Verificação de pendências
 */
@Injectable()
export class ModuleMigrationService {
  private readonly logger = new Logger(ModuleMigrationService.name);
  private readonly modulesPath: string;

  constructor(private readonly prisma: PrismaService) {
    this.modulesPath = path.join(process.cwd(), '..', 'modules');
  }

  /**
   * Calcula o checksum SHA-256 de um arquivo
   */
  calculateFileChecksum(filePath: string): string {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const hashSum = crypto.createHash('sha256');
      hashSum.update(fileBuffer);
      return hashSum.digest('hex');
    } catch (error) {
      this.logger.error(`Erro ao calcular checksum do arquivo ${filePath}: ${error.message}`);
      throw new BadRequestException(`Erro ao calcular checksum: ${error.message}`);
    }
  }

  /**
   * Descobre e registra migrations/seeds de um módulo
   * 
   * Escaneia a pasta do módulo em busca de:
   * - Arquivos .sql na pasta migrations/
   * - Arquivo seed.sql na raiz ou pasta seeds/
   * 
   * Para cada arquivo encontrado:
   * - Calcula checksum
   * - Verifica se já existe registro na tabela
   * - Cria novo registro se não existir ou se checksum mudou
   */
  async discoverModuleMigrations(moduleName: string): Promise<void> {
    this.logger.log(`Iniciando descoberta de migrations para o módulo: ${moduleName}`);

    try {
      // Verificar se módulo existe
      const module = await this.prisma.module.findUnique({
        where: { name: moduleName }
      });

      if (!module) {
        throw new BadRequestException(`Módulo '${moduleName}' não encontrado no banco de dados`);
      }

      const modulePath = path.join(this.modulesPath, moduleName);
      
      if (!fs.existsSync(modulePath)) {
        this.logger.warn(`Pasta do módulo '${moduleName}' não encontrada: ${modulePath}`);
        return;
      }

      // Descobrir migrations
      await this.discoverMigrations(moduleName, modulePath);

      // Descobrir seeds
      await this.discoverSeeds(moduleName, modulePath);

      this.logger.log(`Descoberta concluída para o módulo: ${moduleName}`);
    } catch (error) {
      this.logger.error(`Erro na descoberta de migrations para ${moduleName}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Descobre arquivos de migration na pasta migrations/
   */
  private async discoverMigrations(moduleName: string, modulePath: string): Promise<void> {
    const migrationsPath = path.join(modulePath, 'migrations');

    if (!fs.existsSync(migrationsPath)) {
      this.logger.log(`Nenhuma pasta 'migrations' encontrada para ${moduleName}`);
      return;
    }

    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Ordenação alfabética

    this.logger.log(`Encontradas ${migrationFiles.length} migrations em ${moduleName}`);

    for (const fileName of migrationFiles) {
      const filePath = path.join(migrationsPath, fileName);
      await this.registerMigrationFile(moduleName, fileName, filePath, 'MIGRATION');
    }
  }

  /**
   * Descobre arquivos de seed
   */
  private async discoverSeeds(moduleName: string, modulePath: string): Promise<void> {
    // Verificar seed.sql na raiz
    const seedPathRoot = path.join(modulePath, 'seed.sql');
    if (fs.existsSync(seedPathRoot)) {
      await this.registerMigrationFile(moduleName, 'seed.sql', seedPathRoot, 'SEED');
      return;
    }

    // Verificar pasta seeds/
    const seedsPath = path.join(modulePath, 'seeds');
    if (!fs.existsSync(seedsPath)) {
      this.logger.log(`Nenhum seed encontrado para ${moduleName}`);
      return;
    }

    const seedFiles = fs.readdirSync(seedsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    this.logger.log(`Encontrados ${seedFiles.length} seeds em ${moduleName}`);

    for (const fileName of seedFiles) {
      const filePath = path.join(seedsPath, fileName);
      await this.registerMigrationFile(moduleName, fileName, filePath, 'SEED');
    }
  }

  /**
   * Registra um arquivo de migration/seed na tabela de controle
   * 
   * Lógica:
   * - Se não existe registro: cria com status PENDING
   * - Se existe com mesmo checksum: mantém
   * - Se existe com checksum diferente: cria novo registro com sufixo _v2, _v3, etc
   */
  private async registerMigrationFile(
    moduleName: string,
    fileName: string,
    filePath: string,
    type: 'MIGRATION' | 'SEED'
  ): Promise<void> {
    const checksum = this.calculateFileChecksum(filePath);

    // Buscar registro existente
    const existing = await this.prisma.moduleMigration.findUnique({
      where: {
        moduleName_fileName_type: {
          moduleName,
          fileName,
          type
        }
      }
    });

    if (!existing) {
      // Criar novo registro
      await this.prisma.moduleMigration.create({
        data: {
          moduleName,
          fileName,
          type,
          checksum,
          status: 'PENDING'
        }
      });
      this.logger.log(`Registrado novo ${type}: ${fileName} em ${moduleName}`);
    } else if (existing.checksum !== checksum) {
      // Checksum diferente - arquivo foi modificado
      this.logger.warn(
        `Arquivo ${fileName} de ${moduleName} foi modificado. ` +
        `Checksum antigo: ${existing.checksum.substring(0, 8)}... ` +
        `Novo: ${checksum.substring(0, 8)}...`
      );

      // Se o arquivo já foi executado (COMPLETED), criar nova versão
      if (existing.status === 'COMPLETED') {
        const newFileName = await this.generateVersionedFileName(fileName, moduleName, type);
        await this.prisma.moduleMigration.create({
          data: {
            moduleName,
            fileName: newFileName,
            type,
            checksum,
            status: 'PENDING'
          }
        });
        this.logger.log(`Criada nova versão: ${newFileName} para ${moduleName}`);
      } else {
        // Se ainda está PENDING ou FAILED, atualizar checksum
        await this.prisma.moduleMigration.update({
          where: { id: existing.id },
          data: { checksum }
        });
        this.logger.log(`Checksum atualizado para ${fileName} em ${moduleName}`);
      }
    } else {
      this.logger.log(`${type} ${fileName} de ${moduleName} já registrado (sem alterações)`);
    }
  }

  /**
   * Gera nome versionado para arquivo modificado
   * Ex: 001_create_table.sql -> 001_create_table_v2.sql
   */
  private async generateVersionedFileName(
    fileName: string,
    moduleName: string,
    type: 'MIGRATION' | 'SEED'
  ): Promise<string> {
    const baseName = fileName.replace('.sql', '');
    let version = 2;
    let newFileName: string;

    // Buscar próxima versão disponível
    do {
      newFileName = `${baseName}_v${version}.sql`;
      const existing = await this.prisma.moduleMigration.findUnique({
        where: {
          moduleName_fileName_type: {
            moduleName,
            fileName: newFileName,
            type
          }
        }
      });
      if (!existing) break;
      version++;
    } while (version < 100); // Limite de segurança

    return newFileName;
  }

  /**
   * Retorna lista de migrations pendentes de um módulo
   */
  async getPendingMigrations(moduleName: string) {
    return this.prisma.moduleMigration.findMany({
      where: {
        moduleName,
        type: 'MIGRATION',
        status: 'PENDING'
      },
      orderBy: {
        fileName: 'asc' // Ordem alfabética
      }
    });
  }

  /**
   * Retorna lista de seeds pendentes de um módulo
   */
  async getPendingSeeds(moduleName: string) {
    return this.prisma.moduleMigration.findMany({
      where: {
        moduleName,
        type: 'SEED',
        status: 'PENDING'
      },
      orderBy: {
        fileName: 'asc'
      }
    });
  }

  /**
   * Verifica se há migrations ou seeds pendentes
   */
  async hasPendingUpdates(moduleName: string): Promise<boolean> {
    const count = await this.prisma.moduleMigration.count({
      where: {
        moduleName,
        status: 'PENDING'
      }
    });

    return count > 0;
  }

  /**
   * Retorna contadores de migrations/seeds por status
   */
  async getMigrationCounts(moduleName: string) {
    const migrations = await this.prisma.moduleMigration.groupBy({
      by: ['type', 'status'],
      where: { moduleName },
      _count: true
    });

    const result = {
      pendingMigrations: 0,
      pendingSeeds: 0,
      completedMigrations: 0,
      completedSeeds: 0,
      failedMigrations: 0,
      failedSeeds: 0
    };

    migrations.forEach(item => {
      const key = `${item.status.toLowerCase()}${item.type === 'MIGRATION' ? 'Migrations' : 'Seeds'}`;
      if (key in result) {
        result[key] = item._count;
      }
    });

    return result;
  }

  /**
   * Retorna status detalhado de todas as migrations/seeds de um módulo
   */
  async getMigrationStatus(moduleName: string) {
    const [migrations, seeds, counts] = await Promise.all([
      this.prisma.moduleMigration.findMany({
        where: {
          moduleName,
          type: 'MIGRATION'
        },
        orderBy: {
          fileName: 'asc'
        }
      }),
      this.prisma.moduleMigration.findMany({
        where: {
          moduleName,
          type: 'SEED'
        },
        orderBy: {
          fileName: 'asc'
        }
      }),
      this.getMigrationCounts(moduleName)
    ]);

    return {
      moduleName,
      ...counts,
      migrations,
      seeds
    };
  }

  /**
   * Marca migration como executada com sucesso
   */
  async markMigrationAsExecuted(
    id: string,
    executionTime: number,
    executedBy?: string
  ): Promise<void> {
    await this.prisma.moduleMigration.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        executedAt: new Date(),
        executionTime,
        executedBy,
        errorMessage: null // Limpar erro anterior se houver
      }
    });
  }

  /**
   * Marca migration como falhada
   */
  async markMigrationAsFailed(id: string, errorMessage: string): Promise<void> {
    await this.prisma.moduleMigration.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorMessage
      }
    });
  }

  /**
   * Marca migration como em execução
   */
  async markMigrationAsExecuting(id: string): Promise<void> {
    await this.prisma.moduleMigration.update({
      where: { id },
      data: {
        status: 'EXECUTING'
      }
    });
  }

  /**
   * Obtém caminho do arquivo de migration/seed
   */
  getFilePath(moduleName: string, fileName: string, type: 'MIGRATION' | 'SEED'): string {
    const modulePath = path.join(this.modulesPath, moduleName);
    
    if (type === 'MIGRATION') {
      // Remover sufixo de versão para encontrar arquivo original
      const cleanFileName = fileName.replace(/_v\d+\.sql$/, '.sql');
      return path.join(modulePath, 'migrations', cleanFileName);
    } else {
      // SEED
      if (fileName === 'seed.sql') {
        return path.join(modulePath, 'seed.sql');
      }
      return path.join(modulePath, 'seeds', fileName);
    }
  }

  /**
   * Divide comandos SQL por ponto e vírgula preservando comentários
   */
  private splitSqlCommands(sqlContent: string): string[] {
    const commands: string[] = [];
    let currentCommand = '';
    let inComment = false;
    let inBlockComment = false;
    
    for (let i = 0; i < sqlContent.length; i++) {
      const char = sqlContent[i];
      const nextChar = sqlContent[i + 1];
      
      // Verificar início/fim de comentários
      if (!inBlockComment && char === '-' && nextChar === '-') {
        inComment = true;
      } else if (char === '\n') {
        inComment = false;
      } else if (char === '/' && nextChar === '*') {
        inBlockComment = true;
      } else if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++; // Pular o próximo caractere
        continue;
      }
      
      // Adicionar caractere ao comando atual
      currentCommand += char;
      
      // Se encontramos um ponto e vírgula e não estamos em comentário, finalizar comando
      if (char === ';' && !inComment && !inBlockComment) {
        if (currentCommand.trim()) {
          commands.push(currentCommand.trim());
        }
        currentCommand = '';
      }
    }
    
    // Adicionar último comando se existir
    if (currentCommand.trim()) {
      commands.push(currentCommand.trim());
    }
    
    return commands.filter(cmd => cmd.length > 0);
  }

  /**
   * Executa uma lista de migrations pendentes
   * 
   * Retorna array com resultados de cada migration:
   * - id: ID do registro
   * - fileName: Nome do arquivo
   * - success: true/false
   * - executionTime: tempo em ms
   * - error: mensagem de erro se falhou
   */
  async executePendingMigrations(
    moduleName: string,
    userId?: string
  ): Promise<any[]> {
    const pendingMigrations = await this.getPendingMigrations(moduleName);
    
    if (pendingMigrations.length === 0) {
      this.logger.log(`Nenhuma migration pendente para ${moduleName}`);
      return [];
    }

    this.logger.log(
      `Executando ${pendingMigrations.length} migrations pendentes de ${moduleName}`
    );

    const results = [];

    for (const migration of pendingMigrations) {
      const startTime = Date.now();
      
      try {
        // Marcar como em execução
        await this.markMigrationAsExecuting(migration.id);

        // Obter caminho do arquivo
        const filePath = this.getFilePath(moduleName, migration.fileName, 'MIGRATION');
        
        if (!fs.existsSync(filePath)) {
          throw new Error(`Arquivo de migration não encontrado: ${filePath}`);
        }

        // Ler conteúdo
        const sqlContent = fs.readFileSync(filePath, 'utf8');
        
        // Dividir em comandos e executar
        const commands = this.splitSqlCommands(sqlContent);
        
        for (const [index, command] of commands.entries()) {
          if (command.trim()) {
            this.logger.log(
              `Executando comando ${index + 1}/${commands.length} de ${migration.fileName}`
            );
            await this.prisma.$executeRawUnsafe(command);
          }
        }

        const executionTime = Date.now() - startTime;

        // Marcar como concluída
        await this.markMigrationAsExecuted(migration.id, executionTime, userId);

        this.logger.log(
          `Migration ${migration.fileName} executada com sucesso (${executionTime}ms)`
        );

        results.push({
          id: migration.id,
          fileName: migration.fileName,
          success: true,
          executionTime
        });

      } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage = error.message || 'Erro desconhecido';

        // Marcar como falhada
        await this.markMigrationAsFailed(migration.id, errorMessage);

        this.logger.error(
          `Erro ao executar migration ${migration.fileName}: ${errorMessage}`
        );

        results.push({
          id: migration.id,
          fileName: migration.fileName,
          success: false,
          executionTime,
          error: errorMessage
        });

        // Interromper execução em caso de erro
        throw new BadRequestException(
          `Erro na migration ${migration.fileName}: ${errorMessage}`
        );
      }
    }

    return results;
  }

  /**
   * Executa seeds pendentes
   */
  async executePendingSeeds(
    moduleName: string,
    userId?: string
  ): Promise<any[]> {
    const pendingSeeds = await this.getPendingSeeds(moduleName);
    
    if (pendingSeeds.length === 0) {
      this.logger.log(`Nenhum seed pendente para ${moduleName}`);
      return [];
    }

    this.logger.log(
      `Executando ${pendingSeeds.length} seeds pendentes de ${moduleName}`
    );

    const results = [];

    for (const seed of pendingSeeds) {
      const startTime = Date.now();
      
      try {
        // Marcar como em execução
        await this.markMigrationAsExecuting(seed.id);

        // Obter caminho do arquivo
        const filePath = this.getFilePath(moduleName, seed.fileName, 'SEED');
        
        if (!fs.existsSync(filePath)) {
          throw new Error(`Arquivo de seed não encontrado: ${filePath}`);
        }

        // Ler conteúdo
        const sqlContent = fs.readFileSync(filePath, 'utf8');
        
        // Dividir em comandos e executar
        const commands = this.splitSqlCommands(sqlContent);
        
        for (const [index, command] of commands.entries()) {
          if (command.trim()) {
            this.logger.log(
              `Executando comando ${index + 1}/${commands.length} de ${seed.fileName}`
            );
            await this.prisma.$executeRawUnsafe(command);
          }
        }

        const executionTime = Date.now() - startTime;

        // Marcar como concluída
        await this.markMigrationAsExecuted(seed.id, executionTime, userId);

        this.logger.log(
          `Seed ${seed.fileName} executado com sucesso (${executionTime}ms)`
        );

        results.push({
          id: seed.id,
          fileName: seed.fileName,
          success: true,
          executionTime
        });

      } catch (error) {
        const executionTime = Date.now() - startTime;
        const errorMessage = error.message || 'Erro desconhecido';

        // Marcar como falhada
        await this.markMigrationAsFailed(seed.id, errorMessage);

        this.logger.error(
          `Erro ao executar seed ${seed.fileName}: ${errorMessage}`
        );

        results.push({
          id: seed.id,
          fileName: seed.fileName,
          success: false,
          executionTime,
          error: errorMessage
        });

        // Seeds não interrompem fluxo, apenas logam erro
        // Mas ainda lançam exceção para tratamento externo
        throw new BadRequestException(
          `Erro no seed ${seed.fileName}: ${errorMessage}`
        );
      }
    }

    return results;
  }

  /**
   * Reexecuta uma migration que falhou
   * Apenas migrations com status FAILED podem ser reexecutadas
   */
  async retryFailedMigration(
    migrationId: string,
    userId?: string
  ): Promise<any> {
    const migration = await this.prisma.moduleMigration.findUnique({
      where: { id: migrationId }
    });

    if (!migration) {
      throw new BadRequestException('Migration não encontrada');
    }

    if (migration.status !== 'FAILED') {
      throw new BadRequestException(
        'Apenas migrations com status FAILED podem ser reexecutadas'
      );
    }

    this.logger.log(`Reexecutando migration falhada: ${migration.fileName}`);

    const startTime = Date.now();

    try {
      // Marcar como em execução
      await this.markMigrationAsExecuting(migration.id);

      // Obter caminho do arquivo e recalcular checksum
      const filePath = this.getFilePath(
        migration.moduleName,
        migration.fileName,
        migration.type as 'MIGRATION' | 'SEED'
      );
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo não encontrado: ${filePath}`);
      }

      // Recalcular checksum (pode ter sido corrigido)
      const newChecksum = this.calculateFileChecksum(filePath);
      if (newChecksum !== migration.checksum) {
        this.logger.log(
          `Checksum alterado para ${migration.fileName}, atualizando...`
        );
        await this.prisma.moduleMigration.update({
          where: { id: migration.id },
          data: { checksum: newChecksum }
        });
      }

      // Ler e executar
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      const commands = this.splitSqlCommands(sqlContent);
      
      for (const [index, command] of commands.entries()) {
        if (command.trim()) {
          this.logger.log(
            `Executando comando ${index + 1}/${commands.length}`
          );
          await this.prisma.$executeRawUnsafe(command);
        }
      }

      const executionTime = Date.now() - startTime;

      // Marcar como concluída
      await this.markMigrationAsExecuted(migration.id, executionTime, userId);

      this.logger.log(
        `Migration ${migration.fileName} reexecutada com sucesso (${executionTime}ms)`
      );

      return {
        success: true,
        fileName: migration.fileName,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error.message || 'Erro desconhecido';

      await this.markMigrationAsFailed(migration.id, errorMessage);

      this.logger.error(
        `Erro ao reexecutar migration ${migration.fileName}: ${errorMessage}`
      );

      throw new BadRequestException(
        `Erro ao reexecutar migration: ${errorMessage}`
      );
    }
  }
}
