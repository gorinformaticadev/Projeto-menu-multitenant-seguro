const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function createAdminUser() {
  try {
    // Buscar o tenant
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      console.log('❌ Nenhum tenant encontrado');
      return;
    }
    
    console.log(`🏢 Tenant: ${tenant.nomeFantasia} (ID: ${tenant.id})`);
    
    const email = 'admin@empresa.com';
    const password = 'Admin123!';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        password: hashedPassword,
        role: 'ADMIN',
        tenantId: tenant.id,
        isLocked: false,
        loginAttempts: 0,
      },
      create: {
        email,
        password: hashedPassword,
        name: 'Administrador da Empresa',
        role: 'ADMIN',
        tenantId: tenant.id,
      },
    });

    console.log(`✅ Usuário ADMIN criado: ${email} / ${password}`);
    console.log(`👤 ID: ${user.id}`);
    console.log(`🏢 Tenant: ${tenant.nomeFantasia}`);
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();