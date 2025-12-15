/**
 * Script de Migração de Transição
 * 
 * Propósito: Registrar migrations/seeds existentes de módulos já instalados
 * como COMPLETED na nova tabela de controle.
 * 
 * Uso:
 * npx ts-node scripts/migrate-existing-modules.ts
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * Calcula checksum SHA-256 de um arquivo
 */
function calculateFileChecksum(filePath: string): string {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

/**
 * Registra migrations/seeds de um módulo como COMPLETED
 */
async function migrateModule(moduleName: string, modulesPath: string) {
  console.log(`\n📦 Processando módulo: ${moduleName}`);
  
  const modulePath = path.join(modulesPath, moduleName);
  
  if (!fs.existsSync(modulePath)) {
    console.log(`  ⚠️  Pasta do módulo não encontrada, pulando...`);
    return;
  }

  let migrationsRegistered = 0;
  let seedsRegistered = 0;

  // Processar migrations
  const migrationsPath = path.join(modulePath, 'migrations');
  if (fs.existsSync(migrationsPath)) {
    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const fileName of migrationFiles) {
      const filePath = path.join(migrationsPath, fileName);
      const checksum = calculateFileChecksum(filePath);

      // Verificar se já existe registro
      const existing = await prisma.moduleMigration.findUnique({
        where: {
          moduleName_fileName_type: {
            moduleName,
            fileName,
            type: 'MIGRATION'
          }
        }
      });

      if (!existing) {
        await prisma.moduleMigration.create({
          data: {
            moduleName,
            fileName,
            type: 'MIGRATION',
            checksum,
            status: 'COMPLETED',
            executedAt: new Date(),
            executionTime: 0,
            executedBy: 'MIGRATION_SCRIPT'
          }
        });
        migrationsRegistered++;
        console.log(`  ✅ Migration registrada: ${fileName}`);
      } else {
        console.log(`  ⏭️  Migration já existe: ${fileName}`);
      }
    }
  }

  // Processar seed.sql na raiz
  const seedPathRoot = path.join(modulePath, 'seed.sql');
  if (fs.existsSync(seedPathRoot)) {
    const checksum = calculateFileChecksum(seedPathRoot);

    const existing = await prisma.moduleMigration.findUnique({
      where: {
        moduleName_fileName_type: {
          moduleName,
          fileName: 'seed.sql',
          type: 'SEED'
        }
      }
    });

    if (!existing) {
      await prisma.moduleMigration.create({
        data: {
          moduleName,
          fileName: 'seed.sql',
          type: 'SEED',
          checksum,
          status: 'COMPLETED',
          executedAt: new Date(),
          executionTime: 0,
          executedBy: 'MIGRATION_SCRIPT'
        }
      });
      seedsRegistered++;
      console.log(`  ✅ Seed registrado: seed.sql`);
    } else {
      console.log(`  ⏭️  Seed já existe: seed.sql`);
    }
  }

  // Processar seeds na pasta seeds/
  const seedsPath = path.join(modulePath, 'seeds');
  if (fs.existsSync(seedsPath)) {
    const seedFiles = fs.readdirSync(seedsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const fileName of seedFiles) {
      const filePath = path.join(seedsPath, fileName);
      const checksum = calculateFileChecksum(filePath);

      const existing = await prisma.moduleMigration.findUnique({
        where: {
          moduleName_fileName_type: {
            moduleName,
            fileName,
            type: 'SEED'
          }
        }
      });

      if (!existing) {
        await prisma.moduleMigration.create({
          data: {
            moduleName,
            fileName,
            type: 'SEED',
            checksum,
            status: 'COMPLETED',
            executedAt: new Date(),
            executionTime: 0,
            executedBy: 'MIGRATION_SCRIPT'
          }
        });
        seedsRegistered++;
        console.log(`  ✅ Seed registrado: ${fileName}`);
      } else {
        console.log(`  ⏭️  Seed já existe: ${fileName}`);
      }
    }
  }

  if (migrationsRegistered === 0 && seedsRegistered === 0) {
    console.log(`  ℹ️  Nenhuma migration/seed nova para registrar`);
  } else {
    console.log(`  ✨ Total: ${migrationsRegistered} migrations, ${seedsRegistered} seeds registrados`);
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🚀 Iniciando migração de módulos existentes...\n');
  console.log('Este script registrará todas as migrations/seeds existentes como COMPLETED.');
  console.log('Isso permite que o novo sistema de controle funcione com módulos já instalados.\n');

  try {
    // Buscar todos os módulos do banco
    const modules = await prisma.module.findMany({
      orderBy: { name: 'asc' }
    });

    console.log(`📊 Encontrados ${modules.length} módulos no banco de dados\n`);

    const modulesPath = path.join(process.cwd(), '..', 'modules');
    console.log(`📁 Pasta de módulos: ${modulesPath}\n`);

    if (!fs.existsSync(modulesPath)) {
      console.log('❌ Pasta de módulos não encontrada!');
      console.log('Certifique-se de que o caminho está correto.');
      return;
    }

    // Processar cada módulo
    for (const module of modules) {
      await migrateModule(module.name, modulesPath);
    }

    console.log('\n✅ Migração concluída com sucesso!');
    console.log('\nPróximos passos:');
    console.log('1. Reinicie o backend para carregar o Prisma Client atualizado');
    console.log('2. Acesse a interface de módulos para verificar os status');
    console.log('3. Novos módulos instalados usarão automaticamente o novo sistema\n');

  } catch (error) {
    console.error('\n❌ Erro durante a migração:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar
main()
  .catch((error) => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
