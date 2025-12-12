#!/usr/bin/env node

/**
 * Testes básicos de segurança para o backend
 * Execute com: node test-security.js
 */

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:4000';

async function testSecurity() {
  console.log('🛡️  Executando testes de segurança...\n');

  const tests = [
    {
      name: 'Teste de SQL Injection',
      method: 'POST',
      url: '/auth/login',
      data: { email: "'; DROP TABLE users; --", password: 'test' },
      expectStatus: 400, // Validação rejeita entrada maliciosa
      description: 'Deve rejeitar entrada maliciosa com status 400'
    },
    {
      name: 'Teste de XSS',
      method: 'POST',
      url: '/auth/login',
      data: { email: '<script>alert("xss")</script>', password: 'test' },
      expectStatus: 400, // Validação rejeita entrada maliciosa
      description: 'Deve rejeitar entrada maliciosa com status 400'
    },
    {
      name: 'Teste de Rate Limiting',
      method: 'POST',
      url: '/auth/login',
      data: { email: 'test@test.com', password: 'wrong' },
      expectStatus: 429, // Rate limiting ativado
      repeat: 10, // Testar rate limiting
      description: 'Deve bloquear após múltiplas tentativas'
    },
    {
      name: 'Teste de Headers de Segurança',
      method: 'GET',
      url: '/auth/me',
      headers: {},
      expectStatus: 401, // Não autorizado sem token
      expectHeaders: ['x-frame-options', 'x-content-type-options', 'cross-origin-embedder-policy'],
      description: 'Deve conter headers de segurança mesmo em erro'
    },
    {
      name: 'Teste de Validação de Email',
      method: 'POST',
      url: '/auth/login',
      data: { email: 'invalid-email', password: 'test123456' },
      expectStatus: 400,
      description: 'Deve rejeitar email inválido'
    },
    {
      name: 'Teste de Validação de Senha',
      method: 'POST',
      url: '/auth/login',
      data: { email: 'test@test.com', password: '123' },
      expectStatus: 400,
      description: 'Deve rejeitar senha muito curta'
    }
  ];

  let passedTests = 0;
  let totalTests = tests.length;

  for (const test of tests) {
    try {
      console.log(`🔍 Testando: ${test.name}`);
      if (test.description) {
        console.log(`   ${test.description}`);
      }

      const config = {
        method: test.method,
        url: `${API_URL}${test.url}`,
        headers: test.headers || { 'Content-Type': 'application/json' },
        data: test.data,
        validateStatus: () => true // Não rejeitar erros HTTP
      };

      let response;
      if (test.repeat) {
        // Executar múltiplas vezes para testar rate limiting
        for (let i = 0; i < test.repeat; i++) {
          response = await axios(config);
          if (i === test.repeat - 1) break; // Usar última resposta
        }
      } else {
        response = await axios(config);
      }

      // Verificar status esperado
      if (response.status === test.expectStatus) {
        console.log(`✅ Status correto: ${response.status}`);
        passedTests++;
      } else {
        console.log(`❌ Status inesperado: ${response.status} (esperado: ${test.expectStatus})`);
      }

      // Verificar headers de segurança
      if (test.expectHeaders) {
        const missingHeaders = test.expectHeaders.filter(header =>
          !Object.keys(response.headers).some(h => h.toLowerCase() === header.toLowerCase())
        );

        if (missingHeaders.length === 0) {
          console.log(`✅ Headers de segurança presentes`);
        } else {
          console.log(`❌ Headers ausentes: ${missingHeaders.join(', ')}`);
        }
      }

      console.log('');

    } catch (error) {
      console.log(`❌ Erro no teste: ${error.message}\n`);
    }
  }

  console.log(`📊 Resultado: ${passedTests}/${totalTests} testes passaram`);
  if (passedTests === totalTests) {
    console.log('🎉 Todos os testes de segurança passaram!');
  } else {
    console.log('⚠️ Alguns testes falharam - revise as configurações');
  }

  console.log('🏁 Testes de segurança concluídos!');
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  testSecurity().catch(console.error);
}

module.exports = { testSecurity };