/**
 * API ROUTE PARA DESCOBRIR MÓDULOS DISPONÍVEIS
 * 
 * Usa o ModuleLoader para descobrir e validar módulos
 * Rota: /api/modules/discover
 */

import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';

// Interfaces para tipagem
interface ModuleConfig {
  name: string;
  slug: string;
  version: string;
  enabled: boolean;
  permissionsStrict: boolean;
  sandboxed: boolean;
  author?: string;
  description?: string;
  category?: string;
}

interface ModulePage {
  id: string;
  path: string;
  component: string;
  protected: boolean;
  permissions: string[];
  title?: string;
  description?: string;
}

interface ModuleBootstrap {
  pages: ModulePage[];
  routes?: any[];
  menus?: any[];
  permissions?: any[];
}

interface LoadedModule {
  config: ModuleConfig;
  bootstrap: ModuleBootstrap;
  isValid: boolean;
  loadError?: string;
}

export async function GET(request: NextRequest) {
  console.log('🔍 API: Descobrindo módulos...');
  
  try {
    // Determinar caminho dos módulos
    const cwd = process.cwd();
    const modulesPath = cwd.endsWith('frontend') 
      ? resolve(cwd, '..', 'modules')
      : resolve(cwd, 'modules');
    
    console.log('📂 Caminho dos módulos:', modulesPath);

    if (!existsSync(modulesPath)) {
      console.warn('⚠️ Pasta de módulos não encontrada');
      return NextResponse.json({
        success: true,
        modules: {},
        stats: { total: 0, valid: 0, enabled: 0, failed: 0 }
      });
    }

    const entries = await readdir(modulesPath, { withFileTypes: true });
    const moduleDirectories = entries.filter(entry => entry.isDirectory());
    
    console.log(`📂 Encontrados ${moduleDirectories.length} diretórios de módulos`);

    const modules: Record<string, LoadedModule> = {};
    let validCount = 0;
    let enabledCount = 0;
    let failedCount = 0;

    // Carregar cada módulo
    for (const dir of moduleDirectories) {
      const moduleName = dir.name;
      console.log(`🔄 Processando módulo: ${moduleName}`);
      
      try {
        const loadedModule = await loadModule(modulesPath, moduleName);
        modules[moduleName] = loadedModule;
        
        if (loadedModule.isValid) {
          validCount++;
          if (loadedModule.config.enabled) {
            enabledCount++;
          }
        } else {
          failedCount++;
        }
        
      } catch (error) {
        console.error(`❌ Erro ao carregar módulo ${moduleName}:`, error);
        failedCount++;
        
        // Registrar módulo com erro
        modules[moduleName] = {
          config: {
            name: moduleName,
            slug: moduleName,
            version: '0.0.0',
            enabled: false,
            permissionsStrict: true,
            sandboxed: true
          },
          bootstrap: { pages: [] },
          isValid: false,
          loadError: error instanceof Error ? error.message : 'Erro desconhecido'
        };
      }
    }

    const stats = {
      total: moduleDirectories.length,
      valid: validCount,
      enabled: enabledCount,
      failed: failedCount
    };

    console.log('📊 Estatísticas dos módulos:', stats);

    return NextResponse.json({
      success: true,
      modules,
      stats
    });

  } catch (error) {
    console.error('❌ Erro ao descobrir módulos:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      modules: {},
      stats: { total: 0, valid: 0, enabled: 0, failed: 0 }
    }, { status: 500 });
  }
}

/**
 * Carrega um módulo específico
 */
async function loadModule(modulesPath: string, moduleName: string): Promise<LoadedModule> {
  const modulePath = join(modulesPath, moduleName);
  
  // 1. Carregar e validar configuração
  const config = await loadModuleConfig(modulePath);
  if (!config) {
    throw new Error('Configuração do módulo inválida ou não encontrada');
  }

  // 2. Verificar se o módulo está habilitado
  if (!config.enabled) {
    console.log(`⏸️ Módulo ${moduleName} está desabilitado`);
    return {
      config,
      bootstrap: { pages: [] },
      isValid: false,
      loadError: 'Módulo desabilitado'
    };
  }

  // 3. Carregar páginas
  const pages = await loadModulePages(modulePath);
  if (!pages) {
    throw new Error('Páginas do módulo não encontradas ou inválidas');
  }

  // 4. Validar segurança
  validateModuleSecurity(config, pages);

  // 5. Criar bootstrap
  const bootstrap: ModuleBootstrap = {
    pages,
    routes: [],
    menus: [],
    permissions: []
  };

  return {
    config,
    bootstrap,
    isValid: true
  };
}

