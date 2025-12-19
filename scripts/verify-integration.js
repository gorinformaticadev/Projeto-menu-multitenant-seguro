/**
 * Script de Verificação Completa da Integração de Módulos
 * Verifica todos os componentes necessários para o módulo funcionar
 */

const path = require('path');
const fs = require('fs');
const axios = require('axios');

const backendPath = path.join(__dirname, '..', 'backend');
const { PrismaClient } = require(path.join(backendPath, 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient();

const CHECKS = {
  database: false,
  menus: false,
  tenantEnabled: false,
  api: false,
  frontendRoutes: false
};

async function checkDatabase() {
  console.log('\n1️⃣ Verificando Banco de Dados...');
  try {
    const module = await prisma.module.findUnique({
      where: { slug: 'sistema' }
    });
    
    if (module && module.status === 'active') {
      console.log('   ✅ Módulo "sistema" encontrado e ativo');
      console.log(`      Nome: ${module.name}`);
      console.log(`      Versão: ${module.version}`);
      CHECKS.database = true;
      return module.id;
    } else {
      console.log('   ❌ Módulo não encontrado ou inativo');
      return null;
    }
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
    return null;
  }
}

async function checkMenus(moduleId) {
  console.log('\n2️⃣ Verificando Menus no Banco...');
  try {
    const menus = await prisma.moduleMenu.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' }
    });
    
    if (menus.length > 0) {
      console.log(`   ✅ ${menus.length} menus encontrados`);
      
      const parents = menus.filter(m => !m.parentId);
      const children = menus.filter(m => m.parentId);
      
      console.log(`      Menus pai: ${parents.length}`);
      console.log(`      Sub-menus: ${children.length}`);
      
      parents.forEach(p => {
        console.log(`      - ${p.label}`);
        const childs = children.filter(c => c.parentId === p.id);
        childs.forEach(c => {
          console.log(`         └─ ${c.label} (${c.route})`);
        });
      });
      
      CHECKS.menus = true;
    } else {
      console.log('   ❌ Nenhum menu encontrado');
      console.log('      Execute: node scripts/sync-modules.js');
    }
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
  }
}

async function checkTenantEnabled(moduleId) {
  console.log('\n3️⃣ Verificando Ativação para Tenants...');
  try {
    const tenantModules = await prisma.moduleTenant.findMany({
      where: { 
        moduleId,
        enabled: true
      },
      include: {
        tenant: {
          select: { nomeFantasia: true }
        }
      }
    });
    
    if (tenantModules.length > 0) {
      console.log(`   ✅ Módulo ativado para ${tenantModules.length} tenant(s)`);
      tenantModules.forEach(tm => {
        console.log(`      - ${tm.tenant.nomeFantasia}`);
      });
      CHECKS.tenantEnabled = true;
    } else {
      console.log('   ❌ Módulo não ativado para nenhum tenant');
      console.log('      Execute: node scripts/enable-module-for-all-tenants.js sistema');
    }
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
  }
}

async function checkAPI() {
  console.log('\n4️⃣ Verificando API /me/modules...');
  try {
    // Tentar login
    const credentials = [
      { email: 'admin@empresa1.com', password: 'admin123' },
      { email: 'admin@sistema.com', password: 'Admin123!' }
    ];
    
    let token = null;
    
    for (const cred of credentials) {
      try {
        const login = await axios.post('http://localhost:4000/auth/login', cred);
        token = login.data.accessToken || login.data.access_token;
        if (token) break;
      } catch (e) {
        // Tentar próxima credencial
      }
    }
    
    if (!token) {
      console.log('   ⚠️ Não foi possível fazer login (backend pode não estar rodando)');
      return;
    }
    
    // Buscar módulos
    const response = await axios.get('http://localhost:4000/me/modules', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const modules = response.data.modules || [];
    const sistemaModule = modules.find(m => m.slug === 'sistema');
    
    if (sistemaModule) {
      console.log('   ✅ API retornando módulo "sistema"');
      console.log(`      Habilitado: ${sistemaModule.enabled}`);
      console.log(`      Menus: ${sistemaModule.menus ? sistemaModule.menus.length : 0}`);
      
      if (sistemaModule.menus && sistemaModule.menus.length > 0) {
        console.log('      Estrutura de menus:');
        sistemaModule.menus.forEach(menu => {
          console.log(`      - ${menu.label}`);
          if (menu.children && menu.children.length > 0) {
            menu.children.forEach(child => {
              console.log(`         └─ ${child.label} → ${child.route}`);
            });
          }
        });
        CHECKS.api = true;
      } else {
        console.log('      ⚠️ API não está retornando menus');
      }
    } else {
      console.log('   ❌ Módulo "sistema" não retornado pela API');
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('   ⚠️ Backend não está rodando');
      console.log('      Inicie: cd backend && npm run start:dev');
    } else {
      console.log(`   ❌ Erro: ${error.message}`);
    }
  }
}

function checkFrontendRoutes() {
  console.log('\n5️⃣ Verificando Rotas Frontend...');
  try {
    const routesFile = path.join(__dirname, '..', 'frontend', 'src', 'lib', 'modules-registry.ts');
    
    if (!fs.existsSync(routesFile)) {
      console.log('   ❌ Arquivo modules-registry.ts não encontrado');
      console.log('      Execute: cd frontend && node scripts/generate-module-index.js');
      return;
    }
    
    const content = fs.readFileSync(routesFile, 'utf-8');
    
    if (content.includes('Routes_sistema')) {
      console.log('   ✅ Rotas do módulo "sistema" registradas');
      console.log('      Arquivo: frontend/src/lib/modules-registry.ts');
      CHECKS.frontendRoutes = true;
    } else {
      console.log('   ⚠️ Rotas do módulo "sistema" não encontradas');
      console.log('      Execute: cd frontend && node scripts/generate-module-index.js');
    }
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
  }
}

function printSummary() {
  console.log('\n' + '='.repeat(60));
  console.log('RESUMO DA VERIFICAÇÃO');
  console.log('='.repeat(60));
  
  const checks = [
    { name: 'Banco de Dados', status: CHECKS.database },
    { name: 'Menus Salvos', status: CHECKS.menus },
    { name: 'Ativado para Tenants', status: CHECKS.tenantEnabled },
    { name: 'API Funcionando', status: CHECKS.api },
    { name: 'Rotas Frontend', status: CHECKS.frontendRoutes }
  ];
  
  checks.forEach(check => {
    const icon = check.status ? '✅' : '❌';
    console.log(`${icon} ${check.name}`);
  });
  
  const allPassed = checks.every(c => c.status);
  
  console.log('\n' + '-'.repeat(60));
  
  if (allPassed) {
    console.log('🎉 TODOS OS COMPONENTES ESTÃO FUNCIONANDO!');
    console.log('\nPróximos passos:');
    console.log('1. Inicie o backend: cd backend && npm run start:dev');
    console.log('2. Inicie o frontend: cd frontend && npm run dev');
    console.log('3. Acesse http://localhost:3000');
    console.log('4. Faça login');
    console.log('5. Os menus do módulo "sistema" devem aparecer no sidebar');
  } else {
    console.log('⚠️ ALGUNS COMPONENTES PRECISAM DE ATENÇÃO');
    console.log('\nVerifique as mensagens acima para corrigir os problemas.');
  }
  
  console.log('='.repeat(60) + '\n');
}

async function main() {
  console.log('🔍 VERIFICAÇÃO COMPLETA DA INTEGRAÇÃO DE MÓDULOS');
  console.log('='.repeat(60));
  
  const moduleId = await checkDatabase();
  
  if (moduleId) {
    await checkMenus(moduleId);
    await checkTenantEnabled(moduleId);
  }
  
  await checkAPI();
  checkFrontendRoutes();
  
  printSummary();
}

main()
  .catch(error => {
    console.error('\n❌ Erro fatal:', error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
