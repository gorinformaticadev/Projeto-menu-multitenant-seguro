import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

// Função para gerar senha segura
function generateSecurePassword(length: number = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Garantir pelo menos um de cada tipo
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special
  
  // Preencher o resto
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Embaralhar a senha
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');
  
  // Senha padrão fixa para desenvolvimento
  const defaultPassword = 'eRR&KnFyuo&UI6d*';
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || defaultPassword;
  const userPassword = process.env.USER_DEFAULT_PASSWORD || defaultPassword;
  
  console.log('🔐 Usando senha padrão para desenvolvimento:');
  console.log(`   Senha: ${defaultPassword}`);
  console.log('⚠️  IMPORTANTE: Esta é uma senha padrão para desenvolvimento!');

  // Cria a tenant principal (empresa padrão do sistema)
  const tenant1 = await prisma.tenant.upsert({
    where: { email: 'empresa1@example.com' },
    update: {},
    create: {
      email: 'empresa1@example.com',
      cnpjCpf: '12345678901234',
      nomeFantasia: 'GOR Informatica',
      nomeResponsavel: 'João Silva',
      telefone: '(11) 98765-4321',
    },
  });

  console.log('✅ Tenant criado:', tenant1.nomeFantasia);

  // Cria um SUPER_ADMIN (vinculado à tenant principal)
  const hashedPasswordAdmin = await bcrypt.hash(adminPassword, 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@system.com' },
    update: {},
    create: {
      email: 'admin@system.com',
      password: hashedPasswordAdmin,
      name: 'Super Admin',
      role: Role.SUPER_ADMIN,
      tenantId: tenant1.id, // ✅ Associa à tenant principal
    },
  });

  console.log('✅ Super Admin criado:', superAdmin.email);

  // Cria um usuário comum vinculado ao tenant
  const hashedPasswordUser = await bcrypt.hash(userPassword, 12);
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
  const hashedPasswordTenantAdmin = await bcrypt.hash(adminPassword, 12);
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

  // Cria configurações de segurança globais (padrão)
  const globalSecurityConfig = await prisma.securityConfig.create({
    data: {
      twoFactorEnabled: true,
      twoFactorRequired: false,
      twoFactorRequiredForAdmins: false,
      twoFactorSuggested: true,
      sessionTimeoutMinutes: 30,
      passwordMinLength: 8,
      passwordRequireUppercase: true,
      passwordRequireLowercase: true,
      passwordRequireNumbers: true,
      passwordRequireSpecial: true,
      loginMaxAttempts: 5,
      loginLockDurationMinutes: 15,
      platformName: 'Sistema Multitenant',
      platformEmail: 'admin@sistema.com',
    },
  });

  console.log('✅ Configurações de segurança globais criadas');

  console.log('\n📋 Credenciais de acesso:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUPER_ADMIN:');
  console.log('  Email: admin@system.com');
  console.log(`  Senha: ${defaultPassword}`);
  console.log('  Acesso: Todas as rotas, incluindo /tenants');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('ADMIN (Tenant):');
  console.log('  Email: admin@empresa1.com');
  console.log(`  Senha: ${defaultPassword}`);
  console.log('  Acesso: Dados apenas do seu tenant');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('USER:');
  console.log('  Email: user@empresa1.com');
  console.log(`  Senha: ${defaultPassword}`);
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
