/**
 * Ativa um módulo para todos os tenants
 */

const path = require('path');
const backendPath = path.join(__dirname, '..', 'backend');
const { PrismaClient } = require(path.join(backendPath, 'node_modules', '@prisma', 'client'));

const prisma = new PrismaClient();

async function enableModuleForAllTenants(moduleSlug) {
  console.log(`\n🔄 Ativando módulo "${moduleSlug}" para todos os tenants...`);
  
  try {
    // Buscar o módulo
    const module = await prisma.module.findUnique({
      where: { slug: moduleSlug }
    });
    
    if (!module) {
      console.error(`❌ Módulo "${moduleSlug}" não encontrado`);
      return;
    }
    
    console.log(`✅ Módulo encontrado: ${module.name}`);
    
    // Buscar todos os tenants
    const tenants = await prisma.tenant.findMany({
      select: { id: true, nomeFantasia: true }
    });
    
    console.log(`📋 Encontrados ${tenants.length} tenants`);
    
    // Ativar módulo para cada tenant
    for (const tenant of tenants) {
      // Verificar se já existe
      const existing = await prisma.moduleTenant.findUnique({
        where: {
          moduleId_tenantId: {
            moduleId: module.id,
            tenantId: tenant.id
          }
        }
      });
      
      if (existing) {
        // Atualizar para enabled = true
        await prisma.moduleTenant.update({
          where: {
            id: existing.id
          },
          data: {
            enabled: true
          }
        });
        console.log(`   ✅ ${tenant.nomeFantasia}: atualizado`);
      } else {
        // Criar novo registro
        await prisma.moduleTenant.create({
          data: {
            moduleId: module.id,
            tenantId: tenant.id,
            enabled: true
          }
        });
        console.log(`   ✅ ${tenant.nomeFantasia}: criado`);
      }
    }
    
    console.log(`\n✅ Módulo "${moduleSlug}" ativado para todos os ${tenants.length} tenants!`);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

// Pegar módulo da linha de comando ou usar 'sistema' como padrão
const moduleSlug = process.argv[2] || 'sistema';

enableModuleForAllTenants(moduleSlug)
  .catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
