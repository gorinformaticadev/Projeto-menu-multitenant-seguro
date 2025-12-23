// Importar as funções de validação
const { 
  isValidCPF, 
  isValidCNPJ, 
  isValidCPFOrCNPJ, 
  formatCPF, 
  formatCNPJ, 
  formatCPFOrCNPJ 
} = require('./src/common/validators/cpf-cnpj.validator.ts');

console.log('🧪 Testando funções de validação de CPF/CNPJ...\n');

// Teste de CPFs
console.log('📋 Testando CPFs:');
const cpfs = [
  { value: '12345678909', expected: true, description: 'CPF válido' },
  { value: '111.111.111-11', expected: false, description: 'CPF inválido (todos iguais)' },
  { value: '123.456.789-09', expected: true, description: 'CPF válido formatado' },
  { value: '000.000.000-00', expected: false, description: 'CPF inválido (zeros)' },
  { value: '12345678900', expected: false, description: 'CPF inválido (dígito errado)' },
];

cpfs.forEach(({ value, expected, description }) => {
  const result = isValidCPF(value);
  const status = result === expected ? '✅' : '❌';
  console.log(`${status} ${description}: ${value} -> ${result}`);
});

// Teste de CNPJs
console.log('\n📋 Testando CNPJs:');
const cnpjs = [
  { value: '11222333000181', expected: true, description: 'CNPJ válido' },
  { value: '11.222.333/0001-81', expected: true, description: 'CNPJ válido formatado' },
  { value: '11.111.111/1111-11', expected: false, description: 'CNPJ inválido (todos iguais)' },
  { value: '00.000.000/0000-00', expected: false, description: 'CNPJ inválido (zeros)' },
  { value: '11222333000180', expected: false, description: 'CNPJ inválido (dígito errado)' },
];

cnpjs.forEach(({ value, expected, description }) => {
  const result = isValidCNPJ(value);
  const status = result === expected ? '✅' : '❌';
  console.log(`${status} ${description}: ${value} -> ${result}`);
});

// Teste de validação geral
console.log('\n📋 Testando validação geral (CPF ou CNPJ):');
const documents = [
  { value: '12345678909', expected: true, description: 'CPF válido' },
  { value: '11222333000181', expected: true, description: 'CNPJ válido' },
  { value: '111.111.111-11', expected: false, description: 'CPF inválido' },
  { value: '11.111.111/1111-11', expected: false, description: 'CNPJ inválido' },
  { value: '123', expected: false, description: 'Documento muito curto' },
  { value: '123456789012345', expected: false, description: 'Documento muito longo' },
];

documents.forEach(({ value, expected, description }) => {
  const result = isValidCPFOrCNPJ(value);
  const status = result === expected ? '✅' : '❌';
  console.log(`${status} ${description}: ${value} -> ${result}`);
});

// Teste de formatação
console.log('\n📋 Testando formatação:');
const formatTests = [
  { value: '12345678909', expected: '123.456.789-09', description: 'Formatação CPF' },
  { value: '11222333000181', expected: '11.222.333/0001-81', description: 'Formatação CNPJ' },
  { value: '123456789', expected: '123.456.789', description: 'CPF parcial' },
  { value: '11222333', expected: '11.222.333', description: 'CNPJ parcial' },
];

formatTests.forEach(({ value, expected, description }) => {
  const result = formatCPFOrCNPJ(value);
  const status = result === expected ? '✅' : '❌';
  console.log(`${status} ${description}: ${value} -> ${result} (esperado: ${expected})`);
});

console.log('\n🏁 Teste de funções concluído!');