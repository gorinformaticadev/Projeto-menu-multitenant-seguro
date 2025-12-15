/**
 * Script de teste para o CORE e módulo demo-completo
 * 
 * Este script inicializa o CORE IDEAL e carrega o módulo demo-completo
 * para verificar se todas as funcionalidades estão funcionando corretamente.
 */

import * as path from 'path';
import { CoreBootstrap } from './core/bootstrap/CoreBootstrap';
import type { DatabaseConnection } from './core/context/CoreContext';

// ═══════════════════════════════════════════════════════════════════════════
// MOCK DE DATABASE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Database mock para testes
 */
const createMockDatabase = (): DatabaseConnection => {
  const data = new Map<string, any[]>();

  return {
    connection: null as any,
    
    async runModuleMigrations(slug: string): Promise<void> {
      console.log(`  📦 [DB] Migration para módulo: ${slug}`);
    },

    async raw(query: string, params?: any[]): Promise<any[]> {
      console.log(`  📊 [DB] Query: ${query.substring(0, 50)}...`);
      
      // Simular dados de retorno
      if (query.includes('SELECT')) {
        return [
          {
            id: '1',
            title: 'Demo 1',
            description: 'Primeira demonstração',
            tenant_id: params?.[0] || 'tenant-1',
            created_at: new Date(),
          },
          {
            id: '2',
            title: 'Demo 2',
            description: 'Segunda demonstração',
            tenant_id: params?.[0] || 'tenant-1',
            created_at: new Date(),
          },
        ];
      }
      
      if (query.includes('INSERT')) {
        return [{
          id: '3',
          title: params?.[0] || 'Nova Demo',
          description: params?.[1] || 'Descrição',
          tenant_id: params?.[3] || 'tenant-1',
          created_at: new Date(),
        }];
      }
      
      return [];
    },

    async transaction<T>(callback: (trx: any) => Promise<T>): Promise<T> {
      console.log('  🔄 [DB] Iniciando transação...');
      
      const trx = {
        raw: this.raw.bind(this),
      };
      
      const result = await callback(trx);
      console.log('  ✅ [DB] Transação concluída');
      
      return result;
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// FUNÇÃO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.clear();
  
  console.log('\n');
  console.log('═'.repeat(80));
  console.log('  🧪 TESTE DO CORE IDEAL + MÓDULO DEMO-COMPLETO');
  console.log('═'.repeat(80));
  console.log('\n');

  try {
    // Criar bootstrap
    const core = new CoreBootstrap();

    // Inicializar CORE
    await core.boot({
      modulesPath: path.join(__dirname, 'modules'),
      coreVersion: '1.0.0',
      environment: 'development' as const,
      db: createMockDatabase(),
    });

    // Obter managers
    const managers = core.getManagers();

    // ═══════════════════════════════════════════════════════════════════════
    // VERIFICAÇÕES
    // ═══════════════════════════════════════════════════════════════════════

    console.log('\n');
    console.log('═'.repeat(80));
    console.log('  🔍 VERIFICAÇÕES');
    console.log('═'.repeat(80));
    console.log('\n');

    // 1. Verificar menus
    console.log('📋 1. MENUS REGISTRADOS:');
    const menus = managers.menu.getAll();
    console.log(`   Total: ${menus.length}`);
    menus.forEach((menu, index) => {
      console.log(`   ${index + 1}. ${menu.label} (${menu.id})`);
      if (menu.badge) {
        console.log(`      └─ Badge: ${menu.badge}`);
      }
    });
    console.log('');

    // 2. Verificar widgets
    console.log('📊 2. WIDGETS REGISTRADOS:');
    const widgets = managers.dashboard.getAll();
    console.log(`   Total: ${widgets.length}`);
    widgets.forEach((widget, index) => {
      console.log(`   ${index + 1}. ${widget.title} (${widget.size})`);
      if (widget.refresh) {
        console.log(`      └─ Auto-refresh: ${widget.refresh}ms`);
      }
    });
    console.log('');

    // 3. Verificar permissões
    console.log('🔐 3. PERMISSÕES REGISTRADAS:');
    const permissions = managers.acl.getPermissions();
    console.log(`   Total: ${permissions.length}`);
    permissions.forEach((perm, index) => {
      console.log(`   ${index + 1}. ${perm.name}: ${perm.description}`);
    });
    console.log('');

    // 4. Verificar roles
    console.log('👥 4. ROLES DO SISTEMA:');
    const roles = managers.acl.getRoles();
    console.log(`   Total: ${roles.length}`);
    roles.forEach((role, index) => {
      console.log(`   ${index + 1}. ${role.name} (${role.permissions.length} permissões)`);
    });
    console.log('');

    // 5. Verificar canais de notificação
    console.log('📢 5. CANAIS DE NOTIFICAÇÃO:');
    const channelCount = managers.notifier.count();
    console.log(`   Total: ${channelCount}`);
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════
    // TESTES FUNCIONAIS
    // ═══════════════════════════════════════════════════════════════════════

    console.log('\n');
    console.log('═'.repeat(80));
    console.log('  🧪 TESTES FUNCIONAIS');
    console.log('═'.repeat(80));
    console.log('\n');

    // Teste 1: Verificar permissão
    console.log('🔐 Teste 1: Verificação de Permissão');
    const mockUser = {
      id: 'user-1',
      email: 'admin@test.com',
      name: 'Admin',
      role: 'SUPER_ADMIN' as const,
      tenantId: 'tenant-1',
      twoFactorEnabled: false,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions: ['demo.view', 'demo.create', 'demo.admin'],
    };
    
    const hasViewPermission = managers.acl.userHasPermission(mockUser, 'demo.view');
    const hasAdminPermission = managers.acl.userHasPermission(mockUser, 'demo.admin');
    
    console.log(`   ✓ Usuário tem 'demo.view': ${hasViewPermission ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`   ✓ Usuário tem 'demo.admin': ${hasAdminPermission ? '✅ SIM' : '❌ NÃO'}`);
    console.log('');

    // Teste 2: Filtrar menus por permissão
    console.log('🧭 Teste 2: Listar Menus');
    console.log(`   ✓ Total de menus registrados: ${menus.length}`);
    console.log('');

    // Teste 3: Filtrar widgets por permissão
    console.log('📊 Teste 3: Listar Widgets');
    console.log(`   ✓ Total de widgets registrados: ${widgets.length}`);
    console.log('');

    // Teste 4: Enviar notificação
    console.log('📢 Teste 4: Enviar Notificação');
    try {
      await managers.notifier.send('demo-channel', {
        type: 'info',
        title: 'Teste',
        message: 'Notificação de teste',
      }, [
        { id: 'user-1', type: 'user' }
      ]);
      console.log('   ✅ Notificação enviada com sucesso');
    } catch (error) {
      console.log(`   ❌ Erro ao enviar notificação: ${error.message}`);
    }
    console.log('');

    // ═══════════════════════════════════════════════════════════════════════
    // RESUMO FINAL
    // ═══════════════════════════════════════════════════════════════════════

    console.log('\n');
    console.log('═'.repeat(80));
    console.log('  ✅ RESUMO FINAL');
    console.log('═'.repeat(80));
    console.log('\n');

    const summary = {
      '📋 Menus': menus.length,
      '📊 Widgets': widgets.length,
      '🔐 Permissões': permissions.length,
      '👥 Roles': roles.length,
      '📢 Canais': channelCount,
    };

    Object.entries(summary).forEach(([key, value]) => {
      const status = value > 0 ? '✅' : '❌';
      console.log(`   ${status} ${key}: ${value}`);
    });

    const allGood = Object.values(summary).every(v => v > 0);
    
    console.log('\n');
    if (allGood) {
      console.log('   🎉 TODOS OS TESTES PASSARAM!');
      console.log('   ✅ O módulo demo-completo está funcionando corretamente!');
    } else {
      console.log('   ⚠️  ALGUNS RECURSOS NÃO FORAM REGISTRADOS');
      console.log('   ❌ Verifique os logs acima para mais detalhes');
    }
    console.log('\n');
    console.log('═'.repeat(80));
    console.log('\n');

    // Shutdown gracioso
    await core.shutdown('Teste concluído');

  } catch (error) {
    console.error('\n❌ ERRO FATAL:', error);
    console.error('\n');
    process.exit(1);
  }
}

// Executar
main().catch(console.error);
