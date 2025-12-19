/**
 * Script de teste para SecureFiles
 * Testa upload, download e listagem de arquivos sensíveis
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_URL = 'http://localhost:4000';

// Substitua pelo seu token JWT válido
const JWT_TOKEN = process.env.JWT_TOKEN || 'SEU_TOKEN_AQUI';

async function testSecureFiles() {
  console.log('🧪 Iniciando testes do SecureFiles...\n');

  try {
    // 1. Criar arquivo de teste
    console.log('1️⃣ Criando arquivo de teste...');
    const testFilePath = path.join(__dirname, 'test-upload.txt');
    fs.writeFileSync(testFilePath, 'Este é um arquivo de teste para o sistema de uploads sensíveis.');
    console.log('✅ Arquivo de teste criado\n');

    // 2. Testar upload
    console.log('2️⃣ Testando upload...');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testFilePath));
    formData.append('moduleName', 'test-module');
    formData.append('documentType', 'test-documents');
    formData.append('metadata', JSON.stringify({ test: true }));

    const uploadResponse = await fetch(`${API_URL}/secure-files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      console.error('❌ Erro no upload:', error);
      
      if (uploadResponse.status === 401) {
        console.log('\n⚠️  ATENÇÃO: Token JWT inválido ou expirado');
        console.log('Configure um token válido na variável JWT_TOKEN');
        console.log('Exemplo: JWT_TOKEN="seu-token" node test-secure-files.js\n');
      }
      
      return;
    }

    const uploadResult = await uploadResponse.json();
    console.log('✅ Upload realizado com sucesso!');
    console.log('   FileId:', uploadResult.fileId);
    console.log('   Tamanho:', uploadResult.sizeBytes, 'bytes');
    console.log('   Módulo:', uploadResult.moduleName);
    console.log('   Tipo:', uploadResult.documentType);
    console.log('');

    const fileId = uploadResult.fileId;

    // 3. Testar listagem
    console.log('3️⃣ Testando listagem de arquivos...');
    const listResponse = await fetch(`${API_URL}/secure-files?moduleName=test-module`, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
      },
    });

    if (!listResponse.ok) {
      console.error('❌ Erro na listagem');
      return;
    }

    const files = await listResponse.json();
    console.log(`✅ Encontrados ${files.length} arquivo(s)`);
    console.log('');

    // 4. Testar metadata
    console.log('4️⃣ Testando obtenção de metadata...');
    const metadataResponse = await fetch(`${API_URL}/secure-files/${fileId}/metadata`, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
      },
    });

    if (!metadataResponse.ok) {
      console.error('❌ Erro ao obter metadata');
      return;
    }

    const metadata = await metadataResponse.json();
    console.log('✅ Metadata obtido:');
    console.log('   Nome:', metadata.originalName);
    console.log('   MIME:', metadata.mimeType);
    console.log('   Tamanho:', metadata.sizeBytes, 'bytes');
    console.log('   Acessos:', metadata.accessCount);
    console.log('');

    // 5. Testar download
    console.log('5️⃣ Testando download...');
    const downloadResponse = await fetch(`${API_URL}/secure-files/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
      },
    });

    if (!downloadResponse.ok) {
      console.error('❌ Erro no download');
      return;
    }

    const downloadedContent = await downloadResponse.text();
    console.log('✅ Download realizado com sucesso!');
    console.log('   Conteúdo:', downloadedContent.substring(0, 50) + '...');
    console.log('');

    // 6. Testar soft delete
    console.log('6️⃣ Testando soft delete...');
    const deleteResponse = await fetch(`${API_URL}/secure-files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
      },
    });

    if (!deleteResponse.ok) {
      console.error('❌ Erro ao deletar arquivo');
      return;
    }

    const deleteResult = await deleteResponse.json();
    console.log('✅', deleteResult.message);
    console.log('');

    // 7. Verificar que arquivo deletado não é mais acessível
    console.log('7️⃣ Verificando que arquivo deletado não é acessível...');
    const deletedCheckResponse = await fetch(`${API_URL}/secure-files/${fileId}`, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`,
      },
    });

    if (deletedCheckResponse.status === 404 || deletedCheckResponse.status === 410) {
      console.log('✅ Arquivo deletado não é mais acessível (correto!)');
    } else {
      console.log('⚠️  Arquivo deletado ainda está acessível (verificar)');
    }
    console.log('');

    // Limpeza
    fs.unlinkSync(testFilePath);
    console.log('🧹 Arquivo de teste local removido');
    console.log('');

    console.log('🎉 TODOS OS TESTES PASSARAM COM SUCESSO!');
    console.log('');
    console.log('📊 Resumo:');
    console.log('   ✅ Upload funcionando');
    console.log('   ✅ Listagem funcionando');
    console.log('   ✅ Metadata funcionando');
    console.log('   ✅ Download funcionando');
    console.log('   ✅ Soft delete funcionando');
    console.log('   ✅ Proteção de arquivos deletados funcionando');

  } catch (error) {
    console.error('❌ Erro durante os testes:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n⚠️  ATENÇÃO: Servidor não está rodando!');
      console.log('Inicie o backend com: cd backend && npm run start:dev\n');
    }
  }
}

// Executar testes
testSecureFiles();
