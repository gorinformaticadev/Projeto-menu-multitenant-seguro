import axios from 'axios';

async function testEndpoint() {
  try {
    console.log('=== TESTANDO ENDPOINT /tenants/my-tenant/modules/active ===');
    
    // Primeiro fazer login para obter um token
    console.log('Fazendo login...');
    const loginResponse = await axios.post('http://localhost:4000/auth/login', {
      email: 'admin@empresa1.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.accessToken;
    console.log('Token obtido:', token.substring(0, 20) + '...');
    
    // Testar o endpoint
    console.log('Chamando endpoint /tenants/my-tenant/modules/active...');
    const response = await axios.get('http://localhost:4000/tenants/my-tenant/modules/active', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Resposta do endpoint:');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error: any) {
    console.error('Erro ao testar endpoint:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Dados:', error.response.data);
    }
  }
}

testEndpoint();