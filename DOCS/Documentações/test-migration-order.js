// Script para verificar a ordem das migrations e possíveis conflitos
const fs = require('fs');
const path = require('path');

const migrationsPath = path.resolve(process.cwd(), 'apps', 'backend', 'src', 'modules', 'ordem_servico', 'migrations');

console.log('=== VERIFICAÇÃO DE ORDEM DAS MIGRATIONS ===\n');

const files = fs.readdirSync(migrationsPath)
    .filter(f => f.endsWith('.sql'))
    .sort();

console.log('📋 Ordem de execução das migrations:\n');

// Verificar se há números duplicados
const numbers = files.map(f => f.split('_')[0]);
const duplicates = numbers.filter((num, index) => numbers.indexOf(num) !== index);

if (duplicates.length > 0) {
    console.log('⚠️ ATENÇÃO: Números de migration duplicados encontrados:');
    duplicates.forEach(dup => {
        const duplicateFiles = files.filter(f => f.startsWith(dup + '_'));
        console.log(`   ${dup}: ${duplicateFiles.join(', ')}`);
    });
    console.log('');
}

// Analisar dependências
console.log('🔍 Análise de dependências:\n');

const tableCreations = new Map();
const tableReferences = new Map();

files.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
    
    try {
        const filePath = path.join(migrationsPath, file);
        const content = fs.readFileSync(filePath, 'utf-8').toLowerCase();
        
        // Encontrar criações de tabela
        const createMatches = content.match(/create table[^(]*([a-z_]+)/g);
        if (createMatches) {
            createMatches.forEach(match => {
                const tableName = match.replace('create table if not exists ', '').replace('create table ', '').trim();
                if (!tableCreations.has(tableName)) {
                    tableCreations.set(tableName, []);
                }
                tableCreations.get(tableName).push(file);
                console.log(`   🏗️ Cria tabela: ${tableName}`);
            });
        }
        
        // Encontrar referências a tabelas
        const alterMatches = content.match(/alter table[^(]*([a-z_]+)/g);
        if (alterMatches) {
            alterMatches.forEach(match => {
                const tableName = match.replace('alter table ', '').trim();
                if (!tableReferences.has(tableName)) {
                    tableReferences.set(tableName, []);
                }
                tableReferences.get(tableName).push(file);
                console.log(`   🔧 Altera tabela: ${tableName}`);
            });
        }
        
        // Verificar referências específicas à coluna "code"
        if (content.includes('code')) {
            console.log(`   🔍 Referencia coluna "code"`);
        }
        
    } catch (error) {
        console.log(`   ❌ Erro ao analisar: ${error.message}`);
    }
    
    console.log('');
});

console.log('=== VERIFICAÇÃO DE CONFLITOS ===\n');

// Verificar se alguma migration tenta alterar uma tabela antes dela ser criada
for (const [tableName, references] of tableReferences) {
    const creations = tableCreations.get(tableName) || [];
    
    if (creations.length === 0) {
        console.log(`⚠️ PROBLEMA: Tabela ${tableName} é referenciada mas nunca criada`);
        console.log(`   Referenciada em: ${references.join(', ')}`);
        continue;
    }
    
    const firstCreation = creations[0];
    const firstCreationIndex = files.indexOf(firstCreation);
    
    references.forEach(refFile => {
        const refIndex = files.indexOf(refFile);
        if (refIndex < firstCreationIndex) {
            console.log(`❌ CONFLITO: ${refFile} tenta alterar ${tableName} antes de ${firstCreation} criá-la`);
        }
    });
}

console.log('\n=== RECOMENDAÇÕES ===');
console.log('1. Resolva números de migration duplicados');
console.log('2. Certifique-se de que tabelas são criadas antes de serem alteradas');
console.log('3. Verifique se todas as dependências estão satisfeitas');