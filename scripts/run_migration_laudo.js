
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
    try {
        const migrationPath = path.join(__dirname, '../module-os/backend/migrations/002_add_laudo_tecnico.sql');
        console.log(`Reading migration from: ${migrationPath}`);

        if (!fs.existsSync(migrationPath)) {
            throw new Error(`Migration file not found at ${migrationPath}`);
        }

        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('Executing SQL:');
        console.log(sql);

        // Split by semicolon if multiple statements
        const statements = sql.split(';').filter(s => s.trim().length > 0);

        for (const statement of statements) {
            await prisma.$executeRawUnsafe(statement);
            console.log('Statement executed successfully.');
        }

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Error executing migration:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
