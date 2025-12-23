// Teste simples das funções de validação de senha
// Este arquivo pode ser executado no navegador para testar as funções

// Simula uma política de senha
const testPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecial: true,
};

// Função de validação copiada do hook
function validatePasswordWithPolicy(password, policy) {
  const result = {
    minLength: password.length >= policy.minLength,
    hasUppercase: policy.requireUppercase ? /[A-Z]/.test(password) : true,
    hasLowercase: policy.requireLowercase ? /[a-z]/.test(password) : true,
    hasNumbers: policy.requireNumbers ? /\d/.test(password) : true,
    hasSpecial: policy.requireSpecial ? /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(password) : true,
    isValid: false,
    strength: 'weak',
    score: 0,
  };

  // Calcula pontuação
  let score = 0;
  if (result.minLength) score += 20;
  if (result.hasUppercase) score += 20;
  if (result.hasLowercase) score += 20;
  if (result.hasNumbers) score += 20;
  if (result.hasSpecial) score += 20;

  if (password.length >= policy.minLength + 4) score += 10;
  if (password.length >= policy.minLength + 8) score += 10;

  result.score = Math.min(score, 100);
  
  if (score >= 90) result.strength = 'very-strong';
  else if (score >= 70) result.strength = 'strong';
  else if (score >= 50) result.strength = 'medium';
  else result.strength = 'weak';

  result.isValid = result.minLength && result.hasUppercase && result.hasLowercase && result.hasNumbers && result.hasSpecial;

  return result;
}

console.log('🧪 Testando validação de senhas...\n');

// Casos de teste
const testCases = [
  { password: '', description: 'Senha vazia' },
  { password: '123', description: 'Senha muito curta' },
  { password: '12345678', description: 'Apenas números' },
  { password: 'abcdefgh', description: 'Apenas minúsculas' },
  { password: 'ABCDEFGH', description: 'Apenas maiúsculas' },
  { password: 'Abcdefgh', description: 'Maiúscula + minúscula' },
  { password: 'Abcd1234', description: 'Maiúscula + minúscula + números' },
  { password: 'Abcd123!', description: 'Todos os requisitos básicos' },
  { password: 'MinhaSenh@123', description: 'Senha forte' },
  { password: 'MinhaSenh@SuperSegura123!', description: 'Senha muito forte' },
  { password: 'P@ssw0rd', description: 'Senha comum mas válida' },
  { password: '!@#$%^&*()', description: 'Apenas caracteres especiais' },
];

testCases.forEach(({ password, description }) => {
  const result = validatePasswordWithPolicy(password, testPolicy);
  
  console.log(`📝 ${description}:`);
  console.log(`   Senha: "${password}"`);
  console.log(`   Válida: ${result.isValid ? '✅' : '❌'}`);
  console.log(`   Força: ${result.strength} (${result.score}/100)`);
  console.log(`   Requisitos:`);
  console.log(`     - Comprimento (${password.length}/${testPolicy.minLength}): ${result.minLength ? '✅' : '❌'}`);
  console.log(`     - Maiúscula: ${result.hasUppercase ? '✅' : '❌'}`);
  console.log(`     - Minúscula: ${result.hasLowercase ? '✅' : '❌'}`);
  console.log(`     - Número: ${result.hasNumbers ? '✅' : '❌'}`);
  console.log(`     - Especial: ${result.hasSpecial ? '✅' : '❌'}`);
  console.log('');
});

// Teste com diferentes políticas
console.log('🔧 Testando diferentes políticas...\n');

const policies = [
  {
    name: 'Política Relaxada',
    policy: { minLength: 6, requireUppercase: false, requireLowercase: true, requireNumbers: true, requireSpecial: false }
  },
  {
    name: 'Política Rigorosa',
    policy: { minLength: 12, requireUppercase: true, requireLowercase: true, requireNumbers: true, requireSpecial: true }
  },
  {
    name: 'Apenas Comprimento',
    policy: { minLength: 10, requireUppercase: false, requireLowercase: false, requireNumbers: false, requireSpecial: false }
  }
];

const testPassword = 'MinhaSenh@123';

policies.forEach(({ name, policy }) => {
  const result = validatePasswordWithPolicy(testPassword, policy);
  console.log(`📋 ${name}:`);
  console.log(`   Senha: "${testPassword}"`);
  console.log(`   Válida: ${result.isValid ? '✅' : '❌'}`);
  console.log(`   Pontuação: ${result.score}/100`);
  console.log('');
});

console.log('🏁 Teste de validação concluído!');

// Se estiver no navegador, também testa no console
if (typeof window !== 'undefined') {
  window.testPasswordValidation = validatePasswordWithPolicy;
  console.log('💡 Função disponível globalmente: testPasswordValidation(password, policy)');
}