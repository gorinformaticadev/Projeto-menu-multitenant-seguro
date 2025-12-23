/**
 * TESTE DO NOVO SISTEMA DE NOTIFICAÇÕES SOCKET.IO
 * 
 * Script para testar o sistema recriado
 */

const axios = require('axios');

const API_URL = 'http://localhost:4000';

async function testNotificationSystem() {
  console.log('🧪 TESTE DO NOVO SISTEMA DE NOTIFICAÇÕES SOCKET.IO');
  console.log('================================================\n');

  try {
    // 1. Login para obter token
    console.log('1. Fazendo login...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: 'admin@sistema.com',
      password: 'Admin123!'
    });
    
    const token = loginResponse.data.access_token;
    console.log('✅ Login realizado com sucesso\n');

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    // 2. Criar notificação de teste
    console.log('2. Criando notificação de teste...');
    const createResponse = await axios.post(`${API_URL}/notifications`, {
      title: 'Teste do Novo Sistema',
      description: 'Esta é uma notificação de teste do novo sistema Socket.IO',
      type: 'info',
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      }
    }, { headers });

    console.log('✅ Notificação criada:', createResponse.data.notification.id);
    const notificationId = createResponse.data.notification.id;

    // 3. Buscar notificações do dropdown
    console.log('\n3. Buscando notificações do dropdown...');
    const dropdownResponse = await axios.get(`${API_URL}/notifications/dropdown`, { headers });
    console.log('✅ Dropdown:', dropdownResponse.data.notifications.length, 'notificações');

    // 4. Buscar contagem de não lidas
    console.log('\n4. Verificando contagem de não lidas...');
    const unreadResponse = await axios.get(`${API_URL}/notifications/unread-count`, { headers });
    console.log('✅ Não lidas:', unreadResponse.data.count);

    // 5. Marcar como lida
    console.log('\n5. Marcando notificação como lida...');
    const readResponse = await axios.patch(`${API_URL}/notifications/${notificationId}/read`, {}, { headers });
    console.log('✅ Marcada como lida:', readResponse.data.success);

    // 6. Verificar contagem novamente
    console.log('\n6. Verificando contagem após marcar como lida...');
    const unreadResponse2 = await axios.get(`${API_URL}/notifications/unread-count`, { headers });
    console.log('✅ Não lidas após leitura:', unreadResponse2.data.count);

    // 7. Criar notificação de erro
    console.log('\n7. Criando notificação de erro...');
    const errorNotification = await axios.post(`${API_URL}/notifications`, {
      title: 'Erro de Teste',
      description: 'Esta é uma notificação de erro para testar o sistema',
      type: 'error',
      metadata: {
        errorCode: 'TEST_ERROR',
        module: 'test'
      }
    }, { headers });

    console.log('✅ Notificação de erro criada:', errorNotification.data.notification.id);

    // 8. Buscar todas as notificações
    console.log('\n8. Buscando todas as notificações...');
    const allResponse = await axios.get(`${API_URL}/notifications`, { headers });
    console.log('✅ Total de notificações:', allResponse.data.total);
    console.log('✅ Não lidas:', allResponse.data.unreadCount);

    // 9. Deletar notificação
    console.log('\n9. Deletando notificação de teste...');
    const deleteResponse = await axios.delete(`${API_URL}/notifications/${notificationId}`, { headers });
    console.log('✅ Notificação deletada:', deleteResponse.data.success);

    console.log('\n🎉 TODOS OS TESTES PASSARAM!');
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('1. Inicie o frontend: npm run dev');
    console.log('2. Acesse /notifications');
    console.log('3. Verifique o ícone de notificações na TopBar');
    console.log('4. Teste a conexão Socket.IO em tempo real');

  } catch (error) {
    console.error('❌ Erro no teste:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n💡 Dica: Verifique se o usuário admin@sistema.com existe');
      console.log('   Ou ajuste as credenciais no script de teste');
    }
  }
}

// Executar teste
testNotificationSystem();