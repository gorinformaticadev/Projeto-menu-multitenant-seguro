/* eslint-disable @typescript-eslint/no-var-requires */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Executing Migration for Formatting Fields...');

    try {
        // Add columns to mod_ordem_servico_ordens
        await prisma.$executeRawUnsafe(`ALTER TABLE mod_ordem_servico_ordens ADD COLUMN IF NOT EXISTS equipamento_estado TEXT`);
        await prisma.$executeRawUnsafe(`ALTER TABLE mod_ordem_servico_ordens ADD COLUMN IF NOT EXISTS formatacao_so TEXT`);
        await prisma.$executeRawUnsafe(`ALTER TABLE mod_ordem_servico_ordens ADD COLUMN IF NOT EXISTS formatacao_backup BOOLEAN DEFAULT FALSE`);
        await prisma.$executeRawUnsafe(`ALTER TABLE mod_ordem_servico_ordens ADD COLUMN IF NOT EXISTS formatacao_backup_descricao TEXT`);
        await prisma.$executeRawUnsafe(`ALTER TABLE mod_ordem_servico_ordens ADD COLUMN IF NOT EXISTS formatacao_senha TEXT`);

        console.log('✅ Migration applied successfully (formatting fields + equipamento_estado).');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
