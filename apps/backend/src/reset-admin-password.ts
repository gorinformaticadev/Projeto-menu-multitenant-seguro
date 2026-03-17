import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando script de redefinição de senha para o SUPER_ADMIN...');

  // 1. Procurar o Super Admin pelo e-mail padrão ou tentar qualquer role de SUPER_ADMIN
  const targetEmail = process.env.INSTALL_ADMIN_EMAIL || 'admin@system.com';

  let superAdmin = await prisma.user.findUnique({
    where: { email: targetEmail },
  });

  if (!superAdmin) {
    console.log(`Não encontrou admin por email (${targetEmail}), buscando o primeiro SUPER_ADMIN...`);
    superAdmin = await prisma.user.findFirst({
      where: { role: Role.SUPER_ADMIN },
    });
  }

  if (!superAdmin) {
    console.error('ERRO: Nenhum SUPER_ADMIN encontrado no banco de dados!');
    process.exit(1);
  }

  console.log(`Usuário SUPER_ADMIN encontrado: ${superAdmin.email} (Nome: ${superAdmin.name})`);

  // 2. Hash da nova senha "admin123"
  console.log('Gerando hash para a nova senha...');
  const newRawPassword = 'admin123';
  const hashedPassword = await bcrypt.hash(newRawPassword, 10);

  // 3. Atualizar no banco e destrancar a conta se estiver bloqueada
  console.log('Salvando no banco de dados...');
  await prisma.user.update({
    where: { id: superAdmin.id },
    data: {
      password: hashedPassword,
      loginAttempts: 0,
      isLocked: false,
      lockedAt: null,
      lockedUntil: null,
      lastFailedLoginAt: null,
    },
  });

  console.log('✅ Senha alterada com sucesso para "admin123" e possíveis bloqueios foram limpos!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
