/* eslint-disable @typescript-eslint/no-var-requires */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Executing Migration V2 for OS Module...');

    try {
        // Add columns if they don't exist
        await prisma.$executeRawUnsafe(`ALTER TABLE mod_ordemServico_products ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'PRODUCT'`);
        await prisma.$executeRawUnsafe(`ALTER TABLE mod_ordemServico_products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2) DEFAULT 0`);
        await prisma.$executeRawUnsafe(`ALTER TABLE mod_ordemServico_products ADD COLUMN IF NOT EXISTS image_url TEXT`);

        console.log('✅ Migration V2 applied successfully (type, cost_price, image_url).');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
