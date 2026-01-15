
import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    try {
        const modules = await prisma.module.findMany({
            select: {
                slug: true,
                status: true,
                hasBackend: true
            }
        });
        console.log('MODULES_STATUS_START');
        console.log(JSON.stringify(modules));
        console.log('MODULES_STATUS_END');
    } catch (error) {
        console.error('Error querying modules:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
