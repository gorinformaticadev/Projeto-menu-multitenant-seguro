const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Executing Migration for Client Additional Fields...');

    try {
        // Add missing columns to mod_ordem_servico_clients table
        await prisma.$executeRawUnsafe(`
            ALTER TABLE mod_ordem_servico_clients 
            ADD COLUMN IF NOT EXISTS address_zip VARCHAR(10),
            ADD COLUMN IF NOT EXISTS address_street VARCHAR(255),
            ADD COLUMN IF NOT EXISTS address_number VARCHAR(20),
            ADD COLUMN IF NOT EXISTS address_complement VARCHAR(100),
            ADD COLUMN IF NOT EXISTS address_neighborhood VARCHAR(100),
            ADD COLUMN IF NOT EXISTS address_city VARCHAR(100),
            ADD COLUMN IF NOT EXISTS address_state VARCHAR(2),
            ADD COLUMN IF NOT EXISTS observations TEXT,
            ADD COLUMN IF NOT EXISTS image_url TEXT,
            ADD COLUMN IF NOT EXISTS email VARCHAR(255)
        `);

        // Create indexes for better performance
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_clients_city ON mod_ordem_servico_clients(address_city)
        `);
        
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_clients_state ON mod_ordem_servico_clients(address_state)
        `);
        
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_clients_active ON mod_ordem_servico_clients(is_active)
        `);
        
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS idx_mod_ordem_servico_clients_email ON mod_ordem_servico_clients(email)
        `);

        console.log('✅ Migration applied successfully (client additional fields).');
        
        // Test if the columns exist by describing the table
        console.log('\n🔍 Verificando estrutura da tabela...');
        const tableInfo = await prisma.$queryRawUnsafe(`
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'mod_ordem_servico_clients' 
            ORDER BY ordinal_position
        `);
        
        console.log('📋 Colunas da tabela mod_ordem_servico_clients:');
        tableInfo.forEach(col => {
            console.log(`   ${col.column_name} (${col.data_type}) - Default: ${col.column_default || 'NULL'}`);
        });
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();