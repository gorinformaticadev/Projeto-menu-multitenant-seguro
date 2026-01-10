/* eslint-disable @typescript-eslint/no-var-requires */
const { PrismaClient } = require('@prisma/client');

const prismaClient = new PrismaClient();

async function populateData() {
    console.log('🔄 Populando dados iniciais para mod_ordem_servico_user_roles...\n');

    try {
        // Inserir papéis padrão para usuários existentes
        console.log('1. Inserindo papéis padrão para usuários...');
        
        const result = await prismaClient.$executeRaw`
            INSERT INTO mod_ordem_servico_user_roles (tenant_id, user_id, is_technician, is_attendant, is_admin)
            SELECT 
                u."tenantId" as tenant_id,
                u.id as user_id,
                CASE 
                    WHEN u.role = 'ADMIN' THEN true
                    ELSE false
                END as is_technician,
                true as is_attendant,
                CASE 
                    WHEN u.role = 'ADMIN' THEN true
                    ELSE false
                END as is_admin
            FROM users u
            WHERE u."tenantId" IS NOT NULL 
                AND u."isLocked" = false
                AND NOT EXISTS (
                    SELECT 1 FROM mod_ordem_servico_user_roles osr 
                    WHERE osr.tenant_id = u."tenantId" AND osr.user_id = u.id
                )
            ON CONFLICT (tenant_id, user_id) DO NOTHING
        `;
        
        console.log(`✅ ${result} registro(s) inserido(s) com sucesso`);
        
        // Inserir tipos de equipamento padrão
        console.log('\n2. Inserindo tipos de equipamento padrão...');
        
        const equipmentResult = await prismaClient.$executeRaw`
            INSERT INTO mod_ordem_servico_tipos_equipamento (tenant_id, nome, descricao)
            SELECT DISTINCT
                t.id as tenant_id,
                tipo.nome,
                tipo.descricao
            FROM tenants t
            CROSS JOIN (
                VALUES 
                    ('Computador', 'Desktop ou tower'),
                    ('Notebook', 'Laptop pessoal ou corporativo'),
                    ('Servidor', 'Servidor rack ou torre'),
                    ('Impressora', 'Jato de tinta, laser ou matricial'),
                    ('Scanner', 'Digitalizador de documentos'),
                    ('Monitor', 'Display LCD, LED ou CRT'),
                    ('Celular', 'Smartphone Android ou iOS'),
                    ('Tablet', 'iPad, Android tablet ou similares'),
                    ('Roteador', 'Roteador Wi-Fi residencial ou corporativo'),
                    ('Switch', 'Switch de rede managed ou unmanaged')
            ) AS tipo(nome, descricao)
            WHERE NOT EXISTS (
                SELECT 1 FROM mod_ordem_servico_tipos_equipamento tet 
                WHERE tet.tenant_id = t.id AND tet.nome = tipo.nome
            )
            ON CONFLICT (tenant_id, nome) DO NOTHING
        `;
        
        console.log(`✅ ${equipmentResult} tipo(s) de equipamento inserido(s) com sucesso`);
        
        // Verificar resultados finais
        console.log('\n3. Verificando resultados...');
        
        const userRolesCount = await prismaClient.$queryRaw`
            SELECT COUNT(*) as count FROM mod_ordem_servico_user_roles
        `;
        
        const equipmentTypesCount = await prismaClient.$queryRaw`
            SELECT COUNT(*) as count FROM mod_ordem_servico_tipos_equipamento
        `;
        
        console.log(`📊 Total de papéis de usuário: ${userRolesCount[0].count}`);
        console.log(`📊 Total de tipos de equipamento: ${equipmentTypesCount[0].count}`);
        
        if (userRolesCount[0].count > 0) {
            console.log('\n👥 Amostra de papéis de usuário:');
            const sampleRoles = await prismaClient.$queryRaw`
                SELECT 
                    t.nomeFantasia as tenant_name,
                    u.name as user_name,
                    u.email as user_email,
                    osr.is_technician,
                    osr.is_attendant,
                    osr.is_admin
                FROM mod_ordem_servico_user_roles osr
                JOIN tenants t ON osr.tenant_id = t.id
                JOIN users u ON osr.user_id = u.id
                LIMIT 5
            `;
            
            sampleRoles.forEach(role => {
                console.log(`   ${role.user_name} (${role.user_email}) @ ${role.tenant_name}`);
                console.log(`     Tech: ${role.is_technician ? '✅' : '❌'} | Atend: ${role.is_attendant ? '✅' : '❌'} | Admin: ${role.is_admin ? '✅' : '❌'}`);
            });
        }

        console.log('\n🎉 População de dados iniciais concluída com sucesso!');

    } catch (error) {
        console.error('❌ Erro durante população de dados:', error);
    } finally {
        await prismaClient.$disconnect();
    }
}

populateData();