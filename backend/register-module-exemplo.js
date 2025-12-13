const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function registerModuleExemplo() {
  try {
    console.log('🔄 Registrando module-exemplo...');

    // 1. Registrar o módulo na tabela modules
    const moduleData = {
      name: 'module-exemplo',
      displayName: 'Module Exemplo',
      description: 'Módulo de exemplo para demonstração do sistema modular',
      version: '1.0.0',
      isActive: true,
      config: JSON.stringify({
        menu: [
          {
            label: 'Página Principal',
            path: '/module-exemplo',
            icon: 'Home',
            order: 1
          },
          {
            label: 'Configurações',
            path: '/module-exemplo/settings',
            icon: 'Settings',
            order: 2
          }
        ],
        userMenu: [
          {
            label: 'Acesso rápido – Module Exemplo',
            path: '/module-exemplo',
            icon: 'Package'
          }
        ],
        dashboardWidgets: [
          {
            title: 'Widget do Module Exemplo',
            description: 'Widget de exemplo funcionando corretamente',
            type: 'info-card',
            icon: 'Package',
            actionUrl: '/module-exemplo',
            actionLabel: 'Acessar Módulo'
          }
        ],
        notifications: {
          events: [
            {
              name: 'module-exemplo-active',
              title: 'Module Exemplo',
              message: 'Notificação do Module Exemplo ativa.'
            }
          ]
        },
        slots: [
          {
            position: 'taskbar',
            content: 'Atalho do Module Exemplo',
            type: 'text'
          }
        ]
      })
    };

    // Verificar se já existe
    const existingModule = await prisma.module.findUnique({
      where: { name: 'module-exemplo' }
    });

    if (existingModule) {
      // Atualizar
      await prisma.module.update({
        where: { name: 'module-exemplo' },
        data: moduleData
      });
      console.log('✅ Module-exemplo atualizado');
    } else {
      // Criar
      await prisma.module.create({
        data: moduleData
      });
      console.log('✅ Module-exemplo criado');
    }

    // 2. Vincular a todos os tenants
    const allTenants = await prisma.tenant.findMany({ select: { id: true } });
    console.log(`📋 Encontrados ${allTenants.length} tenants`);

    if (allTenants.length > 0) {
      await prisma.tenantModule.createMany({
        data: allTenants.map(tenant => ({
          tenantId: tenant.id,
          moduleName: 'module-exemplo',
          isActive: true
        })),
        skipDuplicates: true
      });
      console.log(`✅ Module-exemplo vinculado a ${allTenants.length} tenants`);
    }

    console.log('🎉 Module-exemplo registrado com sucesso!');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

registerModuleExemplo();