// Teste simples do endpoint de migrations/seeds
const axios = require('axios');

const baseUrl = 'http://localhost:4000'; // Ajuste a porta conforme necessário
const testModule = 'ordem_servico'; // Módulo que apareceu no erro

async function testEndpoint() {
    console.log('=== TESTE DO ENDPOINT DE MIGRATIONS/SEEDS ===\n');
    
    try {
        // 1. Primeiro, listar módulos para ver se o endpoint base funciona
        console.log('1. Testando listagem de módulos...');
        const listResponse = await axios.get(`${baseUrl}/configuracoes/sistema/modulos`);
        console.log(`✅ Listagem funcionou. Encontrados ${listResponse.data.length} módulos`);
        
        // Mostrar módulos disponíveis
        listResponse.data.forEach(module => {
            console.log(`   - ${module.slug} (${module.name}) - Status: ${module.status}`);
        });
        
        // 2. Testar o endpoint de migrations/seeds
        console.log(`\n2. Testando execução de migrations/seeds para: ${testModule}`);
        const migrationsUrl = `${baseUrl}/configuracoes/sistema/modulos/${testModule}/run-migrations-seeds`;
        console.log(`URL: ${migrationsUrl}`);
        
        const response = await axios.post(migrationsUrl);
        
        console.log('✅ Sucesso!');
        console.log('Resposta:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Dica: Verifique se o backend está rodando na porta correta');
        }
    }
}

testEndpoint();