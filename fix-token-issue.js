// Script para corrigir o problema de token JWT
// Execute este script no console do navegador para limpar tokens inválidos

console.log('=== CORRIGINDO PROBLEMA DE TOKEN ===');

// Função para limpar todos os tokens
function clearAllTokens() {
    console.log('1. Limpando cookies...');
    document.cookie = 'accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    
    console.log('2. Limpando sessionStorage...');
    sessionStorage.removeItem("@App:token");
    sessionStorage.removeItem("@App:refreshToken");
    
    console.log('3. Limpando localStorage (se houver)...');
    localStorage.removeItem("@App:token");
    localStorage.removeItem("@App:refreshToken");
    
    console.log('4. Tokens limpos com sucesso!');
}

// Função para verificar se precisa fazer logout
function checkAndFixTokens() {
    const encryptedToken = sessionStorage.getItem("@App:token");
    
    if (encryptedToken) {
        try {
            const decodedToken = atob(encryptedToken);
            const tokenParts = decodedToken.split('.');
            
            if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                const now = Math.floor(Date.now() / 1000);
                const isExpired = payload.exp < now;
                
                if (isExpired) {
                    console.log('Token expirado detectado. Limpando...');
                    clearAllTokens();
                    console.log('Redirecionando para login...');
                    window.location.href = '/login';
                    return;
                }
            }
        } catch (e) {
            console.log('Token inválido detectado. Limpando...');
            clearAllTokens();
            console.log('Redirecionando para login...');
            window.location.href = '/login';
            return;
        }
    }
    
    console.log('Tokens parecem válidos ou não existem.');
}

// Executar verificação
checkAndFixTokens();

console.log('=== CORREÇÃO CONCLUÍDA ===');