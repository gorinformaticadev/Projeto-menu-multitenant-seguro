const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      include: { tenant: true }
    });
    
    console.log('👥 Usuários encontrados:');
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.role}) - Tenant: ${user.tenant?.name || 'Nenhum'}`);
    });
    
    const tenants = await prisma.tenant.findMany();
    console.log('\n🏢 Tenants encontrados:');
    tenants.forEach(tenant => {
      console.log(`  - ${tenant.name} (ID: ${tenant.id})`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();