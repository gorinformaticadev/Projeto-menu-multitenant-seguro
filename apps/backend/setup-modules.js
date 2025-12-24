/**
 * Script para configurar módulos no sistema (setup-modules.js)
 * Atualiza a tabela 'modules' com as definições corretas e caminhos de entrada.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setupModules() {
  console.log('🔧 Configurando módulos do sistema (Via Banco de Dados)...');

  try {
    const modulesToInstall = [
      {
        slug: 'sistema',
        name: 'Sistema Core',
        version: '1.0.0',
        description: 'Módulo principal do sistema',
        enabled: true,
        // Entry point relativo ao CWD (apps/backend)
        backendEntry: '../../packages/modules/sistema3/backend/sistema.module',
        hasBackend: true,
        status: 'active'
      },
      // Exemplo de módulo financeiro (usando mocks para caminhos por enquanto se não existirem)
      {
        slug: 'financeiro',
        name: 'Financeiro',
        version: '1.0.0',
        description: 'Gestão Financeira',
        enabled: false,
        backendEntry: '@modules/financeiro/backend/module',
        hasBackend: true,
        status: 'disabled'
      }
    ];

    console.log('📦 Sincronizando módulos...');

    for (const mod of modulesToInstall) {
      const existing = await prisma.module.findUnique({
        where: { slug: mod.slug }
      });

      if (existing) {
        console.log(`🔄 Atualizando módulo: ${mod.name}`);
        await prisma.module.update({
          where: { slug: mod.slug },
          data: {
            name: mod.name,
            version: mod.version,
            description: mod.description,
            backendEntry: mod.backendEntry,
            // Não sobrescrevemos enabled se já existir, para respeitar escolha do usuário?
            // O comando diz: "Ao instalar ... cria (ou atualize) ... defina enabled = true"
            enabled: true,
            status: mod.status, // Alinha status
            hasBackend: mod.hasBackend
          }
        });
      } else {
        console.log(`✨ Criando módulo: ${mod.name}`);
        await prisma.module.create({
          data: {
            slug: mod.slug,
            name: mod.name,
            version: mod.version,
            description: mod.description,
            backendEntry: mod.backendEntry,
            enabled: mod.enabled,
            status: mod.status,
            hasBackend: mod.hasBackend,
            installedAt: new Date()
          }
        });
      }
    }

    console.log('✅ Setup de módulos concluído!');

  } catch (error) {
    console.error('❌ Erro no setup de módulos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  setupModules();
}

module.exports = { setupModules };