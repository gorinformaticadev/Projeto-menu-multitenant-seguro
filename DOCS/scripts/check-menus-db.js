const path = require('path');
const backendPath = path.join(__dirname, '..', 'backend');
const { PrismaClient } = require(path.join(backendPath, 'node_modules', '@prisma', 'client'));

const prisma = new PrismaClient();

async function checkMenus() {
  try {
    console.log('🔍 Verificando menus no banco de dados...\n');
    
    // Buscar módulo sistema
    const module = await prisma.module.findUnique({
      where: { slug: 'sistema' },
      include: {
        menus: {
          orderBy: { order: 'asc' }
        }
      }
    });
    
    if (!module) {
      console.error('❌ Módulo "sistema" não encontrado no banco');
      return;
    }
    
    console.log(`✅ Módulo: ${module.name} (${module.slug})`);
    console.log(`   ID: ${module.id}`);
    console.log(`   Status: ${module.status}`);
    console.log(`   Total de menus: ${module.menus.length}\n`);
    
    if (module.menus.length === 0) {
      console.log('⚠️ PROBLEMA: Nenhum menu encontrado no banco!');
      console.log('   Executar: node scripts/sync-modules.js');
    } else {
      console.log('📋 Menus encontrados:');
      module.menus.forEach(menu => {
        const indent = menu.parentId ? '   └─ ' : '   ';
        console.log(`${indent}${menu.label} (${menu.route})`);
        console.log(`      ID: ${menu.id}`);
        console.log(`      Ícone: ${menu.icon}`);
        console.log(`      Ordem: ${menu.order}`);
        console.log(`      Parent ID: ${menu.parentId || 'null'}`);
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkMenus();
