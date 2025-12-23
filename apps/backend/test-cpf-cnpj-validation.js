const axios = require('axios');

const API_URL = 'http://localhost:4000';

async function testCPFCNPJValidation() {
  console.log('🧪 Testando validação de CPF/CNPJ...\n');

  // Teste 1: CPF válido
  console.log('1. Testando CPF válido...');
  try {
    const response = await axios.post(`${API_URL}/tenants`, {
      email: 'teste1@exemplo.com',
      cnpjCpf: '123.456.789-09', // CPF válido
      nomeFantasia: 'Empresa Teste CPF',
      nomeResponsavel: 'João Silva',
      telefone: '(11) 99999-9999',
      adminEmail: 'admin1@exemplo.com',
      adminPassword: '123456',
      adminName: 'Admin Teste'
    });
    console.log('✅ CPF válido aceito');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('❌ CPF válido rejeitado:', error.response.data.message);
    } else {
      console.log('ℹ️ Outro erro (esperado):', error.response?.data?.message || error.message);
    }
  }

  // Teste 2: CPF inválido
  console.log('\n2. Testando CPF inválido...');
  try {
    const response = await axios.post(`${API_URL}/tenants`, {
      email: 'teste2@exemplo.com',
      cnpjCpf: '111.111.111-11', // CPF inválido (todos iguais)
      nomeFantasia: 'Empresa Teste CPF Inválido',
      nomeResponsavel: 'Maria Silva',
      telefone: '(11) 99999-9999',
      adminEmail: 'admin2@exemplo.com',
      adminPassword: '123456',
      adminName: 'Admin Teste'
    });
    console.log('❌ CPF inválido foi aceito (erro!)');
  } catch (error) {
    if (error.response?.status === 400 && error.response.data.message?.includes('CPF')) {
      console.log('✅ CPF inválido rejeitado corretamente:', error.response.data.message);
    } else {
      console.log('❌ Erro inesperado:', error.response?.data?.message || error.message);
    }
  }

  // Teste 3: CNPJ válido
  console.log('\n3. Testando CNPJ válido...');
  try {
    const response = await axios.post(`${API_URL}/tenants`, {
      email: 'teste3@exemplo.com',
      cnpjCpf: '11.222.333/0001-81', // CNPJ válido
      nomeFantasia: 'Empresa Teste CNPJ',
      nomeResponsavel: 'Pedro Santos',
      telefone: '(11) 99999-9999',
      adminEmail: 'admin3@exemplo.com',
      adminPassword: '123456',
      adminName: 'Admin Teste'
    });
    console.log('✅ CNPJ válido aceito');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('❌ CNPJ válido rejeitado:', error.response.data.message);
    } else {
      console.log('ℹ️ Outro erro (esperado):', error.response?.data?.message || error.message);
    }
  }

  // Teste 4: CNPJ inválido
  console.log('\n4. Testando CNPJ inválido...');
  try {
    const response = await axios.post(`${API_URL}/tenants`, {
      email: 'teste4@exemplo.com',
      cnpjCpf: '11.111.111/1111-11', // CNPJ inválido
      nomeFantasia: 'Empresa Teste CNPJ Inválido',
      nomeResponsavel: 'Ana Costa',
      telefone: '(11) 99999-9999',
      adminEmail: 'admin4@exemplo.com',
      adminPassword: '123456',
      adminName: 'Admin Teste'
    });
    console.log('❌ CNPJ inválido foi aceito (erro!)');
  } catch (error) {
    if (error.response?.status === 400 && error.response.data.message?.includes('CNPJ')) {
      console.log('✅ CNPJ inválido rejeitado corretamente:', error.response.data.message);
    } else {
      console.log('❌ Erro inesperado:', error.response?.data?.message || error.message);
    }
  }

  // Teste 5: Documento muito curto
  console.log('\n5. Testando documento muito curto...');
  try {
    const response = await axios.post(`${API_URL}/tenants`, {
      email: 'teste5@exemplo.com',
      cnpjCpf: '123', // Muito curto
      nomeFantasia: 'Empresa Teste Curto',
      nomeResponsavel: 'Carlos Lima',
      telefone: '(11) 99999-9999',
      adminEmail: 'admin5@exemplo.com',
      adminPassword: '123456',
      adminName: 'Admin Teste'
    });
    console.log('❌ Documento curto foi aceito (erro!)');
  } catch (error) {
    if (error.response?.status === 400) {
      console.log('✅ Documento curto rejeitado corretamente:', error.response.data.message);
    } else {
      console.log('❌ Erro inesperado:', error.response?.data?.message || error.message);
    }
  }

  console.log('\n🏁 Teste de validação concluído!');
}

testCPFCNPJValidation();