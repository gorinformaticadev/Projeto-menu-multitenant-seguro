import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function registerModule() {
  try {
    // Verificar se o módulo já existe
    const existingModule = await prisma.module.findUnique({
      where: { name: 'ajuda' }
    });

    if (existingModule) {
      console.log('Módulo "ajuda" já está registrado no banco de dados');
      console.log('Dados atuais:', existingModule);
      return;
    }

    // Registrar o módulo no banco de dados
    const module = await prisma.module.create({
      data: {
        name: 'ajuda',
        displayName: 'Sobre',
        description: 'Módulo de ajuda com informações sobre o projeto',
        version: '1.0.0',
        isActive: true,
        config: JSON.stringify({
          author: 'Equipe de Desenvolvimento',
          dependencies: {
            coreVersion: '^1.0.0'
          },
          permissions: [
            {
              name: 'ajuda.view',
              description: 'Permite visualizar a página de ajuda'
            }
          ],
          routes: [
            {
              path: '/ajuda',
              permission: 'ajuda.view'
            }
          ],
          menu: [
            {
              name: 'Sobre',
              icon: 'HelpCircle',
              path: '/ajuda',
              permission: 'ajuda.view'
            }
          ]
        })
      }
    });

    console.log('Módulo "ajuda" registrado com sucesso!');
    console.log('Dados registrados:', module);
  } catch (error) {
    console.error('Erro ao registrar o módulo:', error);
  } finally {
    await prisma.$disconnect();
  }
}

registerModule();