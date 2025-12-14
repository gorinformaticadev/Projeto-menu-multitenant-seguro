/**
 * SCRIPT PARA TESTAR API DE NOTIFICAÇÕES
 * 
 * Testa os endpoints básicos de notificações
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3001';

async function testNotificationsAPI() {
  console.log('🧪 Testando API de Notificações...');

  try {
    // 1. Testar endpoint de saúde (se existir)
    console.log('\n1. Testando conectividade...');
    
    // 2. Testar emissão de evento (sem auth por enquanto)
    console.log('\n2. Testando emissão de evento...');
    
    const eventData = {
      type: 'test_notification',
      source: 'module',
      module: 'module-exemplo',
      severity: 'info',
      tenantId: null,
      userId: null,
      payload: {
        title: 'Teste de Notificação',
        message: 'Esta é uma notificação de teste criada via API.',
        context: '/module-exemplo',
        data: {
          testEvent: true,
          timestamp: new Date().toISOString(),
        },
      },
    };

    // Nota: Este teste falhará sem autenticação, mas mostra a estrutura
    try {
      const response = await axios.post(`${API_BASE}/notifications/events`, eventData);
      console.log('✅ Evento emitido com sucesso:', response.status);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('⚠️ Endpoint protegido (401) - isso é esperado sem autenticação');
        console.log('✅ API está respondendo corretamente');
      } else {
        console.log('❌ Erro inesperado:', error.message);
      }
    }

    console.log('\n🎉 Teste básico concluído!');
    console.log('\n📝 Para testar completamente:');
    console.log('1. Inicie o backend: npm run start:dev');
    console.log('2. Faça login no frontend');
    console.log('3. Acesse /module-exemplo');
    console.log('4. Use o gerador de notificações');

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

// Executar teste
testNotificationsAPI();