import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Cria um tenant de exemplo
  const tenant1 = await prisma.tenant.upsert({
    where: { email: 'empresa1@example.com' },
    update: {},
    create: {
      email: 'empresa1@example.com',
      cnpjCpf: '12345678901234',
      nomeFantasia: 'Empresa Exemplo LTDA',
      nomeResponsavel: 'João Silva',
      telefone: '(11) 98765-4321',
    },
  });

  console.log('✅ Tenant criado:', tenant1.nomeFantasia);

  // Cria um SUPER_ADMIN (sem tenant)
  const hashedPasswordAdmin = await bcrypt.hash('admin123', 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@system.com' },
    update: {},
    create: {
      email: 'admin@system.com',
      password: hashedPasswordAdmin,
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
    },
  });

  console.log('✅ Super Admin criado:', superAdmin.email);

  // Cria um usuário comum vinculado ao tenant
  const hashedPasswordUser = await bcrypt.hash('user123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'user@empresa1.com' },
    update: {},
    create: {
      email: 'user@empresa1.com',
      password: hashedPasswordUser,
      name: 'Usuário Comum',
      role: Role.USER,
      tenantId: tenant1.id,
    },
  });

  console.log('✅ Usuário comum criado:', user.email);

  // Cria um admin do tenant
  const hashedPasswordTenantAdmin = await bcrypt.hash('admin123', 10);
  const tenantAdmin = await prisma.user.upsert({
    where: { email: 'admin@empresa1.com' },
    update: {},
    create: {
      email: 'admin@empresa1.com',
      password: hashedPasswordTenantAdmin,
      name: 'Admin da Empresa',
      role: Role.ADMIN,
      tenantId: tenant1.id,
    },
  });

  console.log('✅ Admin do tenant criado:', tenantAdmin.email);

  console.log('\n📋 Credenciais de acesso:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUPER_ADMIN:');
  console.log('  Email: admin@system.com');
  console.log('  Senha: admin123');
  console.log('  Acesso: Todas as rotas, incluindo /tenants');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ADMIN (Tenant):');
  console.log('  Email: admin@empresa1.com');
  console.log('  Senha: admin123');
  console.log('  Acesso: Dados apenas do seu tenant');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('USER:');
  console.log('  Email: user@empresa1.com');
  console.log('  Senha: user123');
  console.log('  Acesso: Dados apenas do seu tenant');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
