
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Aplicando migração de Produtos...');

    const migrationPath = path.join(process.cwd(), 'module-ordem-servico/backend/migrations/004_create_products_table.sql');

    if (!fs.existsSync(migrationPath)) {
        console.error('❌ Arquivo de migração não encontrado:', migrationPath);
        process.exit(1);
    }

    const fileContent = fs.readFileSync(migrationPath, 'utf-8');

    // Clean logic
    const statements = fileContent
        .replace(/--.*$/gm, '') // Remove comments
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 5);

    console.log(`Found ${statements.length} migration statements.`);

    for (const [index, stmt] of statements.entries()) {
        try {
            await prisma.$executeRawUnsafe(stmt);
            console.log(`✅ Statement #${index + 1} Success`);
        } catch (err) {
            // Ignore if "already exists" error (code 42P07 in Postgres usually)
            console.log(`⚠️ Statement #${index + 1} info: ${err.message.split('\n')[0]}`);
        }
    }

    await prisma.$disconnect();
}

main();
