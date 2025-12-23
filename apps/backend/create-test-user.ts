import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const email = 'teste@example.com';
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
            isLocked: false,
            loginAttempts: 0,
        },
        create: {
            email,
            password: hashedPassword,
            name: 'Usuário Teste',
            role: 'ADMIN',
            tenant: {
                create: {
                    nomeFantasia: 'Empresa Teste',
                    cnpjCpf: '00000000000000',
                    nomeResponsavel: 'Teste',
                    telefone: '0000000000',
                    email: 'empresa@teste.com'
                }
            }
        },
    });

    console.log(`Usuário de teste configurado: ${email} / ${password}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
