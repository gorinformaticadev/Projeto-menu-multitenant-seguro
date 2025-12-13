
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- DEBUGGING MODULE "ajuda" ---');

    // 1. Ver se o módulo existe
    const module = await prisma.module.findUnique({
        where: { name: 'ajuda' }
    });

    if (!module) {
        console.error('❌ Módulo "ajuda" NÃO encontrado no banco de dados!');
        return;
    }
    console.log('✅ Módulo "ajuda" encontrado:', {
        name: module.name,
        isActive: module.isActive,
        configLength: module.config?.length,
        config: module.config
    });

    // 2. Ver tenants
    const tenants = await prisma.tenant.findMany();
    console.log(`ℹ️ Total de tenants: ${tenants.length}`);

    // 3. Ver links TenantModule
    const links = await prisma.tenantModule.findMany({
        where: { moduleName: 'ajuda' },
        include: { tenant: { select: { nomeFantasia: true } } }
    });

    console.log(`ℹ️ Total de vínculos TenantModule para "ajuda": ${links.length}`);

    if (links.length === 0) {
        console.error('❌ NENHUM tenant tem o módulo "ajuda" vinculado, mesmo com o AutoLoader!');
    } else {
        links.forEach(l => {
            console.log(`   - Link com tenant "${l.tenant.nomeFantasia}" (ID: ${l.tenantId}): Ativo=${l.isActive}`);
            if (!l.isActive) {
                console.warn('     ⚠️ Módulo existe mas está INATIVO para este tenant');
            }
        });
    }

    // 4. Se não houver links, tentar criar manualmente para o primeiro tenant (provável tenant do usuário)
    if (links.length === 0 && tenants.length > 0) {
        console.log('🛠️ TENTANDO CORREÇÃO MANUAL: Vinculando ao primeiro tenant...');
        const t = tenants[0];
        await prisma.tenantModule.create({
            data: {
                tenantId: t.id,
                moduleName: 'ajuda',
                isActive: true
            }
        });
        console.log('✅ Correção aplicada. Módulo vinculado ao tenant:', t.nomeFantasia);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
