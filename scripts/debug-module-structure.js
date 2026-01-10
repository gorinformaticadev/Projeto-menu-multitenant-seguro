// Debug da estrutura do módulo
const fs = require('fs');
const path = require('path');

const backendModulesPath = path.resolve(process.cwd(), 'apps', 'backend', 'src', 'modules');
const testModule = 'ordem_servico';

console.log('=== DEBUG DA ESTRUTURA DO MÓDULO ===\n');

console.log('1. Verificando caminhos...');
console.log(`Backend modules path: ${backendModulesPath}`);
console.log(`Existe? ${fs.existsSync(backendModulesPath)}`);

if (fs.existsSync(backendModulesPath)) {
    console.log('\n2. Módulos encontrados:');
    const modules = fs.readdirSync(backendModulesPath);
    modules.forEach(module => {
        console.log(`   - ${module}`);
    });
    
    const modulePath = path.join(backendModulesPath, testModule);
    console.log(`\n3. Verificando módulo específico: ${testModule}`);
    console.log(`Caminho: ${modulePath}`);
    console.log(`Existe? ${fs.existsSync(modulePath)}`);
    
    if (fs.existsSync(modulePath)) {
        console.log('\n4. Conteúdo do módulo:');
        const moduleContents = fs.readdirSync(modulePath);
        moduleContents.forEach(item => {
            const itemPath = path.join(modulePath, item);
            const isDir = fs.statSync(itemPath).isDirectory();
            console.log(`   ${isDir ? '📁' : '📄'} ${item}`);
        });
        
        // Verificar migrations
        const migrationsPath = path.join(modulePath, 'migrations');
        console.log(`\n5. Migrations (${migrationsPath}):`);
        console.log(`Existe? ${fs.existsSync(migrationsPath)}`);
        
        if (fs.existsSync(migrationsPath)) {
            const migrations = fs.readdirSync(migrationsPath).filter(f => f.endsWith('.sql'));
            console.log(`Migrations encontradas: ${migrations.length}`);
            migrations.forEach(migration => {
                console.log(`   - ${migration}`);
            });
        }
        
        // Verificar seeds
        const seedsPath = path.join(modulePath, 'seeds');
        console.log(`\n6. Seeds (${seedsPath}):`);
        console.log(`Existe? ${fs.existsSync(seedsPath)}`);
        
        if (fs.existsSync(seedsPath)) {
            const seeds = fs.readdirSync(seedsPath).filter(f => f.endsWith('.sql'));
            console.log(`Seeds encontrados: ${seeds.length}`);
            seeds.forEach(seed => {
                console.log(`   - ${seed}`);
            });
        }
        
        // Verificar module.json
        const moduleJsonPath = path.join(modulePath, 'module.json');
        console.log(`\n7. module.json (${moduleJsonPath}):`);
        console.log(`Existe? ${fs.existsSync(moduleJsonPath)}`);
        
        if (fs.existsSync(moduleJsonPath)) {
            try {
                const moduleJson = JSON.parse(fs.readFileSync(moduleJsonPath, 'utf-8'));
                console.log('Conteúdo:');
                console.log(JSON.stringify(moduleJson, null, 2));
            } catch (error) {
                console.log(`Erro ao ler module.json: ${error.message}`);
            }
        }
    }
} else {
    console.log('❌ Diretório de módulos não encontrado!');
    console.log('\nTentando caminhos alternativos...');
    
    // Tentar outros caminhos possíveis
    const alternatives = [
        path.resolve(process.cwd(), 'src', 'modules'),
        path.resolve(process.cwd(), 'modules'),
        path.resolve(process.cwd(), 'apps', 'backend', 'modules'),
    ];
    
    alternatives.forEach(altPath => {
        console.log(`Tentando: ${altPath} - ${fs.existsSync(altPath) ? '✅' : '❌'}`);
    });
}