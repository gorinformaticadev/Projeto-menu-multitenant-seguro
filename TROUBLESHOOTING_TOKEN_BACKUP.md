# 🔍 Troubleshooting: Token não encontrado no Backup

## 🎯 Problema

```
Erro ao criar backup: Error: Token de autenticação não encontrado. Faça login novamente.
```

---

## ✅ Solução Implementada

O código agora **tenta buscar o token em 3 locais diferentes** e mostra no console onde encontrou (ou não encontrou) o token:

### Locais verificados (em ordem):

1. **localStorage** com chave `@App:token` (codificado em base64)
2. **sessionStorage** com chave `@App:token` (codificado em base64)
3. **Cookies** com nome `accessToken` (não codificado)

---

## 🧪 Como Testar Agora

### 1. Recarregue a página completamente
```
Ctrl + Shift + R  (ou Cmd + Shift + R no Mac)
```
Isso garante que o código atualizado seja carregado.

### 2. Abra o Console do Navegador
```
F12 → Aba Console
```

### 3. Tente criar um backup novamente

Agora o console vai mostrar uma das seguintes mensagens:

#### ✅ **Se encontrar o token:**
```
✅ Token encontrado no localStorage (@App:token)
```
ou
```
✅ Token encontrado no sessionStorage (@App:token)
```
ou
```
✅ Token encontrado nos cookies (accessToken)
```

**Resultado:** O backup deve funcionar normalmente!

---

#### ❌ **Se NÃO encontrar o token:**
```
❌ Token não encontrado em nenhum local!
localStorage.getItem("@App:token"): null
sessionStorage.getItem("@App:token"): null
document.cookie: (string vazia ou sem accessToken)
```

**Causa:** Você não está realmente logado ou a sessão expirou.

**Solução:** Faça logout e login novamente.

---

## 🔧 Soluções Passo a Passo

### Solução 1: Fazer Login Novamente (Recomendado)

1. **Fazer logout:**
   - Clique no menu do usuário (canto superior direito)
   - Clique em "Sair"

2. **Fazer login novamente:**
   - Usar suas credenciais de SUPER_ADMIN
   - Exemplo: `superadmin@sistema.com` / sua senha

3. **Tentar o backup novamente**

---

### Solução 2: Verificar se realmente está logado

Abra o console (F12) e execute:

```javascript
// Verificar se há dados do usuário
const user = localStorage.getItem('@App:user');
console.log('Usuário logado?', user !== null);

if (user) {
  const userData = JSON.parse(user);
  console.log('Nome:', userData.name);
  console.log('Email:', userData.email);
  console.log('Role:', userData.role);
}

// Verificar se há token
const hasToken = localStorage.getItem('@App:token') !== null || 
                 sessionStorage.getItem('@App:token') !== null ||
                 document.cookie.includes('accessToken');
console.log('Token disponível?', hasToken);
```

**Resultado esperado:**
```
Usuário logado? true
Nome: Admin Sistema
Email: admin@sistema.com
Role: SUPER_ADMIN
Token disponível? true
```

**Se o resultado for diferente:**
- `Usuário logado? false` → **Faça login**
- `Token disponível? false` → **Sessão expirou, faça login novamente**

---

### Solução 3: Limpar cache e cookies

Se o problema persistir, limpe completamente o cache:

#### Chrome/Edge:
1. `Ctrl + Shift + Delete`
2. Selecionar:
   - ✅ Cookies e outros dados do site
   - ✅ Imagens e arquivos em cache
3. Período: "Última hora"
4. Clicar em "Limpar dados"
5. **Fazer login novamente**

#### Firefox:
1. `Ctrl + Shift + Delete`
2. Selecionar:
   - ✅ Cookies
   - ✅ Cache
3. Intervalo: "Última hora"
4. Clicar em "Limpar agora"
5. **Fazer login novamente**

---

## 📊 Diagrama de Diagnóstico

```
┌─────────────────────────────────────┐
│  Usuário tenta criar backup         │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│  Buscar token no localStorage       │
│  Chave: @App:token                  │
└────────────┬────────────────────────┘
             │
         Encontrou?
        ┌────┴────┐
       SIM       NÃO
        │          │
        │          ▼
        │    ┌─────────────────────────────┐
        │    │  Buscar no sessionStorage   │
        │    │  Chave: @App:token          │
        │    └────────────┬────────────────┘
        │                 │
        │            Encontrou?
        │           ┌────┴────┐
        │          SIM       NÃO
        │           │          │
        │           │          ▼
        │           │    ┌─────────────────┐
        │           │    │  Buscar cookies │
        │           │    │  Nome: accessToken
        │           │    └────────┬────────┘
        │           │             │
        │           │        Encontrou?
        │           │       ┌────┴────┐
        │           │      SIM       NÃO
        │           │       │          │
        ▼           ▼       ▼          ▼
   ┌────────────────────────┐    ┌──────────────┐
   │  ✅ Token encontrado!  │    │  ❌ ERRO:    │
   │  Conectar SSE          │    │  Não logado  │
   │  Iniciar backup        │    │  Fazer login │
   └────────────────────────┘    └──────────────┘
```

---

## 🐛 Problemas Comuns

### Problema 1: "Token expirado"

**Sintoma:** Console mostra que token foi encontrado, mas mesmo assim dá erro 401.

