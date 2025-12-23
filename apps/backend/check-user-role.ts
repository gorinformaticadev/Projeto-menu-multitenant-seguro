import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkUserRole() {
  try {
    console.log('=== VERIFICANDO USUÁRIO E ROLE ===');
    
    // Verificar usuários do tenant "GOR Informatica"
    const tenant = await prisma.tenant.findFirst({
      where: {
        nomeFantasia: 'GOR Informatica'
      }
    });
    
    if (!tenant) {
      console.log('Tenant "GOR Informatica" não encontrado');
      return;
    }
    
    console.log('Tenant encontrado:', tenant.nomeFantasia);
    console.log('Tenant ID:', tenant.id);
    
    // Verificar usuários do tenant
    const users = await prisma.user.findMany({
      where: {
        tenantId: tenant.id
      }
    });
    
    console.log('\nUsuários do tenant:');
    users.forEach(user => {
      console.log('- Email:', user.email);
      console.log('  Nome:', user.name);
      console.log('  Role:', user.role);
      console.log('  ID:', user.id);
    });
    
  } catch (error) {
    console.error('Erro ao verificar usuário:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserRole();