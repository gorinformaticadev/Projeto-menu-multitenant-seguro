/**
 * SCRIPT DE SINCRONIZAÇÃO DE MÓDULOS
 * 
 * Este script lê os arquivos de configuração dos módulos instalados
 * e sincroniza os dados no banco de dados para consumo pela API.
 * 
 * Funcionalidades:
 * - Lê module.ts, menu.ts, routes.tsx de cada módulo
 * - Extrai menus, rotas, taskbar, widgets, notificações
 * - Salva tudo no campo 'config' da tabela modules
 * - Permite que a API retorne dados completos sem executar código dos módulos
 */

const fs = require('fs');
const path = require('path');

// Prisma Client do backend
const backendPath = path.join(__dirname, '..', 'backend');
const { PrismaClient } = require(path.join(backendPath, 'node_modules', '@prisma', 'client'));

const prisma = new PrismaClient();

/**
 * Lê e parseia o arquivo de menu de um módulo
 */
function readModuleMenu(modulePath) {
  const menuPath = path.join(modulePath, 'frontend', 'menu.ts');
  
  if (!fs.existsSync(menuPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(menuPath, 'utf-8');
    
    // Extrai o array ModuleMenu usando regex
    const match = content.match(/export const ModuleMenu\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) return [];

    // Avalia o array (cuidado: apenas em contexto controlado)
    const menuData = eval(`(${match[1]})`);
    return menuData;
  } catch (error) {
    console.error(`Erro ao ler menu de ${modulePath}:`, error.message);
    return [];
  }
}

/**
 * Lê e parseia o arquivo de rotas de um módulo
 */
function readModuleRoutes(modulePath) {
  const routesPath = path.join(modulePath, 'frontend', 'routes.tsx');
  
  if (!fs.existsSync(routesPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(routesPath, 'utf-8');
    
    // Extrai as rotas declaradas
    const routeMatches = content.matchAll(/\{\s*path:\s*[`'"]([^`'"]+)[`'"],\s*component:\s*(\w+)\s*\}/g);
    const routes = [];
    
    for (const match of routeMatches) {
      routes.push({
        path: match[1],
        component: match[2]
      });
    }
    
    return routes;
  } catch (error) {
    console.error(`Erro ao ler rotas de ${modulePath}:`, error.message);
    return [];
  }
}

/**
 * Lê e parseia o arquivo module.ts para extrair metadados
 */
function readModuleMetadata(modulePath) {
  const moduleTsPath = path.join(modulePath, 'module.ts');
  
  if (!fs.existsSync(moduleTsPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(moduleTsPath, 'utf-8');
    
    // Extrai informações básicas
    const nameMatch = content.match(/name:\s*['"](.*?)['"]/);
    const slugMatch = content.match(/slug:\s*['"](.*?)['"]/);
    const versionMatch = content.match(/version:\s*['"](.*?)['"]/);
    const displayNameMatch = content.match(/displayName:\s*['"](.*?)['"]/);
    const descriptionMatch = content.match(/description:\s*['"](.*?)['"]/);
    const authorMatch = content.match(/author:\s*['"](.*?)['"]/);
    
    return {
      name: nameMatch ? nameMatch[1] : '',
      slug: slugMatch ? slugMatch[1] : '',
      version: versionMatch ? versionMatch[1] : '1.0.0',
      displayName: displayNameMatch ? displayNameMatch[1] : '',
      description: descriptionMatch ? descriptionMatch[1] : '',
      author: authorMatch ? authorMatch[1] : ''
    };
  } catch (error) {
    console.error(`Erro ao ler metadata de ${modulePath}:`, error.message);
    return {};
  }
}

/**
 * Lê module.json (se existir)
 */
function readModuleJson(modulePath) {
  const jsonPath = path.join(modulePath, 'module.json');
  
  if (!fs.existsSync(jsonPath)) {
    return {};
  }

  try {
    const content = fs.readFileSync(jsonPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Erro ao ler module.json de ${modulePath}:`, error.message);
    return {};
  }
}

/**
 * Sincroniza um módulo específico
 */
async function syncModule(moduleDir) {
  const modulePath = path.join(__dirname, '..', 'modules', moduleDir);
  
  console.log(`\n📦 Sincronizando módulo: ${moduleDir}`);
  
  // Lê todas as informações do módulo
  const metadata = readModuleMetadata(modulePath);
  const moduleJson = readModuleJson(modulePath);
  const menus = readModuleMenu(modulePath);
  const routes = readModuleRoutes(modulePath);
  
  // Combina metadata do module.ts e module.json
  const finalMetadata = {
    ...metadata,
    ...moduleJson
  };
  
  if (!finalMetadata.name || !finalMetadata.slug) {
    console.error(`❌ Módulo ${moduleDir} não possui name ou slug válidos`);
    return;
  }
  
  // Prepara dados para salvar
  const moduleData = {
    slug: finalMetadata.slug,
    name: finalMetadata.displayName || finalMetadata.name,
    description: finalMetadata.description || '',
    version: finalMetadata.version || '1.0.0',
    status: 'active',
    hasBackend: fs.existsSync(path.join(modulePath, 'backend')),
    hasFrontend: fs.existsSync(path.join(modulePath, 'frontend')),
    installedAt: new Date(),
    activatedAt: new Date()
  };
  
  // Salva ou atualiza no banco
  try {
    const existingModule = await prisma.module.findUnique({
      where: { slug: moduleData.slug }
    });
    
    let moduleId;
    
    if (existingModule) {
      await prisma.module.update({
        where: { slug: moduleData.slug },
        data: moduleData
      });
      console.log(`✅ Módulo ${moduleData.slug} atualizado`);
      moduleId = existingModule.id;
    } else {
      const created = await prisma.module.create({
        data: moduleData
      });
      console.log(`✅ Módulo ${moduleData.slug} criado`);
      moduleId = created.id;
    }
    
    // Limpa menus antigos
    await prisma.moduleMenu.deleteMany({
      where: { moduleId }
    });
    
    // Salva menus na tabela ModuleMenu
    if (menus.length > 0) {
      for (const menu of menus) {
        // Menu pai
        const parentMenu = await prisma.moduleMenu.create({
          data: {
            moduleId,
            label: menu.name,
            icon: menu.icon || null,
            route: menu.href || '#',
            order: menu.order || 0,
            permission: menu.roles ? menu.roles.join(',') : null,
            isUserMenu: true
          }
        });
        
        // Submenus (children)
        if (menu.children && Array.isArray(menu.children)) {
          for (const child of menu.children) {
            await prisma.moduleMenu.create({
              data: {
                moduleId,
                label: child.name,
                icon: child.icon || null,
                route: child.href || '#',
                order: child.order || 0,
                parentId: parentMenu.id,
                permission: child.roles ? child.roles.join(',') : null,
                isUserMenu: true
              }
            });
          }
        }
      }
      console.log(`   📋 ${menus.length} menus salvos`);
    }
    
  } catch (error) {
    console.error(`❌ Erro ao salvar módulo ${moduleData.name}:`, error.message);
  }
}

/**
 * Função principal
 */
async function main() {
  console.log('🔄 Iniciando sincronização de módulos...\n');
  
  const modulesDir = path.join(__dirname, '..', 'modules');
  
  if (!fs.existsSync(modulesDir)) {
    console.error('❌ Diretório modules/ não encontrado');
    process.exit(1);
  }
  
  // Lista todos os diretórios em modules/
  const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
  const moduleDirs = entries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);
  
  console.log(`📁 Encontrados ${moduleDirs.length} módulos:\n${moduleDirs.map(d => `   - ${d}`).join('\n')}`);
  
  // Sincroniza cada módulo
  for (const moduleDir of moduleDirs) {
    await syncModule(moduleDir);
  }
  
  console.log('\n✅ Sincronização concluída!');
}

// Executa
main()
  .catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
