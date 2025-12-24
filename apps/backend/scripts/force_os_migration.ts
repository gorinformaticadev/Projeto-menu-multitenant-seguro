
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Iniciando migração manual forçada do módulo Ordem de Serviço...');

    const migrationFile = path.resolve(__dirname, '../../../packages/modules/ordem_servico/migrations/001_create_os_tables.sql');

    if (!fs.existsSync(migrationFile)) {
        console.error(`❌ Arquivo de migração não encontrado: ${migrationFile}`);
        process.exit(1);
    }

    const sqlContent = fs.readFileSync(migrationFile, 'utf-8');

    try {
        // 1. Limpeza forçada (Drop table se existir para recriar do zero e corrigir schemas corrompidos)
        console.log('🗑️ Removendo tabela antiga se existir...');
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS os_clientes CASCADE;`);

        // 2. Executar SQL de criação
        console.log('running SQL creation...');

        // Remove comentários e quebras de linha desnecessárias para limpeza básica
        const commands = sqlContent
            .split(';')
            .map(cmd => cmd.trim())
            .filter(cmd => cmd.length > 0);

        for (const cmd of commands) {
            console.log(`Executando comando: ${cmd.substring(0, 50)}...`);
            await prisma.$executeRawUnsafe(cmd);
        }

        console.log('✅ Tabelas criadas com sucesso.');

        // 3. Registrar a migração no sistema para que o instalador não tente rodar de novo
        // Precisamos do ID do módulo.
        console.log('🔄 Atualizando registro de migração...');
        let module = await prisma.module.findUnique({
            where: { slug: 'ordem_servico' }
        });

        if (module) {
            console.log('ℹ️ Módulo encontrado no banco.');
        } else {
            console.log('✨ Criando registro do módulo no banco...');
            module = await prisma.module.create({
                data: {
                    slug: 'ordem_servico',
                    name: 'Ordem de Serviço',
                    version: '1.0.0',
                    description: 'Gestão completa de Ordens de Serviço, Orçamentos e Clientes.',
                    status: 'active', // Forçando ativo pois já criamos as tabelas
                    hasBackend: true,
                    hasFrontend: true,
                    installedAt: new Date(),
                    activatedAt: new Date()
                }
            });
        }

        if (module) {
            const filename = '001_create_os_tables.sql';
            const existingMigration = await prisma.moduleMigration.findFirst({
                where: {
                    moduleId: module.id,
                    filename: filename,
                    type: 'migration'
                }
            });

            if (!existingMigration) {
                await prisma.moduleMigration.create({
                    data: {
                        moduleId: module.id,
                        filename: filename,
                        type: 'migration',
                        executedAt: new Date()
                    }
                });
                console.log('✅ Migração registrada no histórico do sistema.');
            } else {
                console.log('ℹ️ Migração já estava registrada no histórico.');
            }
        } else {
            console.warn('⚠️ Módulo ordem_servico não encontrado no banco. O registro de migração foi pulado.');
        }

    } catch (e) {
        console.error('❌ Erro fatal na migração:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