**Causa:** Token JWT expirou (validade de 15 minutos).

**Solução:**
1. Fazer logout
2. Fazer login novamente
3. Tentar backup imediatamente

---

### Problema 2: "Fast Refresh apaga o token"

**Sintoma:** Depois de salvar o código (Fast Refresh), o token some.

**Causa:** Desenvolvimento com Hot Module Replacement pode limpar storage temporariamente.

**Solução:**
1. Recarregar página completamente (`Ctrl + Shift + R`)
2. Se necessário, fazer login novamente

---

### Problema 3: "Token no cookie mas não funciona"

**Sintoma:** Console mostra token no cookie, mas SSE retorna 401.

**Causa:** Cookie pode estar com formato incorreto ou sem flags corretas.

**Solução:**
```javascript
// Verificar no console
document.cookie.split(';').forEach(c => console.log(c.trim()));

// Procurar por "accessToken=xxx"
// Se não aparecer ou estiver vazio, fazer login novamente
```

---

## 📝 Checklist de Verificação

Antes de reportar um bug, verifique:

- [ ] Fiz reload completo da página (`Ctrl + Shift + R`)
- [ ] Estou realmente logado no sistema
- [ ] Minha role é SUPER_ADMIN
- [ ] Abri o console do navegador (F12)
- [ ] Verifiquei as mensagens de log no console
- [ ] Token está presente em pelo menos um dos 3 locais
- [ ] Token não está expirado (fiz login há menos de 15 minutos)
- [ ] Backend está rodando (`npm run start:dev`)
- [ ] Frontend está rodando (`npm run dev`)

---

## 🚀 Teste Rápido

Execute este código no console para testar tudo de uma vez:

```javascript
console.clear();
console.log('🔍 Diagnóstico Completo de Autenticação\n');

// 1. Verificar usuário
const user = localStorage.getItem('@App:user');
console.log('1️⃣ Usuário no localStorage:', user ? '✅ SIM' : '❌ NÃO');
if (user) {
  try {
    const userData = JSON.parse(user);
    console.log('   - Nome:', userData.name);
    console.log('   - Email:', userData.email);
    console.log('   - Role:', userData.role);
    console.log('   - É SUPER_ADMIN?', userData.role === 'SUPER_ADMIN' ? '✅ SIM' : '❌ NÃO');
  } catch (e) {
    console.error('   - Erro ao parsear:', e);
  }
}

// 2. Verificar token no localStorage
const localToken = localStorage.getItem('@App:token');
console.log('\n2️⃣ Token no localStorage:', localToken ? '✅ SIM' : '❌ NÃO');
if (localToken) {
  try {
    const decoded = atob(localToken);
    const parts = decoded.split('.');
    console.log('   - Token decodificado:', parts.length === 3 ? '✅ Válido (JWT)' : '❌ Inválido');
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1]));
      const now = Math.floor(Date.now() / 1000);
      const isExpired = payload.exp < now;
      console.log('   - Expira em:', new Date(payload.exp * 1000).toLocaleString());
      console.log('   - Está expirado?', isExpired ? '❌ SIM (fazer login!)' : '✅ NÃO');
    }
  } catch (e) {
    console.error('   - Erro ao decodificar:', e);
  }
}

// 3. Verificar token no sessionStorage
const sessionToken = sessionStorage.getItem('@App:token');
console.log('\n3️⃣ Token no sessionStorage:', sessionToken ? '✅ SIM' : '❌ NÃO');

// 4. Verificar token nos cookies
const hasCookie = document.cookie.includes('accessToken');
console.log('\n4️⃣ Token nos cookies:', hasCookie ? '✅ SIM' : '❌ NÃO');
if (hasCookie) {
  const cookies = document.cookie.split(';');
  const accessToken = cookies.find(c => c.trim().startsWith('accessToken='));
  console.log('   - Cookie:', accessToken ? accessToken.substring(0, 50) + '...' : 'não encontrado');
}

// 5. Diagnóstico final
console.log('\n📊 DIAGNÓSTICO FINAL:');
const hasAnyToken = localToken || sessionToken || hasCookie;
if (!user) {
  console.error('❌ NÃO ESTÁ LOGADO - Faça login');
} else if (!hasAnyToken) {
  console.error('❌ SEM TOKEN - Sessão expirou, faça login novamente');
} else {
  console.log('✅ TUDO OK - Deveria funcionar!');
  console.log('   Se ainda der erro, verifique o backend.');
}
```

**Copie e cole no console do navegador e verifique o resultado!**

---

## 📞 Ainda com problemas?

Se após seguir todos os passos o problema persistir:

1. **Copie a saída completa do "Teste Rápido" acima**
2. **Tire um print da tela de erro**
3. **Verifique os logs do backend** para ver se a requisição está chegando

**Logs esperados no backend:**
```
[BackupController] POST /api/backup/create - sessionId: backup_xxx
[SseJwtGuard] Validando token da query string
[SseJwtGuard] Token válido para usuário: xxx
```

**Se aparecer:**
```
[SseJwtGuard] Token não fornecido
```
→ Token não está sendo enviado na URL

**Se aparecer:**
```
[SseJwtGuard] Token inválido ou expirado
```
→ Token está corrompido ou expirou

---

**Data:** 20/01/2026  
**Versão:** 3.0 (com debug avançado)  
**Status:** ✅ Debug implementado, aguardando teste
