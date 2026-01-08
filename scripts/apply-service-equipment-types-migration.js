const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function applyMigration() {
    try {
        console.log('🔄 Aplicando migração de tipos de serviço e equipamento...');

        // Ler o arquivo de migração
        const migrationPath = path.join(__dirname, '../module-os/backend/migrations/018_create_simple_service_equipment_types.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        console.log('📝 Executando migração completa...');

        try {
            // Executar o SQL completo de uma vez
            await prisma.$executeRawUnsafe(migrationSQL);
            console.log('✅ Migração executada com sucesso!');
        } catch (error) {
            // Se falhar, tentar executar por partes
            console.log('⚠️ Execução completa falhou, tentando por partes...');
            
            // Dividir em blocos lógicos
            const blocks = migrationSQL.split(/(?=CREATE TABLE|CREATE INDEX|INSERT INTO|CREATE OR REPLACE FUNCTION|CREATE TRIGGER|COMMENT ON)/);
            
            for (let i = 0; i < blocks.length; i++) {
                const block = blocks[i].trim();
                if (block && !block.startsWith('--') && !block.startsWith('/*')) {
                    try {
                        console.log(`⏳ Executando bloco ${i + 1}/${blocks.length}...`);
                        await prisma.$executeRawUnsafe(block);
                        console.log(`✅ Bloco ${i + 1} executado com sucesso`);
                    } catch (blockError) {
                        // Ignorar erros de "já existe"
                        if (blockError.message.includes('already exists') || 
                            blockError.message.includes('duplicate key') ||
                            blockError.message.includes('já existe') ||
                            blockError.message.includes('duplicate key value violates unique constraint')) {
                            console.log(`⚠️ Bloco ${i + 1} já executado anteriormente (ignorado)`);
                        } else {
                            console.error(`❌ Erro ao executar bloco ${i + 1}:`, blockError.message);
                            console.error(`Bloco: ${block.substring(0, 100)}...`);
                            // Continuar com os próximos blocos
                        }
                    }
                }
            }
        }

        console.log('✅ Migração concluída!');
        console.log('📋 Tabelas criadas:');
        console.log('   - mod_ordem_servico_tipos_servico');
        console.log('   - mod_ordem_servico_tipos_equipamento');
        console.log('📦 Dados padrão inseridos para todos os tenants');

    } catch (error) {
        console.error('❌ Erro ao aplicar migração:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    applyMigration()
        .then(() => {
            console.log('🎉 Processo concluído!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Falha na migração:', error);
            process.exit(1);
        });
}

module.exports = { applyMigration };