/**
 * TESTE SIMPLES DO SISTEMA DE NOTIFICAÇÕES
 */

const axios = require('axios');

async function simpleTest() {
  console.log('🧪 TESTE SIMPLES - VERIFICANDO ENDPOINTS');
  
  try {
    // Testar endpoint de login diretamente
    console.log('1. Testando endpoint de login...');
    try {
      const loginResponse = await axios.post('http://localhost:4000/auth/login', {
        email: 'admin@sistema.com',
        password: 'Admin123!'
      });
      console.log('✅ Login funcionando, token recebido');
      
      // Testar endpoints de notificação
      const token = loginResponse.data.access_token;
      const headers = { 'Authorization': `Bearer ${token}` };
      
      console.log('2. Testando endpoint de notificações...');
      const notificationsResponse = await axios.get('http://localhost:4000/notifications', { headers });
      console.log('✅ Endpoint de notificações funcionando');
      console.log('   Total:', notificationsResponse.data.total);
      console.log('   Não lidas:', notificationsResponse.data.unreadCount);
      
      console.log('3. Testando criação de notificação...');
      const createResponse = await axios.post('http://localhost:4000/notifications', {
        title: 'Teste Sistema',
        description: 'Notificação de teste do novo sistema',
        type: 'info'
      }, { headers });
      console.log('✅ Criação de notificação funcionando');
      console.log('   ID:', createResponse.data.notification.id);
      
    } catch (loginError) {
      console.log('❌ Erro no login:', loginError.response?.data?.message || loginError.message);
      
      // Testar se os endpoints existem mesmo sem autenticação
      console.log('2. Testando se endpoints de notificação existem...');
      try {
        await axios.get('http://localhost:4000/notifications');
      } catch (notifError) {
        if (notifError.response?.status === 401) {
          console.log('✅ Endpoint de notificações existe (retornou 401 - não autorizado)');
        } else {
          console.log('❌ Endpoint de notificações não encontrado:', notifError.response?.status);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

simpleTest();