/**
 * Script para criar um ZIP do módulo de exemplo
 */

const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

function createExampleModuleZip() {
  console.log('🔧 Criando ZIP do módulo de exemplo...');

  try {
    const zip = new AdmZip();
    const moduleDir = path.join(__dirname, 'example-module');
    const outputPath = path.join(__dirname, 'uploads', 'modules', 'example-module.zip');

    // Criar diretório de uploads se não existir
    const uploadsDir = path.dirname(outputPath);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Adicionar arquivos ao ZIP
    const files = [
      'module.json',
      'package.json',
      'README.md',
      'migrations/001_create_example_table.sql'
    ];

    files.forEach(file => {
      const filePath = path.join(moduleDir, file);
      if (fs.existsSync(filePath)) {
        zip.addLocalFile(filePath, path.dirname(file) === '.' ? '' : path.dirname(file));
        console.log(`✅ Adicionado: ${file}`);
      } else {
        console.log(`⚠️  Arquivo não encontrado: ${file}`);
      }
    });

    // Salvar ZIP
    zip.writeZip(outputPath);
    console.log(`📦 ZIP criado: ${outputPath}`);

    // Mostrar informações do arquivo
    const stats = fs.statSync(outputPath);
    console.log(`📊 Tamanho: ${(stats.size / 1024).toFixed(2)} KB`);

    console.log('\n✅ Módulo de exemplo criado com sucesso!');
    console.log('💡 Use este arquivo para testar o upload de módulos na interface.');

  } catch (error) {
    console.error('❌ Erro ao criar módulo de exemplo:', error.message);
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  createExampleModuleZip();
}

module.exports = { createExampleModuleZip };