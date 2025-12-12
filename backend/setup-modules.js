/**
 * Script para configurar módulos no sistema
 * Este script cria as tabelas de módulos e popula com módulos de exemplo
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupModules() {
  console.log('🔧 Configurando módulos do sistema...');

  try {
    // Criar módulos de exemplo
    const modules = [
      {
        name: 'sales',
        displayName: 'Sistema de Vendas',
        description: 'Módulo completo para gestão de vendas, pedidos e clientes',
        version: '1.0.0',
        config: JSON.stringify({
          features: ['orders', 'customers', 'products', 'reports'],
          permissions: ['view_sales', 'create_order', 'manage_customers']
        })
      },
      {
        name: 'inventory',
        displayName: 'Controle de Estoque',
        description: 'Gestão completa de estoque, produtos e movimentações',
        version: '1.2.0',
        config: JSON.stringify({
          features: ['stock_control', 'product_management', 'movements'],
          permissions: ['view_inventory', 'manage_stock', 'view_reports']
        })
      },
      {
        name: 'financial',
        displayName: 'Módulo Financeiro',
        description: 'Controle financeiro com contas a pagar, receber e fluxo de caixa',
        version: '2.0.0',
        config: JSON.stringify({
          features: ['accounts_payable', 'accounts_receivable', 'cash_flow'],
          permissions: ['view_financial', 'manage_accounts', 'view_reports']
        })
      },
      {
        name: 'reports',
        displayName: 'Relatórios Avançados',
        description: 'Relatórios personalizados e dashboards interativos',
        version: '1.5.0',
        config: JSON.stringify({
          features: ['custom_reports', 'dashboards', 'data_export'],
          permissions: ['view_reports', 'create_reports', 'export_data']
        })
      },
      {
        name: 'crm',
        displayName: 'CRM - Gestão de Clientes',
        description: 'Sistema de relacionamento com clientes e gestão de leads',
        version: '1.1.0',
        config: JSON.stringify({
          features: ['lead_management', 'customer_history', 'follow_up'],
          permissions: ['view_crm', 'manage_leads', 'view_customer_data']
        })
      },
      {
        name: 'hr',
        displayName: 'Recursos Humanos',
        description: 'Gestão de funcionários, folha de pagamento e benefícios',
        version: '1.0.0',
        config: JSON.stringify({
          features: ['employee_management', 'payroll', 'benefits'],
          permissions: ['view_hr', 'manage_employees', 'process_payroll']
        })
      }
    ];

    console.log('📦 Criando módulos...');
    
    for (const moduleData of modules) {
      try {
        const existingModule = await prisma.module.findUnique({
          where: { name: moduleData.name }
        });

        if (existingModule) {
          console.log(`⚠️  Módulo '${moduleData.name}' já existe, atualizando...`);
          await prisma.module.update({
            where: { name: moduleData.name },
            data: {
              displayName: moduleData.displayName,
              description: moduleData.description,
              version: moduleData.version,
              config: moduleData.config
            }
          });
        } else {
          await prisma.module.create({
            data: moduleData
          });
          console.log(`✅ Módulo '${moduleData.displayName}' criado com sucesso`);
        }
      } catch (error) {
        console.error(`❌ Erro ao criar módulo '${moduleData.name}':`, error.message);
      }
    }

    // Ativar alguns módulos para a empresa padrão (se existir)
    console.log('\n🏢 Configurando módulos para empresa padrão...');
    
    const defaultTenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { email: 'empresa1@example.com' },
          { nomeFantasia: { contains: 'GOR' } }
        ]
      }
    });

    if (defaultTenant) {
      const defaultModules = ['sales', 'inventory', 'reports'];
      
      for (const moduleName of defaultModules) {
        try {
          const existingTenantModule = await prisma.tenantModule.findUnique({
            where: {
              tenantId_moduleName: {
                tenantId: defaultTenant.id,
                moduleName: moduleName
              }
            }
          });

          if (!existingTenantModule) {
            await prisma.tenantModule.create({
              data: {
                tenantId: defaultTenant.id,
                moduleName: moduleName,
                isActive: true
              }
            });
            console.log(`✅ Módulo '${moduleName}' ativado para ${defaultTenant.nomeFantasia}`);
          } else {
            console.log(`⚠️  Módulo '${moduleName}' já está configurado para ${defaultTenant.nomeFantasia}`);
          }
        } catch (error) {
          console.error(`❌ Erro ao ativar módulo '${moduleName}':`, error.message);
        }
      }
    } else {
      console.log('⚠️  Empresa padrão não encontrada, pulando configuração automática');
    }

    console.log('\n📊 Resumo dos módulos criados:');
    const allModules = await prisma.module.findMany({
      orderBy: { displayName: 'asc' }
    });

    allModules.forEach(module => {
      console.log(`  • ${module.displayName} (${module.name}) - v${module.version}`);
    });

    console.log(`\n✅ Configuração concluída! ${allModules.length} módulos disponíveis no sistema.`);

  } catch (error) {
    console.error('❌ Erro durante a configuração:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  setupModules().catch(console.error);
}

module.exports = { setupModules };