/**
 * SCRIPT PARA POPULAR DADOS INICIAIS DE NOTIFICAÇÕES
 * 
 * Cria módulos e algumas notificações de exemplo
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedNotifications() {
  console.log('🌱 Iniciando seed de notificações...');

  try {
    // 1. Criar módulo exemplo se não existir
    const moduleExemplo = await prisma.module.upsert({
      where: { name: 'module-exemplo' },
      update: {},
      create: {
        name: 'module-exemplo',
        displayName: 'Module Exemplo',
        description: 'Módulo de exemplo para demonstração do sistema modular e de notificações',
        version: '1.0.0',
        isActive: true,
      },
    });

    console.log('✅ Módulo exemplo criado/atualizado');

    // 2. Buscar um tenant para criar notificações de exemplo
    const tenant = await prisma.tenant.findFirst({
      where: { ativo: true },
    });

    if (!tenant) {
      console.log('⚠️ Nenhum tenant encontrado. Criando notificações globais apenas.');
    }

    // 3. Buscar um usuário para criar notificações pessoais
    const user = await prisma.user.findFirst({
      where: { 
        tenantId: tenant?.id,
        role: { in: ['USER', 'ADMIN'] }
      },
    });

    // 4. Criar notificações de exemplo
    const notifications = [
      // Notificação global (super admin)
      {
        title: 'Sistema de Notificações Ativo',
        message: 'O sistema de notificações foi configurado e está funcionando corretamente.',
        severity: 'info',
        audience: 'super_admin',
        source: 'core',
        tenantId: null,
        userId: null,
        context: '/notificacoes',
        data: JSON.stringify({
          systemEvent: true,
          timestamp: new Date().toISOString(),
        }),
      },
      
      // Notificação do módulo exemplo (global)
      {
        title: 'Module Exemplo Disponível',
        message: 'O módulo exemplo está disponível para demonstração do sistema modular.',
        severity: 'info',
        audience: 'super_admin',
        source: 'module',
        module: 'module-exemplo',
        tenantId: null,
        userId: null,
        context: '/module-exemplo',
        data: JSON.stringify({
          moduleVersion: '1.0.0',
          features: ['notifications', 'sidebar', 'dashboard'],
        }),
      },
    ];

    // Adicionar notificações específicas do tenant se existir
    if (tenant) {
      notifications.push(
        // Notificação para admins do tenant
        {
          title: 'Bem-vindo ao Sistema',
          message: `Sua empresa ${tenant.nomeFantasia} foi configurada com sucesso no sistema.`,
          severity: 'info',
          audience: 'admin',
          source: 'core',
          tenantId: tenant.id,
          userId: null,
          context: '/dashboard',
          data: JSON.stringify({
            tenantSetup: true,
            tenantName: tenant.nomeFantasia,
          }),
        },
        
        // Notificação do módulo para o tenant
        {
          title: 'Module Exemplo Ativado',
          message: 'O módulo exemplo foi ativado para sua empresa e está pronto para uso.',
          severity: 'info',
          audience: 'admin',
          source: 'module',
          module: 'module-exemplo',
          tenantId: tenant.id,
          userId: null,
          context: '/module-exemplo',
          data: JSON.stringify({
            moduleActivated: true,
            activatedAt: new Date().toISOString(),
          }),
        }
      );
    }

    // Adicionar notificação pessoal se usuário existir
    if (user) {
      notifications.push({
        title: 'Conta Configurada',
        message: 'Sua conta foi configurada com sucesso. Explore as funcionalidades disponíveis.',
        severity: 'info',
        audience: 'user',
        source: 'core',
        tenantId: user.tenantId,
        userId: user.id,
        context: '/perfil',
        data: JSON.stringify({
          userSetup: true,
          userName: user.name,
        }),
      });
    }

    // Criar todas as notificações
    for (const notification of notifications) {
      await prisma.notification.create({
        data: notification,
      });
    }

    console.log(`✅ ${notifications.length} notificações de exemplo criadas`);

    // 5. Ativar módulo exemplo para o tenant se existir
    if (tenant) {
      await prisma.tenantModule.upsert({
        where: {
          tenantId_moduleName: {
            tenantId: tenant.id,
            moduleName: 'module-exemplo',
          },
        },
        update: {
          isActive: true,
        },
        create: {
          tenantId: tenant.id,
          moduleName: 'module-exemplo',
          isActive: true,
        },
      });

      console.log('✅ Module exemplo ativado para o tenant');
    }

    console.log('🎉 Seed de notificações concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro no seed de notificações:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar seed se chamado diretamente
if (require.main === module) {
  seedNotifications()
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { seedNotifications };