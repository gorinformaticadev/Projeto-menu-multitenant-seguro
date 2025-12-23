const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixUserTenant() {
  try {
    // Buscar o tenant
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      console.log('❌ Nenhum tenant encontrado');
      return;
    }
    
    console.log(`🏢 Tenant encontrado: ${tenant.nomeFantasia || 'Sem nome'} (ID: ${tenant.id})`);
    
    // Atualizar nome do tenant se estiver vazio
    if (!tenant.nomeFantasia) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { nomeFantasia: 'Empresa Principal' }
      });
      console.log('✅ Nome do tenant atualizado para "Empresa Principal"');
    }
    
    // Vincular usuário ADMIN ao tenant
    const adminUser = await prisma.user.findFirst({
      where: { 
        OR: [
          { email: 'admin@empresa1.com' },
          { email: 'user@empresa1.com' }
        ]
      }
    });
    
    if (adminUser) {
      await prisma.user.update({
        where: { id: adminUser.id },
        data: { tenantId: tenant.id }
      });
      console.log(`✅ Usuário ${adminUser.email} vinculado ao tenant`);
    }
    
    // Verificar resultado
    const updatedUsers = await prisma.user.findMany({
      include: { tenant: true }
    });
    
    console.log('\n👥 Usuários após correção:');
    updatedUsers.forEach(user => {
      console.log(`  - ${user.email} (${user.role}) - Tenant: ${user.tenant?.nomeFantasia || 'Nenhum'}`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixUserTenant();