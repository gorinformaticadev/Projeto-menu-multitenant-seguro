/* eslint-disable @typescript-eslint/no-var-requires */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Executing Migration for Client Preview Fields...');

    try {
        // Add columns to mod_ordem_servico_clients
        await prisma.$executeRawUnsafe(`ALTER TABLE mod_ordem_servico_clients ADD COLUMN IF NOT EXISTS observations TEXT`);
        await prisma.$executeRawUnsafe(`ALTER TABLE mod_ordem_servico_clients ADD COLUMN IF NOT EXISTS image_url TEXT`);

        console.log('✅ Migration applied successfully (observations, image_url).');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