/**
 * Carrega a configuração do módulo
 */
async function loadModuleConfig(modulePath: string): Promise<ModuleConfig | null> {
  const configPath = join(modulePath, 'module.config.ts');
  
  try {
    if (!existsSync(configPath)) {
      throw new Error('Arquivo module.config.ts não encontrado');
    }

    const configContent = await readFile(configPath, 'utf-8');
    
    // Validação básica de segurança
    if (configContent.includes('eval(') || configContent.includes('Function(')) {
      throw new Error('Código inseguro detectado na configuração');
    }

    // Extrair configuração usando regex mais robusta
    const moduleConfigMatch = configContent.match(/export\s+const\s+moduleConfig\s*=\s*({[\s\S]*?})\s*(?:as\s+const)?;?\s*$/m);
    
    if (!moduleConfigMatch) {
      throw new Error('Configuração moduleConfig não encontrada');
    }

    // Parser mais seguro para extrair valores
    const configText = moduleConfigMatch[1];
    
    // Extrair campos usando regex individual (mais seguro que eval)
    const extractField = (fieldName: string, defaultValue?: any) => {
      const fieldRegex = new RegExp(`${fieldName}\\s*:\\s*([^,}]+)`, 'i');
      const match = configText.match(fieldRegex);
      if (!match) return defaultValue;
      
      let value = match[1].trim();
      
      // Remover aspas
      if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      } else if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value === 'true') {
        return true;
      } else if (value === 'false') {
        return false;
      }
      
      return value;
    };

    // Extrair campos obrigatórios
    const name = extractField('name');
    const slug = extractField('slug');
    const version = extractField('version', '1.0.0');
    const enabled = extractField('enabled', false);
    
    // Validar campos obrigatórios
    if (!name || !slug) {
      throw new Error('Campos obrigatórios (name, slug) não encontrados na configuração');
    }

    // Criar configuração
    const config: ModuleConfig = {
      name,
      slug,
      version,
      enabled,
      permissionsStrict: extractField('permissionsStrict', true),
      sandboxed: extractField('sandboxed', true),
      author: extractField('author'),
      description: extractField('description'),
      category: extractField('category')
    };

    return config;

  } catch (error) {
    console.error('❌ Erro ao carregar configuração do módulo:', error);
    return null;
  }
}

/**
 * Carrega as páginas do módulo
 */
async function loadModulePages(modulePath: string): Promise<ModulePage[] | null> {
  const pagesPath = join(modulePath, 'module.pages.ts');
  
  try {
    if (!existsSync(pagesPath)) {
      throw new Error('Arquivo module.pages.ts não encontrado');
    }

    const pagesContent = await readFile(pagesPath, 'utf-8');
    
    // Validação de segurança
    if (pagesContent.includes('eval(') || pagesContent.includes('Function(')) {
      throw new Error('Código inseguro detectado nas páginas');
    }

    // Extrair páginas
    const pagesMatch = pagesContent.match(/export\s+const\s+modulePages\s*=\s*(\[[\s\S]*?\])\s*(?:as\s+const)?;?/);
    
    if (!pagesMatch) {
      throw new Error('Array modulePages não encontrado');
    }

    const pages = eval(`(${pagesMatch[1]})`);
    
    // Validar estrutura das páginas
    if (!Array.isArray(pages)) {
      throw new Error('modulePages deve ser um array');
    }

    for (const page of pages) {
      if (!page.id || !page.path || !page.component) {
        throw new Error('Página inválida: campos obrigatórios (id, path, component) não encontrados');
      }
    }

    return pages;

  } catch (error) {
    console.error('❌ Erro ao carregar páginas do módulo:', error);
    return null;
  }
}

/**
 * Valida a segurança do módulo
 */
function validateModuleSecurity(config: ModuleConfig, pages: ModulePage[]): void {
  // Verificar se o módulo está em sandbox
  if (!config.sandboxed) {
    console.warn(`⚠️ Módulo ${config.name} não está em sandbox - risco de segurança`);
  }

  // Verificar permissões estritas
  if (!config.permissionsStrict) {
    console.warn(`⚠️ Módulo ${config.name} não usa permissões estritas`);
  }

  // Validar paths das páginas
  for (const page of pages) {
    if (!page.path.startsWith('/')) {
      throw new Error(`Path inválido na página ${page.id}: deve começar com /`);
    }
    
    if (page.path.includes('..') || page.path.includes('//')) {
      throw new Error(`Path inseguro na página ${page.id}: contém caracteres perigosos`);
    }
  }
}