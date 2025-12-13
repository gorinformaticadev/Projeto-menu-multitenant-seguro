import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkModules() {
  try {
    console.log('=== VERIFICANDO MÓDULO AJUDA ===');
    
    // Verificar módulo específico "ajuda"
    const ajudaModule = await prisma.module.findUnique({
      where: { name: 'ajuda' },
      include: {
        tenantModules: {
          include: {
            tenant: true
          }
        }
      }
    });
    
    if (ajudaModule) {
      console.log('Módulo "ajuda" encontrado:');
      console.log('- Nome:', ajudaModule.name);
      console.log('- Display Name:', ajudaModule.displayName);
      console.log('- Ativo:', ajudaModule.isActive);
      console.log('- Configuração:', ajudaModule.config);
      
      console.log('\nRelacionamentos com tenants:');
      ajudaModule.tenantModules.forEach(tm => {
        console.log('- Tenant:', tm.tenant.nomeFantasia);
        console.log('  Ativo para tenant:', tm.isActive);
        console.log('  Configuração específica:', tm.config);
      });
    } else {
      console.log('Módulo "ajuda" não encontrado');
    }
    
    console.log('\n=== VERIFICANDO ENDPOINT DE TENANT ATUAL ===');
    
    // Verificar tenants e seus módulos ativos
    const tenants = await prisma.tenant.findMany({
      include: {
        tenantModules: {
          where: {
            isActive: true
          },
          include: {
            module: true
          }
        }
      }
    });
    
    console.log('Tenants encontrados:', tenants.length);
    tenants.forEach(tenant => {
      console.log('\nTenant:', tenant.nomeFantasia);
      console.log('Módulos ativos:', tenant.tenantModules.map(tm => tm.moduleName));
    });
    
  } catch (error) {
    console.error('Erro ao verificar módulos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkModules();