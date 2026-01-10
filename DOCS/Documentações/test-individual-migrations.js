// Script para testar migrations individuais
const fs = require('fs');
const path = require('path');

const migrationsPath = path.resolve(process.cwd(), 'apps', 'backend', 'src', 'modules', 'ordem_servico', 'migrations');

console.log('=== ANÁLISE DE MIGRATIONS INDIVIDUAIS ===\n');

if (!fs.existsSync(migrationsPath)) {
    console.log('❌ Pasta de migrations não encontrada:', migrationsPath);
    process.exit(1);
}

const files = fs.readdirSync(migrationsPath)
    .filter(f => f.endsWith('.sql'))
    .sort();

console.log(`📋 Encontradas ${files.length} migrations:\n`);

files.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
    
    try {
        const filePath = path.join(migrationsPath, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Verificar se contém referências à coluna "code"
        const hasCodeReference = content.toLowerCase().includes('code');
        if (hasCodeReference) {
            console.log(`   🔍 Contém referência à coluna "code"`);
            
            // Mostrar linhas que contêm "code"
            const lines = content.split('\n');
            lines.forEach((line, lineIndex) => {
                if (line.toLowerCase().includes('code')) {
                    console.log(`   📝 Linha ${lineIndex + 1}: ${line.trim()}`);
                }
            });
        }
        
        // Verificar se tenta criar tabelas
        const hasCreateTable = content.toLowerCase().includes('create table');
        if (hasCreateTable) {
            console.log(`   🏗️ Cria tabelas`);
        }
        
        // Verificar se tenta alterar tabelas
        const hasAlterTable = content.toLowerCase().includes('alter table');
        if (hasAlterTable) {
            console.log(`   🔧 Altera tabelas`);
        }
        
        // Verificar se faz INSERT
        const hasInsert = content.toLowerCase().includes('insert');
        if (hasInsert) {
            console.log(`   📥 Faz INSERT de dados`);
        }
        
        console.log('');
        
    } catch (error) {
        console.log(`   ❌ Erro ao ler arquivo: ${error.message}`);
    }
});

console.log('=== ANÁLISE COMPLETA ===');
console.log('\n💡 Dicas para resolver o problema:');
console.log('1. Verifique se migrations que usam "code" vêm DEPOIS da que cria a tabela');
console.log('2. Verifique se há migrations duplicadas (mesmo número)');
console.log('3. Verifique se há dependências entre tabelas que não existem ainda');