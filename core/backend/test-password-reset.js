const axios = require('axios');

const API_URL = 'http://localhost:4000';

async function testPasswordReset() {
  console.log('🧪 Testando endpoints de recuperação de senha...\n');

  try {
    // Teste 1: Solicitar recuperação de senha
    console.log('1. Testando solicitação de recuperação de senha...');
    const forgotResponse = await axios.post(`${API_URL}/auth/forgot-password`, {
      email: 'teste@exemplo.com'
    });
    
    console.log('✅ Solicitação de recuperação:', forgotResponse.data);
    console.log('Status:', forgotResponse.status);
    
  } catch (error) {
    if (error.response) {
      console.log('❌ Erro na solicitação:', error.response.data);
      console.log('Status:', error.response.status);
    } else {
      console.log('❌ Erro de conexão:', error.message);
    }
  }

  try {
    // Teste 2: Tentar reset com token inválido
    console.log('\n2. Testando reset com token inválido...');
    const resetResponse = await axios.post(`${API_URL}/auth/reset-password`, {
      token: 'token-invalido',
      newPassword: 'NovaSenha123!'
    });
    
    console.log('✅ Reset com token inválido:', resetResponse.data);
    
  } catch (error) {
    if (error.response) {
      console.log('❌ Erro esperado no reset:', error.response.data);
      console.log('Status:', error.response.status);
    } else {
      console.log('❌ Erro de conexão:', error.message);
    }
  }

  console.log('\n🏁 Teste concluído!');
}

testPasswordReset();