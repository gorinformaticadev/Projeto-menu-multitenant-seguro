const axios = require('axios');

async function testModulesAPI() {
  try {
    console.log('🔐 Fazendo login...');
    
    // Testar credenciais diferentes
    const credentials = [
      { email: 'admin@empresa1.com', password: 'admin123' },
      { email: 'admin@sistema.com', password: 'Admin123!' },
      { email: 'superadmin@sistema.com', password: 'SuperAdmin123!' }
    ];
    
    let token = null;
    let loginData = null;
    
    for (const cred of credentials) {
      try {
        console.log(`   Tentando ${cred.email}...`);
        const login = await axios.post('http://localhost:4000/auth/login', cred);
        loginData = login.data;
        token = loginData.accessToken || loginData.access_token;
        if (token) {
          console.log(`   ✅ Login com ${cred.email} bem-sucedido`);
          break;
        }
      } catch (e) {
        console.log(`   ❌ ${cred.email} falhou:`, e.response?.data?.message || e.message);
      }
    }
    
    if (!token) {
      console.error('❌ Nenhuma credencial funcionou');
      return;
    }
    
    console.log('\n📡 Buscando módulos do usuário...');
    const modules = await axios.get('http://localhost:4000/me/modules', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('\n✅ Resposta da API:');
    console.log(JSON.stringify(modules.data, null, 2));
    
    if (modules.data.modules && modules.data.modules.length > 0) {
      console.log(`\n📦 Total de módulos: ${modules.data.modules.length}`);
      modules.data.modules.forEach(m => {
        console.log(`\n   Módulo: ${m.name} (${m.slug})`);
        console.log(`   Habilitado: ${m.enabled}`);
        console.log(`   Menus: ${m.menus ? m.menus.length : 0}`);
        if (m.menus && m.menus.length > 0) {
          m.menus.forEach(menu => {
            console.log(`      - ${menu.label} (${menu.route})`);
            if (menu.children && menu.children.length > 0) {
              menu.children.forEach(child => {
                console.log(`         └─ ${child.label} (${child.route})`);
              });
            }
          });
        }
      });
    } else {
      console.log('\n⚠️ Nenhum módulo retornado pela API');
    }
    
  } catch (error) {
    console.error('\n❌ Erro:', error.response?.data || error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testModulesAPI();
