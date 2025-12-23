import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@sistema.com';
    const password = 'Admin123!';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
            role: 'SUPER_ADMIN',
            isLocked: false,
            loginAttempts: 0,
        },
        create: {
            email,
            password: hashedPassword,
            name: 'Super Administrador',
            role: 'SUPER_ADMIN',
        },
    });

    console.log(`SUPER_ADMIN criado: ${email} / ${password}`);
    console.log(`ID: ${user.id}`);
    console.log(`Role: ${user.role}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });