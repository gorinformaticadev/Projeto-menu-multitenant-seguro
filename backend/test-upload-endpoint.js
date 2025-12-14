const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testUploadEndpoint() {
  try {
    console.log('🧪 Testando endpoint de upload de módulos...');
    
    // Fazer login
    console.log('🔐 Fazendo login...');
    const loginResponse = await axios.post('http://localhost:4000/auth/login', {
      email: 'admin@system.com',
      password: 'admin123'
    });
    
    const token = loginResponse.data.accessToken;
    console.log('✅ Login realizado com sucesso');
    
    // Verificar se o endpoint existe
    console.log('\n📡 Testando endpoint GET /modules/installed...');
    try {
      const getResponse = await axios.get('http://localhost:4000/modules/installed', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ Endpoint GET funcionando:', getResponse.data.length, 'módulos encontrados');
    } catch (error) {
      console.log('❌ Erro no GET:', error.response?.status, error.response?.data);
    }
    
    // Testar endpoint de upload (sem arquivo para ver o erro)
    console.log('\n📤 Testando endpoint POST /modules/upload (sem arquivo)...');
    try {
      const uploadResponse = await axios.post('http://localhost:4000/modules/upload', {}, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      console.log('✅ Upload response:', uploadResponse.data);
    } catch (error) {
      console.log('❌ Erro esperado no upload (sem arquivo):', error.response?.status, error.response?.data);
    }
    
    // Verificar se existe um arquivo ZIP de exemplo
    const exampleZipPath = path.join(__dirname, '..', 'modules', 'module-exemplo-fixed.zip');
    if (fs.existsSync(exampleZipPath)) {
      console.log('\n📦 Testando upload com arquivo de exemplo...');
      
      const formData = new FormData();
      formData.append('module', fs.createReadStream(exampleZipPath));
      
      try {
        const uploadResponse = await axios.post('http://localhost:4000/modules/upload', formData, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            ...formData.getHeaders()
          }
        });
        console.log('✅ Upload com arquivo funcionou:', uploadResponse.data);
      } catch (error) {
        console.log('❌ Erro no upload com arquivo:', error.response?.status, error.response?.data);
      }
    } else {
      console.log('\n⚠️ Arquivo de exemplo não encontrado:', exampleZipPath);
    }
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

testUploadEndpoint();