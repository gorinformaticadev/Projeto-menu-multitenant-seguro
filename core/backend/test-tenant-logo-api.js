/**
 * Teste para verificar se o endpoint de logo da tenant está funcionando
 */

const axios = require('axios');

const API_URL = 'http://localhost:3001';

async function testTenantLogoAPI() {
  console.log('🔍 Testando API de Logo da Tenant');
  console.log('================================');

  try {
    // Primeiro, vamos buscar os tenants disponíveis
    console.log('\n1. Buscando tenants disponíveis...');
    
    // Como não temos autenticação aqui, vamos testar diretamente o endpoint público
    // Vamos usar um ID de tenant que sabemos que existe (do seed)
    
    // Buscar tenant pelo endpoint público (se existir)
    try {
      console.log('\n2. Testando endpoint público de logo...');
      
      // Vamos tentar com um ID genérico primeiro
      const response = await axios.get(`${API_URL}/tenants/public/master-logo`);
      console.log('✅ Master logo endpoint funcionando:', response.data);
      
    } catch (error) {
      console.log('❌ Erro no master logo:', error.response?.data || error.message);
    }

    // Testar com um tenant específico (precisaríamos do ID real)
    console.log('\n3. Para testar logo de tenant específico:');
    console.log('   GET /tenants/public/{tenant-id}/logo');
    console.log('   Onde {tenant-id} é o UUID do tenant');
    
    console.log('\n📋 Estrutura esperada da resposta:');
    console.log('   {');
    console.log('     "logoUrl": "nome-do-arquivo.jpg" | null,');
    console.log('     "nomeFantasia": "Nome da Empresa"');
    console.log('   }');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

// Verificar se o servidor está rodando
async function checkServer() {
  try {
    const response = await axios.get(`${API_URL}/health`, { timeout: 5000 });
    console.log('✅ Servidor está rodando');
    return true;
  } catch (error) {
    console.log('❌ Servidor não está rodando ou não responde');
    console.log('   Inicie o servidor com: npm run start:dev');
    return false;
  }
}

async function main() {
  const serverRunning = await checkServer();
  if (serverRunning) {
    await testTenantLogoAPI();
  }
  
  console.log('\n🎯 Próximos passos para teste completo:');
  console.log('1. Inicie o backend: cd backend && npm run start:dev');
  console.log('2. Inicie o frontend: cd frontend && npm run dev');
  console.log('3. Faça login com: admin@empresa1.com / admin123');
  console.log('4. Verifique se a logo aparece no menu do usuário');
  console.log('5. Teste upload de logo na página de empresas');
}

main();