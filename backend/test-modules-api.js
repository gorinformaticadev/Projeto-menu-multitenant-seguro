const axios = require('axios');

async function testModuleAPI() {
  try {
    console.log('🔄 Testando API de módulos...');
    
    // Login com usuário ADMIN que tem tenant
    const loginResponse = await axios.post('http://localhost:4000/auth/login', {
      email: 'admin@empresa.com',
      password: 'Admin123!'
    });
    
    const token = loginResponse.data.access_token;
    console.log('✅ Login realizado com sucesso');
    
    // Buscar módulos ativos
    const response = await axios.get('http://localhost:4000/tenants/my-tenant/modules/active', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Módulos ativos:', response.data.activeModules);
    console.log('📦 Módulos disponíveis:', response.data.modules.map(m => `${m.name} (${m.isActive ? 'ativo' : 'inativo'})`));
    
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

testModuleAPI();