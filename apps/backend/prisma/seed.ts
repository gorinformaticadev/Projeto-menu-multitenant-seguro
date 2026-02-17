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
  console.log('🔍 NODE_ENV:', process.env.NODE_ENV);
  console.log('🔍 INSTALL_ADMIN_EMAIL:', process.env.INSTALL_ADMIN_EMAIL || 'NÃO DEFINIDO');
  console.log('🔍 INSTALL_ADMIN_PASSWORD:', process.env.INSTALL_ADMIN_PASSWORD ? 'DEFINIDO (***)' : 'NÃO DEFINIDO');

  // Senha padrão fixa para desenvolvimento
  const defaultPassword = 'admin123';
  const adminPassword = process.env.INSTALL_ADMIN_PASSWORD || process.env.ADMIN_DEFAULT_PASSWORD || defaultPassword;
  const userPassword = process.env.USER_DEFAULT_PASSWORD || defaultPassword;
  
  console.log('🔐 Usando senha de admin:', adminPassword === defaultPassword ? 'PADRÃO (admin123)' : 'PERSONALIZADA');

  // console.log('🔐 Usando senha padrão para desenvolvimento:');
  // console.log(`   Senha: ${defaultPassword}`);
  // console.log('⚠️  IMPORTANTE: Esta é uma senha padrão para desenvolvimento!');

  // Cria a tenant principal (empresa padrão do sistema)
  const tenant1 = await prisma.tenant.upsert({
    where: { email: 'empresa1@example.com' },
    update: { isMasterTenant: true },
    create: {
      email: 'empresa1@example.com',
      cnpjCpf: '12345678901234',
      nomeFantasia: 'GOR Informatica',
      nomeResponsavel: 'João Silva',
      telefone: '(11) 98765-4321',
      isMasterTenant: true,
    },
  });

  console.log('✅ Tenant criado:', tenant1.nomeFantasia);

  // Cria um SUPER_ADMIN (vinculado à tenant principal)
  const adminEmail = process.env.INSTALL_ADMIN_EMAIL || 'admin@system.com';
  const hashedPasswordAdmin = await bcrypt.hash(adminPassword, 12);
  const superAdmin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: hashedPasswordAdmin,
      role: Role.SUPER_ADMIN,
      tenantId: tenant1.id,
      isLocked: false,
      loginAttempts: 0,
      lockedUntil: null
    },
    create: {
      email: adminEmail,
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

  // Configuracao global idempotente: atualiza a primeira linha, cria se nao existir.
  const existingSecurityConfig = await prisma.securityConfig.findFirst({
    orderBy: { updatedAt: 'asc' },
    select: { id: true },
  });

  const securityConfigData = {
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
  };

  if (existingSecurityConfig) {
    await prisma.securityConfig.update({
      where: { id: existingSecurityConfig.id },
      data: securityConfigData,
    });
    console.log('Configuracoes de seguranca globais atualizadas');
  } else {
    await prisma.securityConfig.create({ data: securityConfigData });
    console.log('Configuracoes de seguranca globais criadas');
  }

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

