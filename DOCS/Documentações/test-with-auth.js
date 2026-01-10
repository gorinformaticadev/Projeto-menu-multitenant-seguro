// Teste com autenticação simulada (apenas para debug)
const axios = require('axios');

const baseUrl = 'http://localhost:4000';

async function testWithoutAuth() {
    console.log('=== TESTE SEM AUTENTICAÇÃO (PARA DEBUG) ===\n');
    
    try {
        // Tentar acessar um endpoint que não requer autenticação para confirmar que o servidor está rodando
        console.log('1. Testando se o servidor está respondendo...');
        
        try {
            await axios.get(`${baseUrl}/configuracoes/sistema/modulos`);
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✅ Servidor está rodando (retornou 401 - Unauthorized, como esperado)');
            } else {
                throw error;
            }
        }
        
        // Tentar executar migrations (vai falhar por falta de auth, mas podemos ver o erro específico)
        console.log('\n2. Tentando executar migrations (vai falhar por auth, mas podemos ver logs do servidor)...');
        
        try {
            await axios.post(`${baseUrl}/configuracoes/sistema/modulos/ordem_servico/run-migrations-seeds`);
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✅ Endpoint existe e está protegido (401 - Unauthorized)');
                console.log('💡 Verifique os logs do servidor para ver se há erros de migration');
            } else {
                console.log('❌ Erro inesperado:', error.response?.status, error.response?.data);
            }
        }
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Dica: Backend não está rodando na porta 4000');
        }
    }
}

testWithoutAuth();