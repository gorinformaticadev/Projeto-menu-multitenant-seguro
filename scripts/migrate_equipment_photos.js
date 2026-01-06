/* eslint-disable @typescript-eslint/no-var-requires */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Executing Migration for Equipment Photos Field...');

    try {
        // Add columns to mod_ordem_servico_ordens
        await prisma.$executeRawUnsafe(`ALTER TABLE mod_ordem_servico_ordens ADD COLUMN IF NOT EXISTS equipamento_fotos TEXT`);

        console.log('✅ Migration applied successfully (equipamento_fotos).');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
