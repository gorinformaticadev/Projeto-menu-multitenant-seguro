// Funções de validação copiadas para teste
function isValidCPF(cpf) {
  // Remove caracteres não numéricos
  cpf = cpf.replace(/[^\d]/g, '');

  // Verifica se tem 11 dígitos
  if (cpf.length !== 11) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  // Validação do primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(9))) return false;

  // Validação do segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(cpf.charAt(10))) return false;

  return true;
}

function isValidCNPJ(cnpj) {
  // Remove caracteres não numéricos
  cnpj = cnpj.replace(/[^\d]/g, '');

  // Verifica se tem 14 dígitos
  if (cnpj.length !== 14) return false;

  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  // Validação do primeiro dígito verificador
  let sum = 0;
  let weight = 2;
  for (let i = 11; i >= 0; i--) {
    sum += parseInt(cnpj.charAt(i)) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  let remainder = sum % 11;
  const firstDigit = remainder < 2 ? 0 : 11 - remainder;
  if (firstDigit !== parseInt(cnpj.charAt(12))) return false;

  // Validação do segundo dígito verificador
  sum = 0;
  weight = 2;
  for (let i = 12; i >= 0; i--) {
    sum += parseInt(cnpj.charAt(i)) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  remainder = sum % 11;
  const secondDigit = remainder < 2 ? 0 : 11 - remainder;
  if (secondDigit !== parseInt(cnpj.charAt(13))) return false;

  return true;
}

function isValidCPFOrCNPJ(value) {
  const cleanValue = value.replace(/[^\d]/g, '');
  
  if (cleanValue.length === 11) {
    return isValidCPF(cleanValue);
  } else if (cleanValue.length === 14) {
    return isValidCNPJ(cleanValue);
  }
  
  return false;
}

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

console.log('\n🏁 Teste de funções concluído!');