// Script para debugar o problema de token JWT
// Execute este script no console do navegador para verificar o estado dos tokens

console.log('=== DEBUG TOKEN ISSUE ===');

// Verificar cookies
console.log('1. Verificando cookies:');
const cookies = document.cookie.split(';');
const accessTokenCookie = cookies.find(c => c.trim().startsWith('accessToken='));
const refreshTokenCookie = cookies.find(c => c.trim().startsWith('refreshToken='));

console.log('Access Token Cookie:', accessTokenCookie ? 'Presente' : 'Ausente');
console.log('Refresh Token Cookie:', refreshTokenCookie ? 'Presente' : 'Ausente');

// Verificar sessionStorage
console.log('\n2. Verificando sessionStorage:');
const encryptedToken = sessionStorage.getItem("@App:token");
const encryptedRefreshToken = sessionStorage.getItem("@App:refreshToken");

console.log('Encrypted Token:', encryptedToken ? 'Presente' : 'Ausente');
console.log('Encrypted Refresh Token:', encryptedRefreshToken ? 'Presente' : 'Ausente');

// Tentar decodificar tokens
if (encryptedToken) {
    try {
        const decodedToken = atob(encryptedToken);
        console.log('Token decodificado (primeiros 50 chars):', decodedToken.substring(0, 50) + '...');
        
        // Verificar se o token está expirado
        const tokenParts = decodedToken.split('.');
        if (tokenParts.length === 3) {
            const payload = JSON.parse(atob(tokenParts[1]));
            const now = Math.floor(Date.now() / 1000);
            const isExpired = payload.exp < now;
            console.log('Token expirado:', isExpired);
            console.log('Expira em:', new Date(payload.exp * 1000));
            console.log('Agora:', new Date());
        }
    } catch (e) {
        console.log('Erro ao decodificar token:', e.message);
    }
}

// Verificar se há requisições pendentes
console.log('\n3. Testando requisição para API:');
fetch('http://localhost:4000/api/ordem_servico/ordens/b86c36ea-57fd-4b77-a985-9735447048c3', {
    headers: {
        'Authorization': `Bearer ${accessTokenCookie ? accessTokenCookie.split('=')[1] : (encryptedToken ? atob(encryptedToken) : 'NO_TOKEN')}`,
        'Content-Type': 'application/json'
    }
})
.then(response => {
    console.log('Status da resposta:', response.status);
    console.log('Headers da resposta:', [...response.headers.entries()]);
    return response.text();
})
.then(text => {
    console.log('Corpo da resposta:', text);
})
.catch(error => {
    console.log('Erro na requisição:', error);
});

console.log('\n=== FIM DEBUG ===');