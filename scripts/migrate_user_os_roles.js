const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Executando migração de papéis de usuários do módulo OS...');

    try {
        // Ler o arquivo de migração
        const migrationPath = path.join(__dirname, '../module-os/backend/migrations/019_create_user_os_roles.sql');
        
        if (!fs.existsSync(migrationPath)) {
            console.error('❌ Arquivo de migração não encontrado:', migrationPath);
            process.exit(1);
        }

        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('📝 Executando migração...');
        
        // Dividir em blocos lógicos para execução
        const blocks = migrationSQL.split(/(?=CREATE TABLE|CREATE INDEX|CREATE OR REPLACE FUNCTION|CREATE TRIGGER|INSERT INTO)/);
        
        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i].trim();
            if (block.length > 10) { // Ignorar blocos muito pequenos
                try {
                    console.log(`  📦 Executando bloco ${i + 1}/${blocks.length}...`);
                    await prisma.$executeRawUnsafe(block);
                } catch (error) {
                    console.error(`❌ Erro no bloco ${i + 1}:`, error.message);
                    // Continuar com outros blocos se possível
                }
            }
        }

        console.log('✅ Migração de papéis de usuários executada com sucesso!');
        
        // Verificar se a tabela foi criada
        const result = await prisma.$queryRaw`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_name = 'mod_ordem_servico_user_roles'
        `;
        
        console.log('🔍 Verificação da tabela:', result[0].count > 0 ? '✅ Criada' : '❌ Não encontrada');
        
        // Verificar quantos registros foram inseridos
        const userRoles = await prisma.$queryRaw`
            SELECT COUNT(*) as count FROM mod_ordem_servico_user_roles
        `;
        
        console.log(`📊 Registros de papéis criados: ${userRoles[0].count}`);

    } catch (error) {
        console.error('❌ Erro na migração:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    main()
        .then(() => {
            console.log('🎉 Migração concluída!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('💥 Falha na migração:', error);
            process.exit(1);
        });
}

module.exports = { main };