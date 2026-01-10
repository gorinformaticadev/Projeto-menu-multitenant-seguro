const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTenantsColumns() {
    try {
        const columns = await prisma.$queryRaw`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'tenants' 
            ORDER BY ordinal_position
        `;
        
        console.log('Colunas da tabela tenants:');
        columns.forEach(col => {
            console.log(`- ${col.column_name}`);
        });
        
        // Testar consulta corrigida
        console.log('\nTestando consulta corrigida...');
        const sampleRoles = await prisma.$queryRaw`
            SELECT 
                t."nomeFantasia" as tenant_name,
                u.name as user_name,
                u.email as user_email,
                osr.is_technician,
                osr.is_attendant,
                osr.is_admin
            FROM mod_ordem_servico_user_roles osr
            JOIN tenants t ON osr.tenant_id = t.id
            JOIN users u ON osr.user_id = u.id
            LIMIT 3
        `;
        
        console.log('\nDados populados com sucesso:');
        sampleRoles.forEach(role => {
            console.log(`${role.user_name} (${role.user_email}) @ ${role.tenant_name}`);
            console.log(`  Tech: ${role.is_technician ? '✅' : '❌'} | Atend: ${role.is_attendant ? '✅' : '❌'} | Admin: ${role.is_admin ? '✅' : '❌'}`);
        });
        
    } catch (error) {
        console.error('Erro:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkTenantsColumns();