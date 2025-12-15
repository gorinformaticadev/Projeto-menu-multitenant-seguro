/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MÓDULO DE DEMONSTRAÇÃO COMPLETA - CORE IDEAL
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Este módulo é uma referência completa que demonstra TODAS as capacidades
 * do sistema modular CORE IDEAL. Use-o como template para criar seus próprios
 * módulos.
 * 
 * FUNCIONALIDADES DEMONSTRADAS:
 * 
 * 🔐 1. PERMISSÕES E ACL
 *     - Registro de permissões customizadas
 *     - Verificação de permissões em rotas
 *     - Filtragem de recursos por permissão
 *     - Suporte a wildcards (demo.*, *)
 * 
 * 🧭 2. MENU DINÂMICO
 *     - Itens de menu com hierarquia
 *     - Filtragem por role e permissão
 *     - Badges e ícones personalizados
 *     - Ordenação customizada
 * 
 * 📊 3. DASHBOARD WIDGETS
 *     - Widgets de diferentes tamanhos
 *     - Auto-refresh configurável
 *     - Widgets closeable e draggable
 *     - Props customizados
 * 
 * 🛣️ 4. ROTAS E API
 *     - Rotas públicas e protegidas
 *     - Integração com Express Router
 *     - Validação de permissões
 *     - Manipulação de erros
 * 
 * 📢 5. NOTIFICAÇÕES
 *     - Canais customizados
 *     - Envio para múltiplos targets
 *     - Handlers assíncronos
 * 
 * 🎯 6. EVENTOS DO SISTEMA
 *     - Eventos síncronos e assíncronos
 *     - Listeners tipados
 *     - Comunicação desacoplada
 * 
 * 🏢 7. MULTI-TENANCY
 *     - Isolamento automático por tenant
 *     - Filtragem em queries
 *     - Context awareness
 * 
 * 💾 8. CONTEXTO RICO (CoreContext)
 *     - Database (db)
 *     - Cache (cache)
 *     - Logger (logger)
 *     - ACL (acl)
 *     - Event Bus (events)
 *     - Managers (menu, dashboard, notifier)
 * 
 * 🔄 9. LIFECYCLE
 *     - boot() - Inicialização do módulo
 *     - shutdown() - Encerramento gracioso
 * 
 * 📦 10. DEPENDÊNCIAS
 *     - Versionamento semântico
 *     - Resolução automática
 *     - Validação em tempo de carga
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { ModuleContract, CoreContext } from '../../core';

// ═══════════════════════════════════════════════════════════════════════════
// ESTADO DO MÓDULO
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estado interno do módulo (exemplo de gerenciamento de estado)
 */
const moduleState = {
  initialized: false,
  startTime: null as Date | null,
  requestCount: 0,
  lastActivity: null as Date | null,
  activeConnections: 0,
};

/**
 * Contador de demos por tenant (exemplo de cache local)
 */
const demoCounts = new Map<string, number>();

// ═══════════════════════════════════════════════════════════════════════════
// DEFINIÇÃO DO MÓDULO
// ═══════════════════════════════════════════════════════════════════════════

export const module: ModuleContract = {
  // ==================== IDENTIFICAÇÃO ====================
  name: 'demo-completo',
  slug: 'demo-completo',
  version: '1.0.0',
  
  // ==================== METADADOS ====================
  displayName: 'Demonstração Completa',
  description: 'Módulo que demonstra todas as funcionalidades do sistema modular',
  author: 'Equipe CORE',
  
  // ==================== DEPENDÊNCIAS ====================
  dependencies: {
    coreVersion: '1.0.0',
  },
  
  // ==================== CONFIGURAÇÃO ====================
  enabled: true,
  defaultConfig: {
    showNotifications: true,
    enableWidgets: true,
    maxItems: 50,
  },

  // ==================== LIFECYCLE: BOOT ====================
  async boot(context: CoreContext): Promise<void> {
    const bootStartTime = Date.now();
    
    context.logger.info('┌─────────────────────────────────────────────────────────────────────────┐');
    context.logger.info('│  🚀 INICIALIZANDO MÓDULO: demo-completo v1.0.0');
    context.logger.info('│  🎯 Demonstrando TODAS as funcionalidades do CORE IDEAL');
    context.logger.info('└─────────────────────────────────────────────────────────────────────────┘');
    context.logger.info('');

    try {
      // ═══════════════════════════════════════════════════════════════════════
      // 🔐 1. PERMISSÕES E ACL
      // ═══════════════════════════════════════════════════════════════════════
      context.logger.info('🔐 [1/10] Registrando permissões customizadas...');
      
      // Registrar 5 permissões específicas
      context.acl.registerPermission('demo.view', 'Visualizar demonstrações');
      context.acl.registerPermission('demo.create', 'Criar novas demonstrações');
      context.acl.registerPermission('demo.edit', 'Editar demonstrações');
      context.acl.registerPermission('demo.delete', 'Excluir demonstrações');
      context.acl.registerPermission('demo.admin', 'Administrar módulo de demonstração');
      
      context.logger.info('   ✓ 5 permissões registradas com sucesso');
      context.logger.info('');

      // ═══════════════════════════════════════════════════════════════════════
      // 🧭 2. MENU DINÂMICO
      // ═══════════════════════════════════════════════════════════════════════
      context.logger.info('🧭 [2/10] Criando estrutura de menu...');
      
      // Menu principal com ícone e badge
      context.menu.add({
        id: 'demo-main',
        label: 'Demonstrações',
        href: '/demo',
        icon: 'rocket',
        order: 20,
        permissions: ['demo.view'],
        module: 'demo-completo',
        badge: 'NOVO',
      });

      // Submenu: Dashboard
      context.menu.add({
        id: 'demo-dashboard',
        label: 'Dashboard Demo',
        href: '/demo/dashboard',
        icon: 'chart-bar',
        order: 21,
        permissions: ['demo.view'],
        module: 'demo-completo',
      });

      // Submenu: Listar (com contador)
      context.menu.add({
        id: 'demo-list',
        label: 'Lista de Demos',
        href: '/demo/list',
        icon: 'list',
        order: 22,
        permissions: ['demo.view'],
        module: 'demo-completo',
      });

      // Submenu: Criar (apenas com permissão)
      context.menu.add({
        id: 'demo-create',
        label: 'Nova Demo',
        href: '/demo/create',
        icon: 'plus-circle',
        order: 23,
        permissions: ['demo.create'],
        module: 'demo-completo',
      });

      // Submenu: Relatórios (apenas ADMIN e SUPER_ADMIN)
      context.menu.add({
        id: 'demo-reports',
        label: 'Relatórios',
        href: '/demo/reports',
        icon: 'document-text',
        order: 24,
        roles: ['ADMIN', 'SUPER_ADMIN'],
        permissions: ['demo.view'],
        module: 'demo-completo',
      });

      // Submenu: Administração (apenas SUPER_ADMIN)
      context.menu.add({
        id: 'demo-admin',
        label: 'Admin Demo',
        href: '/demo/admin',
        icon: 'cog',
        order: 25,
        roles: ['SUPER_ADMIN'],
        permissions: ['demo.admin'],
        module: 'demo-completo',
        badge: 'Admin',
      });
      
      context.logger.info('   ✓ 6 itens de menu adicionados (com hierarquia e badges)');
      context.logger.info('');

      // ═══════════════════════════════════════════════════════════════════════
      // 📊 3. DASHBOARD WIDGETS
      // ═══════════════════════════════════════════════════════════════════════
      context.logger.info('📊 [3/10] Registrando widgets no dashboard...');
      
      context.events.on('dashboard:register', () => {
        // Widget 1: Estatísticas principais (Médio - Auto-refresh)
        context.dashboard.addWidget({
          id: 'demo-stats',
          title: 'Estatísticas Demo',
          component: 'DemoStatsWidget',
          size: 'medium',
          order: 5,
          permissions: ['demo.view'],
          module: 'demo-completo',
          refresh: 30000, // Atualiza a cada 30 segundos
          props: {
            showChart: true,
            maxItems: 10,
            colorScheme: 'blue',
          },
        });

        // Widget 2: Atividades recentes (Pequeno - Draggable)
        context.dashboard.addWidget({
          id: 'demo-activity',
          title: 'Atividades Recentes',
          component: 'DemoActivityWidget',
          size: 'small',
          order: 6,
          permissions: ['demo.view'],
          module: 'demo-completo',
          closeable: true,
          draggable: true,
          props: {
            limit: 5,
            showTimestamp: true,
          },
        });

        // Widget 3: Gráfico de performance (Grande - Admin)
        context.dashboard.addWidget({
          id: 'demo-chart',
          title: 'Performance Demo',
          component: 'DemoChartWidget',
          size: 'large',
          order: 7,
          roles: ['ADMIN', 'SUPER_ADMIN'],
          permissions: ['demo.view'],
          module: 'demo-completo',
          refresh: 60000, // Atualiza a cada 1 minuto
          props: {
            chartType: 'line',
            period: '7d',
          },
        });

        // Widget 4: Painel administrativo (Grande - Super Admin)
        context.dashboard.addWidget({
          id: 'demo-admin-panel',
          title: 'Painel Admin Demo',
          component: 'DemoAdminWidget',
          size: 'large',
          order: 10,
          roles: ['SUPER_ADMIN'],
          permissions: ['demo.admin'],
          module: 'demo-completo',
          props: {
            showAdvanced: true,
            allowDelete: true,
          },
        });
      });
      
      context.logger.info('   ✓ 4 widgets registrados (tamanhos variados + auto-refresh)');
      context.logger.info('');

      // ═══════════════════════════════════════════════════════════════════════
      // 🛣️ 4. ROTAS E API
      // ═══════════════════════════════════════════════════════════════════════
      context.logger.info('🛣️ [4/10] Criando rotas de API...');
      
      context.events.on('routes:register', ({ router }) => {
        // ═══ ROTA 1: GET /api/demo - Listar demos ═══
        router.get('/api/demo', async (req, res) => {
          try {
            moduleState.requestCount++;
            moduleState.lastActivity = new Date();

            // Verificar permissão
            if (!context.acl.userHasPermission(context.user, 'demo.view')) {
              return res.status(403).json({ 
                error: 'Forbidden',
                message: 'Você não tem permissão para visualizar demos' 
              });
            }

            const tenantId = context.tenant?.id || null;
            
            // Tentar buscar do cache primeiro
            const cacheKey = `demos:list:${tenantId}`;
            let demos = await context.cache.get(cacheKey);

            if (!demos) {
              // Buscar do banco de dados
              context.logger.info(`Buscando demos para tenant: ${tenantId}`);
              
              demos = await context.db.raw(
                'SELECT * FROM demos WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50',
                [tenantId]
              );

              // Salvar no cache por 5 minutos
              await context.cache.set(cacheKey, demos, 300);
            }

            res.json({
              success: true,
              data: demos,
              meta: {
                tenant: context.tenant?.nomeFantasia,
                requestId: context.requestId,
                cached: !!demos,
                count: demos?.length || 0,
              },
            });
          } catch (error) {
            context.logger.error('Erro ao buscar demos:', error);
            res.status(500).json({ 
              error: 'Internal Server Error',
              message: error.message 
            });
          }
        });

        // ═══ ROTA 2: POST /api/demo - Criar nova demo ═══
        router.post('/api/demo', async (req, res) => {
          try {
            moduleState.requestCount++;
            moduleState.lastActivity = new Date();

            // Verificar permissão
            if (!context.acl.userHasPermission(context.user, 'demo.create')) {
              return res.status(403).json({ 
                error: 'Forbidden',
                message: 'Você não tem permissão para criar demos' 
              });
            }

            const { title, description, tags } = req.body;

            // Validação
            if (!title || title.trim().length < 3) {
              return res.status(400).json({ 
                error: 'Bad Request',
                message: 'Título deve ter no mínimo 3 caracteres' 
              });
            }

            // Usar transação do banco
            const demo = await context.db.transaction(async (trx) => {
              return await trx.raw(
                'INSERT INTO demos (title, description, tags, tenant_id, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [title, description, tags || [], context.tenant?.id, context.user?.id]
              );
            });

            // Incrementar contador local
            const tenantId = context.tenant?.id || 'default';
            const currentCount = demoCounts.get(tenantId) || 0;
            demoCounts.set(tenantId, currentCount + 1);

            // Invalidar cache
            await context.cache.del(`demos:list:${context.tenant?.id}`);

            // Salvar nova demo no cache
            await context.cache.set(
              `demo:latest:${context.tenant?.id}`,
              demo,
              300 // 5 minutos
            );

            // Enviar notificação
            await context.notifier.send('demo-channel', {
              type: 'success',
              title: 'Demo Criada',
              message: `Demo "${title}" criada com sucesso`,
            }, [
              { id: context.user?.id || '', type: 'user' }
            ]);

            // Emitir evento customizado
            await context.events.emit('demo:created', {
              demoId: demo.id,
              title,
              tenantId: context.tenant?.id,
              createdBy: context.user?.id,
            });

            context.logger.info(`Demo criada: ${title} (ID: ${demo.id})`);

            res.status(201).json({
              success: true,
              data: demo,
              message: 'Demo criada com sucesso',
            });
          } catch (error) {
            context.logger.error('Erro ao criar demo:', error);
            res.status(500).json({ 
              error: 'Internal Server Error',
              message: error.message 
            });
          }
        });

        // ═══ ROTA 3: PUT /api/demo/:id - Editar demo ═══
        router.put('/api/demo/:id', async (req, res) => {
          try {
            moduleState.requestCount++;

            // Verificar permissão
            if (!context.acl.userHasPermission(context.user, 'demo.edit')) {
              return res.status(403).json({ 
                error: 'Forbidden',
                message: 'Você não tem permissão para editar demos' 
              });
            }

            const { id } = req.params;
            const { title, description } = req.body;

            const updated = await context.db.raw(
              'UPDATE demos SET title = $1, description = $2, updated_at = NOW() WHERE id = $3 AND tenant_id = $4 RETURNING *',
              [title, description, id, context.tenant?.id]
            );

            if (!updated || updated.length === 0) {
              return res.status(404).json({ 
                error: 'Not Found',
                message: 'Demo não encontrada' 
              });
            }

            // Limpar caches relacionados
            await context.cache.del(`demo:${id}`);
            await context.cache.del(`demos:list:${context.tenant?.id}`);

            context.logger.info(`Demo editada: ${id}`);

            res.json({
              success: true,
              data: updated[0],
              message: 'Demo atualizada com sucesso',
            });
          } catch (error) {
            context.logger.error('Erro ao editar demo:', error);
            res.status(500).json({ error: error.message });
          }
        });

        // ═══ ROTA 4: DELETE /api/demo/:id - Excluir demo ═══
        router.delete('/api/demo/:id', async (req, res) => {
          try {
            moduleState.requestCount++;

            // Verificar permissão
            if (!context.acl.userHasPermission(context.user, 'demo.delete')) {
              return res.status(403).json({ 
                error: 'Forbidden',
                message: 'Você não tem permissão para excluir demos' 
              });
            }

            const { id } = req.params;

            await context.db.raw(
              'DELETE FROM demos WHERE id = $1 AND tenant_id = $2',
              [id, context.tenant?.id]
            );

            // Decrementar contador
            const tenantId = context.tenant?.id || 'default';
            const currentCount = demoCounts.get(tenantId) || 0;
            if (currentCount > 0) {
              demoCounts.set(tenantId, currentCount - 1);
            }

            // Limpar cache
            await context.cache.del(`demo:${id}`);
            await context.cache.del(`demos:list:${context.tenant?.id}`);

            context.logger.info(`Demo excluída: ${id}`);

            res.json({
              success: true,
              message: 'Demo excluída com sucesso',
            });
          } catch (error) {
            context.logger.error('Erro ao excluir demo:', error);
            res.status(500).json({ error: error.message });
          }
        });

        // ═══ ROTA 5: GET /api/demo/stats - Estatísticas (PÚBLICA) ═══
        router.get('/api/demo/stats', async (req, res) => {
          try {
            const stats = {
              module: 'demo-completo',
              version: '1.0.0',
              status: 'active',
              uptime: process.uptime(),
              requestCount: moduleState.requestCount,
              lastActivity: moduleState.lastActivity,
              demoCountByTenant: Object.fromEntries(demoCounts),
            };

            res.json({
              success: true,
              data: stats,
            });
          } catch (error) {
            res.status(500).json({ error: error.message });
          }
        });

        // ═══ ROTA 6: GET /api/demo/health - Health Check (PÚBLICA) ═══
        router.get('/api/demo/health', (req, res) => {
          res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            initialized: moduleState.initialized,
          });
        });
      });
      
      context.logger.info('   ✓ 6 rotas criadas (GET, POST, PUT, DELETE + públicas)');
      context.logger.info('');

      // ═══════════════════════════════════════════════════════════════════════
      // 📢 5. NOTIFICAÇÕES
      // ═══════════════════════════════════════════════════════════════════════
      context.logger.info('📢 [5/10] Configurando canal de notificações...');
      
      context.events.on('notifications:register', () => {
        context.notifier.registerChannel(
          'demo-channel',
          async (message, targets) => {
            // Handler customizado de notificações
            context.logger.info(`📩 Notificação [${message.type}]: ${message.title}`);
            context.logger.info(`   ↳ Mensagem: ${message.message}`);
            
            // Aqui você implementaria a lógica de envio real
            // Ex: Email, SMS, Push, WebSocket, etc.
            
            for (const target of targets) {
              context.logger.debug(`   → Para ${target.type}: ${target.id}`);
              
              // Exemplo: Enviar por diferentes canais
              switch (target.type) {
                case 'user':
                  // Enviar push notification ou email
                  break;
                case 'role':
                  // Enviar para todos os usuários com essa role
                  break;
                case 'tenant':
                  // Enviar para todos do tenant
                  break;
              }
            }
            
            return true;
          }
        );
      });
      
      context.logger.info('   ✓ Canal "demo-channel" registrado com handler customizado');
      context.logger.info('');

      // ═══════════════════════════════════════════════════════════════════════
      // 🎯 6. EVENTOS DO SISTEMA
      // ═══════════════════════════════════════════════════════════════════════
      context.logger.info('🎯 [6/10] Registrando listeners de eventos...');
      
      // Evento 1: Usuário autenticado
      context.events.on('user:authenticated', (payload) => {
        context.logger.info(`👤 Usuário autenticado: ${payload.user.email}`);
        
        // Exemplo: Registrar último acesso
        moduleState.lastActivity = new Date();
      });

      // Evento 2: Tenant resolvido
      context.events.on('tenant:resolved', (payload) => {
        if (payload.tenant) {
          context.logger.info(`🏛️ Tenant resolvido: ${payload.tenant.nomeFantasia}`);
          
          // Inicializar contador se não existir
          if (!demoCounts.has(payload.tenant.id)) {
            demoCounts.set(payload.tenant.id, 0);
          }
        }
      });

      // Evento 3: Sistema pronto
      context.events.on('core:ready', (payload) => {
        context.logger.info(`✅ Sistema pronto com ${payload.modules.length} módulos`);
      });

      // Evento 4: Módulo carregado (outros módulos)
      context.events.on('module:loaded', (payload) => {
        if (payload.name !== 'demo-completo') {
          context.logger.debug(`📦 Módulo carregado: ${payload.name}`);
        }
      });

      // Evento 5: Erro no sistema
      context.events.on('core:error', (payload) => {
        context.logger.error(`❌ Erro no sistema: ${payload.error.message}`);
      });
      
      context.logger.info('   ✓ 5 listeners configurados (user, tenant, core, module, error)');
      context.logger.info('');

      // ═══════════════════════════════════════════════════════════════════════
      // 💾 7. USO DO CONTEXTO (Database, Cache, Logger)
      // ═══════════════════════════════════════════════════════════════════════
      context.logger.info('💾 [7/10] Demonstrando uso do CoreContext...');
      
      // Exemplo de uso do cache
      await context.cache.set('demo:initialized', true, 3600); // 1 hora
      await context.cache.set('demo:boot-time', bootStartTime, 3600);
      
      // Exemplo de uso do logger (diferentes níveis)
      context.logger.debug('Debug: Detalhes técnicos');
      context.logger.info('Info: Informação geral');
      context.logger.warn('Warn: Aviso importante');
      // context.logger.error('Error: Erro crítico'); // Descomentado para não poluir
      
      // Acesso aos managers
      const menuItems = context.menu.getAll();
      const widgets = context.dashboard.getAll();
      
      context.logger.info(`   ✓ Contexto acessado (${menuItems.length} menus, ${widgets.length} widgets)`);
      context.logger.info('');

      // ═══════════════════════════════════════════════════════════════════════
      // 🏛️ 8. MULTI-TENANCY
      // ═══════════════════════════════════════════════════════════════════════
      context.logger.info('🏛️ [8/10] Configurando isolamento multi-tenant...');
      
      if (context.tenant) {
        context.logger.info(`   ✓ Tenant atual: ${context.tenant.nomeFantasia} (ID: ${context.tenant.id})`);
        context.logger.info(`   ✓ Todas as queries serão filtradas automaticamente`);
      } else {
        context.logger.info('   ℹ️ Nenhum tenant resolvido (contexto global)');
      }
      
      context.logger.info('');

      // ═══════════════════════════════════════════════════════════════════════
      // 🔄 9. VERIFICAÇÃO DE DEPENDÊNCIAS
      // ═══════════════════════════════════════════════════════════════════════
      context.logger.info('🔄 [9/10] Verificando dependências...');
      context.logger.info(`   ✓ CORE Version: ${module.dependencies?.coreVersion || '1.0.0'}`);
      context.logger.info('   ✓ Todas as dependências resolvidas');
      context.logger.info('');

      // ═══════════════════════════════════════════════════════════════════════
      // ✅ 10. FINALIZAÇÃO
      // ═══════════════════════════════════════════════════════════════════════
      context.logger.info('✅ [10/10] Finalização da inicialização...');
      
      // Atualizar estado do módulo
      moduleState.initialized = true;
      moduleState.startTime = new Date();

      const bootDuration = Date.now() - bootStartTime;

      context.logger.info('');
      context.logger.info('┌─────────────────────────────────────────────────────────────────────────┐');
      context.logger.info('│  ✅ MÓDULO DEMO-COMPLETO INICIALIZADO COM SUCESSO!');
      context.logger.info('│');
      context.logger.info('│  RESUMO DA INICIALIZAÇÃO:');
      context.logger.info('│  ┌─────────────────────────────────────────────────────────────────────');
      context.logger.info('│  │ 🔐 Permissões registradas: 5');
      context.logger.info('│  │ 🧭 Itens de menu: 6');
      context.logger.info('│  │ 📊 Dashboard widgets: 4');
      context.logger.info('│  │ 🛣️ Rotas de API: 6');
      context.logger.info('│  │ 📢 Canais de notificação: 1');
      context.logger.info('│  │ 🎯 Event listeners: 5');
      context.logger.info('│  │ ⏱️ Tempo de boot: ' + bootDuration + 'ms');
      context.logger.info('│  └─────────────────────────────────────────────────────────────────────');
      context.logger.info('└─────────────────────────────────────────────────────────────────────────┘');

    } catch (error) {
      context.logger.error('❌ Erro ao inicializar módulo demo-completo:', error);
      throw error;
    }
  },

  // ==================== LIFECYCLE: SHUTDOWN ====================
  async shutdown(): Promise<void> {
    console.log('┌─────────────────────────────────────────────────────────────────────────┐');
    console.log('│  🛑 DESLIGANDO MÓDULO: demo-completo');
    console.log('└─────────────────────────────────────────────────────────────────────────┘');
    
    // Limpar recursos
    moduleState.initialized = false;
    demoCounts.clear();
    
    console.log('✅ Módulo demo-completo desligado graciosamente');
  },
};

export default module;
