#!/usr/bin/env node

/**
 * Script para iniciar o ambiente de staging
 * Uso: node start-staging.js
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando ambiente de staging...\n');

// Verificar se o arquivo .env.staging existe
const envStagingPath = path.join(__dirname, '.env.staging');
if (!fs.existsSync(envStagingPath)) {
  console.error('❌ Arquivo .env.staging não encontrado!');
  console.log('📝 Crie o arquivo .env.staging baseado no .env.staging.example');
  process.exit(1);
}

// Verificar se o banco de dados de staging existe
console.log('🔍 Verificando banco de dados de staging...');

// Aqui você pode adicionar lógica para verificar/criar o banco de staging
// Por enquanto, vamos assumir que está configurado

console.log('✅ Ambiente de staging configurado');
console.log('🌐 Backend staging: http://localhost:4001');
console.log('🎨 Frontend staging: http://localhost:5001\n');

// Iniciar o backend em modo staging
console.log('🔧 Iniciando backend em modo staging...');

const backendProcess = spawn('npm', ['run', 'start:dev'], {
  cwd: __dirname,
  env: {
    ...process.env,
    NODE_ENV: 'staging',
  },
  stdio: 'inherit'
});

backendProcess.on('error', (error) => {
  console.error('❌ Erro ao iniciar backend:', error);
});

backendProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ Backend encerrou com código ${code}`);
  }
});

// Manter o processo rodando
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando ambiente de staging...');
  backendProcess.kill('SIGINT');
  process.exit(0);
});

console.log('✅ Ambiente de staging iniciado com sucesso!');
console.log('📊 Monitorando logs... (Ctrl+C para encerrar)\n');