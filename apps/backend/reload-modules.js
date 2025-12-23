const axios = require('axios');

async function reloadModules() {
  try {
    console.log('🔄 Recarregando módulos...');
    
    // Primeiro fazer login para obter token
    const loginResponse = await axios.post('http://localhost:4000/auth/login', {
      email: 'admin@sistema.com',
      password: 'Admin123!'
    });
    
    const token = loginResponse.data.access_token;
    console.log('✅ Login realizado com sucesso');
    
    // Chamar endpoint de auto-load
    const response = await axios.get('http://localhost:4000/modules/auto-load', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Resposta:', response.data);
    console.log('✅ Módulos recarregados com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

reloadModules();