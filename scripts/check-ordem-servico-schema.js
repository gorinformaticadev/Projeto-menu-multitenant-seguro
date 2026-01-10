const { PrismaClient } = require('@prisma/client');

async function checkTables() {
    const prisma = new PrismaClient();
    
    try {
        console.log('🔍 Verificando tabelas do módulo ordem_servico...\n');
        
        const tables = await prisma.$queryRaw`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name LIKE 'mod_ordem_servico_%'
            ORDER BY table_name
        `;
        
        console.log('Tabelas encontradas:');
        tables.forEach(table => {
            console.log(`- ${table.table_name}`);
        });
        
        console.log(`\nTotal: ${tables.length} tabelas`);
        
        // Verificar constraints que referenciam profile_templates
        console.log('\n🔍 Verificando constraints...');
        const constraints = await prisma.$queryRaw`
            SELECT 
                tc.table_name,
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND (tc.table_name LIKE 'mod_ordem_servico_%' 
                     OR ccu.table_name = 'mod_ordem_servico_profile_templates')
            ORDER BY tc.table_name, tc.constraint_name
        `;
        
        if (constraints.length > 0) {
            console.log('\nConstraints encontradas:');
            constraints.forEach(constraint => {
                console.log(`${constraint.table_name}.${constraint.column_name} → ${constraint.foreign_table_name}.${constraint.foreign_column_name}`);
            });
        } else {
            console.log('\nNenhuma constraint encontrada');
        }
        
    } catch (error) {
        console.error('Erro:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkTables();const { PrismaClient } = require('@prisma/client');

async function checkTables() {
    const prisma = new PrismaClient();
    
    try {
        console.log('🔍 Verificando tabelas do módulo ordem_servico...\n');
        
        const tables = await prisma.$queryRaw`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name LIKE 'mod_ordem_servico_%'
            ORDER BY table_name
        `;
        
        console.log('Tabelas encontradas:');
        tables.forEach(table => {
            console.log(`- ${table.table_name}`);
        });
        
        console.log(`\nTotal: ${tables.length} tabelas`);
        
        // Verificar constraints que referenciam profile_templates
        console.log('\n🔍 Verificando constraints...');
        const constraints = await prisma.$queryRaw`
            SELECT 
                tc.table_name,
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND (tc.table_name LIKE 'mod_ordem_servico_%' 
                     OR ccu.table_name = 'mod_ordem_servico_profile_templates')
            ORDER BY tc.table_name, tc.constraint_name
        `;
        
        if (constraints.length > 0) {
            console.log('\nConstraints encontradas:');
            constraints.forEach(constraint => {
                console.log(`${constraint.table_name}.${constraint.column_name} → ${constraint.foreign_table_name}.${constraint.foreign_column_name}`);
            });
        } else {
            console.log('\nNenhuma constraint encontrada');
        }
        
    } catch (error) {
        console.error('Erro:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkTables();