const axios = require('axios');

async function testToggleModule() {
  try {
    console.log('🔄 Testando toggle de módulo...');
    
    // Login com SUPER_ADMIN
    console.log('🔐 Fazendo login...');
    const loginResponse = await axios.post('http://localhost:4000/auth/login', {
      email: 'admin@sistema.com',
      password: 'Admin123!'
    });
    
    const token = loginResponse.data.access_token;
    console.log('✅ Login realizado com sucesso');
    console.log('🔑 Token:', token.substring(0, 20) + '...');
    
    // Buscar tenants disponíveis imediatamente após login
    console.log('🏢 Buscando tenants...');
    const tenantsResponse = await axios.get('http://localhost:4000/tenants', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (tenantsResponse.data.length === 0) {
      console.log('❌ Nenhum tenant encontrado');
      return;
    }
    
    const tenantId = tenantsResponse.data[0].id;
    const tenantName = tenantsResponse.data[0].nomeFantasia;
    console.log(`🏢 Usando tenant: ${tenantName} (ID: ${tenantId})`);
    
    const moduleName = 'module-exemplo';
    
    // Testar toggle do módulo
    console.log(`🔄 Fazendo toggle do módulo ${moduleName}...`);
    const toggleResponse = await axios.post(`http://localhost:4000/tenants/${tenantId}/modules/${moduleName}/toggle`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Toggle realizado com sucesso:', {
      moduleName: toggleResponse.data.moduleName,
      isActive: toggleResponse.data.isActive,
      activatedAt: toggleResponse.data.activatedAt,
      deactivatedAt: toggleResponse.data.deactivatedAt
    });
    
    // Verificar status atual
    const statusResponse = await axios.get(`http://localhost:4000/tenants/${tenantId}/modules/active`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('📋 Status atual dos módulos:', {
      activeModules: statusResponse.data.activeModules,
      totalModules: statusResponse.data.modules.length
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

testToggleModule();