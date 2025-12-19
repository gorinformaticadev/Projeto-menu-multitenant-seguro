const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLogos() {
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        nomeFantasia: true,
        logoUrl: true
      }
    });

    console.log('=== TENANTS NO BANCO ===');
    console.log(`Total de tenants: ${tenants.length}\n`);
    tenants.forEach((t, index) => {
      console.log(`[${index + 1}] ID: ${t.id}`);
      console.log(`    Nome: ${t.nomeFantasia}`);
      console.log(`    LogoUrl: ${t.logoUrl || 'NULL'}`);
      console.log('');
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('Erro:', error);
    await prisma.$disconnect();
  }
}

checkLogos();
