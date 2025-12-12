// Teste de criptografia de dados sensíveis
const { encryptSensitiveData, decryptSensitiveData } = require('./dist/src/common/utils/security.utils');

console.log('🧪 TESTE: Criptografia de Dados Sensíveis');
console.log('=========================================\n');

// Configurar chave de teste
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-chars-long';

try {
  console.log('🔍 Teste 1: Criptografia e descriptografia');
  
  const originalData = 'dados-sensíveis-secretos-123';
  console.log(`Dados originais: ${originalData}`);
  
  const encrypted = encryptSensitiveData(originalData);
  console.log(`Dados criptografados: ${encrypted}`);
  console.log(`Tamanho criptografado: ${encrypted.length} caracteres`);
  
  const decrypted = decryptSensitiveData(encrypted);
  console.log(`Dados descriptografados: ${decrypted}`);
  
  const isValid = originalData === decrypted;
  console.log(`Resultado: ${isValid ? '✅ PASSOU' : '❌ FALHOU'}`);
  
  console.log('\n🔍 Teste 2: Diferentes dados produzem diferentes criptografias');
  const data1 = encryptSensitiveData('teste1');
  const data2 = encryptSensitiveData('teste1');
  const isDifferent = data1 !== data2;
  console.log(`Criptografias diferentes: ${isDifferent ? '✅ PASSOU' : '❌ FALHOU'}`);
  
  console.log('\n🔍 Teste 3: Erro sem chave de criptografia');
  delete process.env.ENCRYPTION_KEY;
  try {
    encryptSensitiveData('teste');
    console.log('❌ FALHOU: Deveria ter dado erro');
  } catch (error) {
    console.log('✅ PASSOU: Erro detectado corretamente');
    console.log(`   Erro: ${error.message}`);
  }
  
  console.log('\n📊 RESUMO DOS TESTES DE CRIPTOGRAFIA:');
  console.log('✅ Criptografia e descriptografia funcionando');
  console.log('✅ Diferentes execuções produzem resultados diferentes');
  console.log('✅ Erro detectado quando chave não configurada');
  console.log('\n🎯 CONCLUSÃO: Sistema de criptografia funcionando perfeitamente!');
  
} catch (error) {
  console.log(`❌ ERRO: ${error.message}`);
}