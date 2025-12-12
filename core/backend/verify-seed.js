const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifySeed() {
  try {
    console.log('🔍 Verificando dados do seed...\n');

    // Verificar tenants
    const tenants = await prisma.tenant.findMany();
    console.log(`📊 Tenants encontrados: ${tenants.length}`);
    tenants.forEach(tenant => {
      console.log(`  - ${tenant.nomeFantasia} (${tenant.email})`);
    });

    // Verificar usuários
    const users = await prisma.user.findMany({
      include: {
        tenant: true
      }
    });
    console.log(`\n👥 Usuários encontrados: ${users.length}`);
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.role}) - Tenant: ${user.tenant?.nomeFantasia || 'N/A'}`);
    });

    // Verificar configurações de segurança
    const securityConfigs = await prisma.securityConfig.findMany();
    console.log(`\n🔒 Configurações de segurança: ${securityConfigs.length}`);
    securityConfigs.forEach(config => {
      console.log(`  - Tenant: ${config.tenantId || 'Global'}`);
      console.log(`    2FA Habilitado: ${config.twoFactorEnabled}`);
      console.log(`    Senha min: ${config.passwordMinLength} chars`);
      console.log(`    Maiúscula: ${config.passwordRequireUppercase}`);
      console.log(`    Minúscula: ${config.passwordRequireLowercase}`);
      console.log(`    Números: ${config.passwordRequireNumbers}`);
      console.log(`    Especiais: ${config.passwordRequireSpecial}`);
    });

    console.log('\n✅ Verificação concluída!');
  } catch (error) {
    console.error('❌ Erro ao verificar seed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifySeed();