#!/usr/bin/env ts-node

/**
 * Script simplificado de verificação de segurança
 * Foca apenas nos problemas críticos reais
 */

import { validateSecurityConfig } from '../src/common/utils/security.utils';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

console.log('🔒 Verificação de Segurança Simplificada');
console.log('=====================================\n');

// 1. Verificar configurações de ambiente
console.log('🔍 Verificando configurações...');
const validation = validateSecurityConfig();

let hasErrors = false;

if (!validation.isValid) {
  console.log('❌ ERROS DE CONFIGURAÇÃO:');
  validation.errors.forEach(error => {
    console.log(`   - ${error}`);
    hasErrors = true;
  });
}

if (validation.warnings.length > 0) {
  console.log('⚠️  AVISOS:');
  validation.warnings.forEach(warning => {
    console.log(`   - ${warning}`);
  });
}

// 2. Verificar se existe .env
if (!fs.existsSync('.env')) {
  console.log('❌ ERRO: Arquivo .env não encontrado');
  console.log('   Crie um arquivo .env baseado no .env.example');
  hasErrors = true;
}

// 3. Verificar senhas hardcoded específicas
console.log('\n🔍 Verificando senhas conhecidas...');
const seedContent = fs.readFileSync('./prisma/seed.ts', 'utf8');

// Verificar se ainda tem admin123 ou user123 hardcoded
if (seedContent.includes("'admin123'") || seedContent.includes('"admin123"')) {
  console.log('❌ ERRO: Senha "admin123" ainda hardcoded no seed.ts');
  hasErrors = true;
}

if (seedContent.includes("'user123'") || seedContent.includes('"user123"')) {
  console.log('❌ ERRO: Senha "user123" ainda hardcoded no seed.ts');
  hasErrors = true;
}

// 4. Verificar JWT_SECRET
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  console.log('❌ ERRO: JWT_SECRET não configurado no .env');
  hasErrors = true;
} else if (jwtSecret.length < 32) {
  console.log('❌ ERRO: JWT_SECRET muito curto (mínimo 32 caracteres)');
  hasErrors = true;
} else if (jwtSecret.includes('sua-chave-secreta') || jwtSecret === 'secret') {
  console.log('❌ ERRO: JWT_SECRET usando valor padrão inseguro');
  hasErrors = true;
}

// 5. Verificar se está em produção
if (process.env.NODE_ENV === 'production') {
  console.log('\n🏭 Verificações específicas de PRODUÇÃO:');
  
  if (!process.env.HTTPS_ENABLED || process.env.HTTPS_ENABLED !== 'true') {
    console.log('⚠️  AVISO: HTTPS não habilitado em produção');
  }
  
  if (!process.env.SENTRY_DSN) {
    console.log('⚠️  AVISO: Sentry não configurado para monitoramento');
  }
}

// Resultado final
console.log('\n📊 RESULTADO:');
if (hasErrors) {
  console.log('❌ FALHOU: Corrija os erros antes de continuar');
  console.log('\n💡 DICAS:');
  console.log('   1. Configure o arquivo .env com valores seguros');
  console.log('   2. Use: openssl rand -base64 32 para gerar JWT_SECRET');
  console.log('   3. Execute: npm run prisma:generate && npm run prisma:migrate');
  process.exit(1);
} else {
  console.log('✅ PASSOU: Configurações básicas de segurança OK');
  console.log('\n🚀 Sistema pronto para execução!');
  process.exit(0);
}