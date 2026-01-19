
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkRoles() {
    console.log('Checking user roles...');

    const users = await prisma.user.findMany({
        where: {
            email: 'admin@system.com'
        },
        select: {
            email: true,
            role: true,
            name: true
        }
    });

    console.log('Users found:');
    users.forEach(u => {
        console.log(`Email: ${u.email} | Role: ${u.role} | Name: ${u.name}`);
    });
}

checkRoles()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
