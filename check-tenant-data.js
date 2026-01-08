const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:123456@localhost:5432/menu_tenant_db'
    }
  }
});

async function checkTenantData() {
  try {
    console.log('🔍 Verificando dados de tenant...');
    
    // Verificar tenants existentes
    const tenants = await prisma.$queryRawUnsafe(`
      SELECT id, name FROM tenants LIMIT 5
    `);
    
    console.log('🏢 Tenants encontrados:');
    tenants.forEach(t => {
      console.log(`  ${t.id}: ${t.name}`);
    });
    
    // Verificar permissões existentes
    const permissions = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT tenant_id, COUNT(*) as count
      FROM mod_ordem_servico_profile_permissions 
      GROUP BY tenant_id
      ORDER BY count DESC
    `);
    
    console.log('📊 Permissões por tenant:');
    permissions.forEach(p => {
      console.log(`  ${p.tenant_id}: ${p.count} permissões`);
    });
    
    // Mostrar algumas permissões de exemplo
    if (permissions.length > 0) {
      const sampleTenant = permissions[0].tenant_id;
      const sample = await prisma.$queryRawUnsafe(`
        SELECT profile, permission_id, allowed 
        FROM mod_ordem_servico_profile_permissions 
        WHERE tenant_id = $1
        ORDER BY profile, permission_id 
        LIMIT 6
      `, sampleTenant);
      
      console.log(`📋 Permissões de exemplo (tenant: ${sampleTenant}):`);
      sample.forEach(p => {
        console.log(`  ${p.profile}: ${p.permission_id} = ${p.allowed}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkTenantData();