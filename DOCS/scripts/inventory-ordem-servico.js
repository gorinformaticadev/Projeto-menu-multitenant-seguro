const { PrismaClient } = require('@prisma/client');

const prismaClient = new PrismaClient();

async function checkExistingTables() {
    try {
        console.log('🔍 Verificando tabelas existentes do módulo ordem_servico...\n');
        
        const tables = await prismaClient.$queryRaw`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name LIKE 'mod_ordem_servico_%'
            ORDER BY table_name
        `;
        
        console.log('Tabelas encontradas:');
        tables.forEach(table => {
            console.log(`✅ ${table.table_name}`);
        });
        
        console.log(`\nTotal: ${tables.length} tabelas do módulo ordem_servico`);
        
        // Verificar se todas as tabelas da migration canônica existem
        const canonicalTables = [
            'mod_ordem_servico_clients',
            'mod_ordem_servico_ordens', 
            'mod_ordem_servico_historico',
            'mod_ordem_servico_user_roles',
            'mod_ordem_servico_products',
            'mod_ordem_servico_tipos_equipamento'
        ];
        
        console.log('\nVerificando tabelas canônicas:');
        const existingTableNames = tables.map(t => t.table_name);
        let allCanonicalExist = true;
        
        canonicalTables.forEach(tableName => {
            if (existingTableNames.includes(tableName)) {
                console.log(`✅ ${tableName}`);
            } else {
                console.log(`❌ ${tableName} - FALTANDO`);
                allCanonicalExist = false;
            }
        });
        
        if (allCanonicalExist) {
            console.log('\n🎉 Todas as tabelas canônicas estão presentes!');
        } else {
            console.log('\n⚠️  Algumas tabelas canônicas estão faltando');
        }
        
        // Listar scripts de migração redundantes
        console.log('\n📂 Scripts de migração espalhados (que podem ser removidos):');
        const redundantScripts = [
            'scripts/migrate_client_fields.js',
            'scripts/migrate_client_preview_fields.js', 
            'scripts/migrate_equipment_photos.js',
            'scripts/migrate_formatting_fields.js',
            'scripts/migrate_os_v2.js',
            'scripts/migrate_products.js',
            'scripts/migrate_user_os_roles.js'
        ];
        
        redundantScripts.forEach(script => {
            console.log(`   - ${script}`);
        });
        
        console.log('\n💡 Recomendação: Esses scripts são substituídos pela migration canônica');
        
    } catch (error) {
        console.error('Erro:', error);
    } finally {
        await prismaClient.$disconnect();
    }
}

checkExistingTables();const { PrismaClient } = require('@prisma/client');

const prismaClient = new PrismaClient();

async function checkExistingTables() {
    try {
        console.log('🔍 Verificando tabelas existentes do módulo ordem_servico...\n');
        
        const tables = await prismaClient.$queryRaw`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name LIKE 'mod_ordem_servico_%'
            ORDER BY table_name
        `;
        
        console.log('Tabelas encontradas:');
        tables.forEach(table => {
            console.log(`✅ ${table.table_name}`);
        });
        
        console.log(`\nTotal: ${tables.length} tabelas do módulo ordem_servico`);
        
        // Verificar se todas as tabelas da migration canônica existem
        const canonicalTables = [
            'mod_ordem_servico_clients',
            'mod_ordem_servico_ordens', 
            'mod_ordem_servico_historico',
            'mod_ordem_servico_user_roles',
            'mod_ordem_servico_products',
            'mod_ordem_servico_tipos_equipamento'
        ];
        
        console.log('\nVerificando tabelas canônicas:');
        const existingTableNames = tables.map(t => t.table_name);
        let allCanonicalExist = true;
        
        canonicalTables.forEach(tableName => {
            if (existingTableNames.includes(tableName)) {
                console.log(`✅ ${tableName}`);
            } else {
                console.log(`❌ ${tableName} - FALTANDO`);
                allCanonicalExist = false;
            }
        });
        
        if (allCanonicalExist) {
            console.log('\n🎉 Todas as tabelas canônicas estão presentes!');
        } else {
            console.log('\n⚠️  Algumas tabelas canônicas estão faltando');
        }
        
        // Listar scripts de migração redundantes
        console.log('\n📂 Scripts de migração espalhados (que podem ser removidos):');
        const redundantScripts = [
            'scripts/migrate_client_fields.js',
            'scripts/migrate_client_preview_fields.js', 
            'scripts/migrate_equipment_photos.js',
            'scripts/migrate_formatting_fields.js',
            'scripts/migrate_os_v2.js',
            'scripts/migrate_products.js',
            'scripts/migrate_user_os_roles.js'
        ];
        
        redundantScripts.forEach(script => {
            console.log(`   - ${script}`);
        });
        
        console.log('\n💡 Recomendação: Esses scripts são substituídos pela migration canônica');
        
    } catch (error) {
        console.error('Erro:', error);
    } finally {
        await prismaClient.$disconnect();
    }
}

checkExistingTables();