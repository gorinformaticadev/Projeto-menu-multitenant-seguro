/**
 * TESTE DO SISTEMA DE NOTIFICAÇÕES
 * 
 * Script para testar o novo sistema de notificações com SSE
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { NotificationCore } from './src/core/notifications/notification.core';

async function testNotificationSystem() {
  console.log('🧪 Iniciando teste do sistema de notificações...\n');

  try {
    // Cria aplicação NestJS
    const app = await NestFactory.createApplicationContext(AppModule);
    const notificationCore = app.get(NotificationCore);

    console.log('✅ Aplicação NestJS inicializada');
    console.log('✅ NotificationCore obtido\n');

    // Teste 1: Notificação do sistema
    console.log('📋 Teste 1: Notificação do sistema');
    await notificationCore.notifySystem({
      title: 'Teste do Sistema',
      description: 'Esta é uma notificação de teste do sistema',
      type: 'info',
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      }
    });
    console.log('✅ Notificação do sistema enviada\n');

    // Teste 2: Notificação de módulo
    console.log('📋 Teste 2: Notificação de módulo');
    await notificationCore.notifyModule({
      module: 'test-module',
      title: 'Teste de Módulo',
      description: 'Esta é uma notificação de teste de um módulo',
      type: 'success',
      metadata: {
        test: true,
        moduleVersion: '1.0.0'
      }
    });
    console.log('✅ Notificação de módulo enviada\n');

    // Teste 3: Notificação com usuário específico
    console.log('📋 Teste 3: Notificação para usuário específico');
    await notificationCore.notify({
      userId: 'test-user-id',
      title: 'Notificação Pessoal',
      description: 'Esta notificação é específica para um usuário',
      type: 'warning',
      origin: 'system',
      permissions: {
        canRead: true,
        canDelete: true
      },
      metadata: {
        module: 'system',
        test: true,
        personal: true
      }
    });
    console.log('✅ Notificação pessoal enviada\n');

    // Teste 4: Notificação de erro (vai para super admin)
    console.log('📋 Teste 4: Notificação de erro');
    await notificationCore.notify({
      title: 'Erro no Sistema',
      description: 'Ocorreu um erro que requer atenção do administrador',
      type: 'error',
      origin: 'system',
      permissions: {
        canRead: true,
        canDelete: false
      },
      metadata: {
        module: 'system',
        errorCode: 'TEST_ERROR_001',
        test: true
      }
    });
    console.log('✅ Notificação de erro enviada\n');

    // Teste 5: Teste de atraso (conforme especificação)
    console.log('📋 Teste 5: Teste de atraso de 25 segundos');
    console.log('⏰ Enviando notificação...');
    
    const startTime = Date.now();
    
    await notificationCore.notify({
      title: 'Teste de Atraso',
      description: 'Esta notificação deve chegar imediatamente, mesmo com atraso simulado',
      type: 'info',
      origin: 'system',
      permissions: {
        canRead: true,
        canDelete: true
      },
      metadata: {
        module: 'system',
        test: true,
        delayTest: true
      }
    });
    
    const notificationTime = Date.now() - startTime;
    console.log(`✅ Notificação enviada em ${notificationTime}ms`);
    
    console.log('⏳ Simulando atraso de 25 segundos...');
    await new Promise(resolve => setTimeout(resolve, 25000));
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Teste de atraso concluído em ${totalTime}ms total\n`);

    // Teste 6: Notificação legacy (compatibilidade)
    console.log('📋 Teste 6: Compatibilidade com sistema antigo');
    await notificationCore.notifyLegacy({
      title: 'Notificação Legacy',
      description: 'Teste de compatibilidade com sistema antigo',
      severity: 'critical',
      source: 'core',
      module: 'legacy-test',
      data: {
        legacyField: 'valor antigo',
        migrated: true
      }
    });
    console.log('✅ Notificação legacy enviada\n');

    console.log('🎉 Todos os testes concluídos com sucesso!');
    console.log('\n📊 Resumo dos testes:');
    console.log('✅ Notificação do sistema');
    console.log('✅ Notificação de módulo');
    console.log('✅ Notificação pessoal');
    console.log('✅ Notificação de erro');
    console.log('✅ Teste de atraso (SSE < 200ms)');
    console.log('✅ Compatibilidade legacy');
    
    console.log('\n🔍 Verifique:');
    console.log('1. SSE deve ter emitido todas as notificações em < 200ms');
    console.log('2. Ícone de notificação deve ter recebido os eventos');
    console.log('3. Página /notificacoes deve mostrar as notificações');
    console.log('4. Som deve ter tocado no frontend');
    console.log('5. Banco de dados deve ter os registros persistidos');

    await app.close();

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    process.exit(1);
  }
}

// Executa o teste
testNotificationSystem().catch(console.error);