# Implementação Técnica - Correção do Login

## Visão Geral

Este documento detalha as mudanças de código implementadas para corrigir o problema de login no sistema multitenant.

**Data**: 10 de dezembro de 2025
**Tipo**: Correção de Bug Crítico
**Impacto**: Frontend apenas (zero mudanças no backend)

---

## Arquitetura da Solução

### Antes da Correção

```
Página Login
    ↓
use2FALogin Hook
    ├─→ Salva tokens em sessionStorage (não criptografado)
    └─→ Tenta redirecionar com router.push
         ↓
    Dashboard carrega
         ↓
    AuthContext verifica autenticação
         ├─→ Busca tokens em localStorage
         └─→ NÃO ENCONTRA (tokens estão em sessionStorage)
              ↓
         ProtectedRoute detecta usuário não autenticado
              ↓
         REDIRECIONAMENTO PARA /login ❌
```

### Depois da Correção

```
Página Login
    ↓
use2FALogin Hook (simplificado)
    ↓
AuthContext.loginWithCredentials()
    ├─→ POST /auth/login
    ├─→ Salva tokens em localStorage (criptografado)
    ├─→ Atualiza estado do usuário
    └─→ Redireciona para /dashboard
         ↓
    Dashboard carrega
         ↓
    ProtectedRoute verifica AuthContext
         ├─→ Usuário autenticado ✅
         └─→ Permite acesso
              ↓
         Dashboard renderiza com sucesso ✅
```

---

## Mudanças no Código

### 1. AuthContext.tsx

#### Interface LoginResult (Nova)

```typescript
export interface LoginResult {
  success: boolean;      // Login completou com sucesso
  requires2FA: boolean;  // Necessário código 2FA
  user?: User;           // Dados do usuário (se sucesso)
  error?: string;        // Mensagem de erro (se falha)
}
```

**Uso**: Retorno estruturado dos métodos de login para comunicação clara com componentes.

#### Interface AuthContextData (Atualizada)

```typescript
interface AuthContextData {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;  // Mantido para compatibilidade
  loginWithCredentials: (email: string, password: string) => Promise<LoginResult>;  // NOVO
  loginWith2FA: (email: string, password: string, code: string) => Promise<LoginResult>;  // NOVO
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}
```

#### Método loginWithCredentials (Novo)

```typescript
async function loginWithCredentials(email: string, password: string): Promise<LoginResult> {
  try {
    // Validar inputs
    if (!email || !password) {
      return {
        success: false,
        requires2FA: false,
        error: "Preencha todos os campos"
      };
    }

    // Tentar login normal
    const response = await api.post("/auth/login", { email, password });
    const { accessToken, refreshToken, user: userData } = response.data;

    // Salvar tokens no SecureStorage (localStorage com criptografia Base64)
    SecureStorage.setToken(accessToken);
    SecureStorage.setRefreshToken(refreshToken);
    api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

    // Atualizar estado do usuário
    setUser(userData);

    // Redirecionar para dashboard
    router.push("/dashboard");

    return {
      success: true,
      requires2FA: false,
      user: userData
    };
  } catch (error: any) {
    // Verificar se é erro de 2FA
    const errorMessage = error.response?.data?.message || "";
    if (errorMessage.includes("2FA") || errorMessage.includes("two-factor")) {
      return {
        success: false,
        requires2FA: true
      };
    }

    // Outros erros
    return {
      success: false,
      requires2FA: false,
      error: errorMessage || "Erro ao fazer login"
    };
  }
}
```

**Responsabilidades**:
1. Validação de inputs
2. Requisição POST para `/auth/login`
3. Detecção de necessidade de 2FA
4. Salvamento seguro de tokens
5. Atualização de estado global
6. Redirecionamento

**Diferencial**: Tratamento explícito de 2FA através de detecção de erro específico.

#### Método loginWith2FA (Novo)

```typescript
async function loginWith2FA(email: string, password: string, code: string): Promise<LoginResult> {
  try {
    // Validar inputs
    if (!email || !password || !code) {
      return {
        success: false,
        requires2FA: false,
        error: "Preencha todos os campos"
      };
    }

    // Login com 2FA
    const response = await api.post("/auth/login-2fa", {
      email,
      password,
      twoFactorToken: code
    });

    const { accessToken, refreshToken, user: userData } = response.data;

    // Salvar tokens no SecureStorage
    SecureStorage.setToken(accessToken);
    SecureStorage.setRefreshToken(refreshToken);
    api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

    // Atualizar estado do usuário
    setUser(userData);

    // Redirecionar para dashboard
    router.push("/dashboard");

    return {
      success: true,
      requires2FA: false,
      user: userData
    };
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || "Código inválido";
    return {
      success: false,
      requires2FA: false,
      error: errorMessage
    };
  }
}
```

**Responsabilidades**:
1. Validação de inputs incluindo código 2FA
2. Requisição POST para `/auth/login-2fa`
3. Salvamento seguro de tokens
4. Atualização de estado global
5. Redirecionamento

#### Provider Atualizado

```typescript
return (
  <AuthContext.Provider value={{ 
    user, 
    loading, 
    login,                    // Mantido para compatibilidade
    loginWithCredentials,     // NOVO
    loginWith2FA,             // NOVO
    logout, 
    updateUser 
  }}>
    {children}
  </AuthContext.Provider>
);
```

---

### 2. use2FALogin.ts

#### Importações Atualizadas

```typescript
// REMOVIDO
// import api from "@/lib/api";
// import { useRouter } from "next/navigation";

// ADICIONADO
import { useAuth } from "@/contexts/AuthContext";
```

**Razão**: Hook não gerencia mais tokens ou redirecionamento diretamente.

#### Hook Simplificado

```typescript
export function use2FALogin() {
  const { loginWithCredentials, loginWith2FA } = useAuth();  // Delega para AuthContext
  const [requires2FA, setRequires2FA] = useState(false);
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Métodos simplificados que delegam para AuthContext
  // ...
}
```

**Estado Gerenciado** (apenas UI):
- `requires2FA`: Controla renderização da tela de 2FA
- `credentials`: Armazena email/senha para uso no fluxo 2FA
- `loading`: Indica operação em andamento
- `error`: Mensagem de erro para exibição

#### Método attemptLogin (Refatorado)

```typescript
async function attemptLogin(email: string, password: string) {
  setCredentials({ email, password });
  setLoading(true);
  setError("");

  try {
    // DELEGA para AuthContext ao invés de fazer requisição direta
    const result = await loginWithCredentials(email, password);
    
    if (result.success) {
      // Login concluído - AuthContext já redirecionou
      return { success: true };
    }
    
    if (result.requires2FA) {
      // 2FA necessário - atualizar estado da UI
      setRequires2FA(true);
      return { success: false, requires2FA: true };
    }
    
    // Erro de login
    setError(result.error || "Erro ao fazer login");
    return { success: false, requires2FA: false };
  } catch (err: any) {
    // Erro inesperado
    setError("Erro ao fazer login");
    return { success: false, requires2FA: false };
  } finally {
    setLoading(false);
  }
}
```

**Mudanças Principais**:
- ❌ Removido: `api.post("/auth/login")`
- ❌ Removido: `sessionStorage.setItem()`
- ❌ Removido: `router.push()`
- ❌ Removido: `window.location.href`
- ✅ Adicionado: Delegação para `loginWithCredentials()`
- ✅ Mantido: Gerenciamento de estado de UI

#### Método loginWith2FACode (Refatorado)

```typescript
async function loginWith2FACode(code: string) {
  setLoading(true);
  setError("");

  try {
    // DELEGA para AuthContext
    const result = await loginWith2FA(credentials.email, credentials.password, code);

    if (result.success) {
      // Login concluído - AuthContext já redirecionou
      return { success: true };
    }

    // Erro no código 2FA
    setError(result.error || "Código inválido");
    return { success: false };
  } catch (err: any) {
    setError("Erro ao validar código");
    return { success: false };
  } finally {
    setLoading(false);
  }
}
```

**Mudanças Principais**:
- ❌ Removido: `api.post("/auth/login-2fa")`
- ❌ Removido: `sessionStorage.setItem()`
- ❌ Removido: `router.push()` e `setTimeout`
- ✅ Adicionado: Delegação para `loginWith2FA()`

#### Retorno do Hook

```typescript
return {
  requires2FA,
  loading,
  error,
  attemptLogin,
  loginWith2FA: loginWith2FACode,  // Renomeado para evitar conflito
  reset,
  credentials,
};
```

---

### 3. page.tsx (Login)

#### handleSubmit Simplificado

```typescript
// ANTES
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  if (!email || !password) {
    toast({ title: "Erro", description: "Preencha todos os campos", variant: "destructive" });
    return;
  }

  const result = await attemptLogin(email, password);
  
  if (result.success) {
    toast({ title: "Sucesso", description: "Login realizado com sucesso!" });  // ❌
  }
}

// DEPOIS
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  if (!email || !password) {
    toast({ title: "Erro", description: "Preencha todos os campos", variant: "destructive" });
    return;
  }

  await attemptLogin(email, password);
  // Toast de sucesso removido - AuthContext já redireciona
}
```

**Razão**: AuthContext gerencia redirecionamento automaticamente. Toast de sucesso seria visível por milissegundos antes do redirect.

#### handle2FASubmit Simplificado

```typescript
// ANTES
async function handle2FASubmit(code: string) {
  const result = await loginWith2FA(code);
  
  if (result.success) {
    toast({ title: "Sucesso", description: "Login realizado com sucesso!" });  // ❌
  }
}

// DEPOIS
async function handle2FASubmit(code: string) {
  await loginWith2FA(code);
  // Toast de sucesso removido - AuthContext já redireciona
}
```

#### useEffect para Erros (Mantido)

```typescript
useEffect(() => {
  if (error) {
    toast({
      title: "Erro no login",
      description: error,
      variant: "destructive",
    });
  }
}, [error, toast]);
```

**Mantido**: Erros são gerenciados pelo hook e exibidos via toast.

---

## Fluxo de Dados

### Login Sem 2FA - Sequência Detalhada

```
1. Usuário preenche email/senha
   ↓
2. Clica em "Entrar"
   ↓
3. page.tsx.handleSubmit() validação local
   ↓
4. use2FALogin.attemptLogin(email, password)
   ├─→ setLoading(true)
   ├─→ setCredentials({ email, password })
   └─→ AuthContext.loginWithCredentials(email, password)
        ├─→ Validação de inputs
        ├─→ api.post("/auth/login", { email, password })
        │    ↓
        │   Backend valida credenciais
        │    ├─→ Sucesso: retorna { accessToken, refreshToken, user }
        │    └─→ Erro: retorna { message: "..." }
        │
        ├─→ SecureStorage.setToken(accessToken)
        │    └─→ localStorage.setItem("@App:token", btoa(accessToken))
        │
        ├─→ SecureStorage.setRefreshToken(refreshToken)
        │    └─→ localStorage.setItem("@App:refreshToken", btoa(refreshToken))
        │
        ├─→ api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`
        │
        ├─→ setUser(userData)
        │    └─→ Estado global atualizado
        │
        ├─→ router.push("/dashboard")
        │
        └─→ return { success: true, requires2FA: false, user: userData }
             ↓
   ├─→ setLoading(false)
   └─→ return { success: true }
        ↓
5. Dashboard carrega
   ├─→ ProtectedRoute verifica AuthContext
   ├─→ user !== null → Permite acesso
   └─→ Dashboard renderiza ✅
```

### Login Com 2FA - Sequência Detalhada

```
1. Usuário preenche email/senha
   ↓
2. Clica em "Entrar"
   ↓
3. use2FALogin.attemptLogin(email, password)
   └─→ AuthContext.loginWithCredentials(email, password)
        ├─→ api.post("/auth/login", { email, password })
        │    ↓
        │   Backend detecta 2FA ativado
        │    └─→ throw UnauthorizedException("2FA required")
        │
        └─→ catch (error)
             ├─→ errorMessage.includes("2FA") → true
             └─→ return { success: false, requires2FA: true }
                  ↓
   ├─→ setRequires2FA(true)
   └─→ return { success: false, requires2FA: true }
        ↓
4. page.tsx re-renderiza
   ├─→ if (requires2FA) → true
   └─→ Renderiza <TwoFactorLogin />
        ↓
5. Usuário insere código 2FA
   ↓
6. Clica em "Verificar"
   ↓
7. use2FALogin.loginWith2FACode(code)
   └─→ AuthContext.loginWith2FA(email, password, code)
        ├─→ api.post("/auth/login-2fa", { email, password, twoFactorToken: code })
        │    ↓
        │   Backend valida código 2FA
        │    └─→ Sucesso: retorna { accessToken, refreshToken, user }
        │
        ├─→ SecureStorage.setToken(accessToken)
        ├─→ SecureStorage.setRefreshToken(refreshToken)
        ├─→ api.defaults.headers.common["Authorization"] = ...
        ├─→ setUser(userData)
        ├─→ router.push("/dashboard")
        └─→ return { success: true, ... }
             ↓
8. Dashboard carrega e renderiza ✅
```

---

## Gerenciamento de Tokens

### SecureStorage (Já Existente)

```typescript
const SecureStorage = {
  encryptionKey: 'app-secure-key-2024',  // Chave simbólica

  encrypt: (text: string): string => {
    return btoa(text);  // Base64 encoding
  },

  decrypt: (encrypted: string): string => {
    try {
      return atob(encrypted);  // Base64 decoding
    } catch {
      return '';
    }
  },

  setToken: (token: string) => {
    if (typeof window !== "undefined") {
      const encrypted = SecureStorage.encrypt(token);
      localStorage.setItem("@App:token", encrypted);
    }
  },

  getToken: (): string | null => {
    if (typeof window !== "undefined") {
      const encrypted = localStorage.getItem("@App:token");
      return encrypted ? SecureStorage.decrypt(encrypted) : null;
    }
    return null;
  },

  removeToken: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("@App:token");
    }
  },

  // Métodos similares para refreshToken
};
```

**Nota**: Base64 não é criptografia real, apenas ofuscação. Evita exposição óbvia mas não protege contra ataques determinados.

### API Client - Interceptor de Request

```typescript
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = typeof window !== "undefined"
      ? localStorage.getItem("@App:token")
      : null;

    if (token) {
      // Descriptografar token antes de usar
      const decryptedToken = token ? atob(token) : null;
      if (decryptedToken) {
        config.headers.Authorization = `Bearer ${decryptedToken}`;
      }
    }

    return config;
  }
);
```

**Integração**: API Client lê tokens do mesmo local onde AuthContext salva (localStorage).

---

## Comparação: Antes vs Depois

### Armazenamento de Tokens

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Local | sessionStorage | localStorage |
| Criptografia | Nenhuma | Base64 |
| Quem salva | use2FALogin | AuthContext |
| Quem lê | API Client (localStorage) | API Client (localStorage) |
| Consistência | ❌ Desalinhado | ✅ Alinhado |

### Gerenciamento de Estado

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Ponto de verdade | Múltiplos | AuthContext (único) |
| Quem gerencia usuário | - | AuthContext |
| Quem redireciona | use2FALogin | AuthContext |
| Verificação de auth | ProtectedRoute → Falha | ProtectedRoute → Sucesso |

### Complexidade do Código

| Arquivo | Linhas Antes | Linhas Depois | Diferença |
|---------|--------------|---------------|-----------|
| AuthContext.tsx | 180 | 286 | +106 |
| use2FALogin.ts | 118 | 86 | -32 |
| page.tsx (login) | 187 | 175 | -12 |
| **Total** | **485** | **547** | **+62** |

**Observação**: Aumento de linhas se deve à adição de lógica robusta no AuthContext (validações, tratamento de erros). Redução em use2FALogin e page.tsx devido a simplificação.

---

## Compatibilidade e Migração

### Código Legado

Método `login()` original mantido:

```typescript
async function login(email: string, password: string) {
  try {
    const response = await api.post("/auth/login", { email, password });
    const { accessToken, refreshToken, user: userData } = response.data;

    SecureStorage.setToken(accessToken);
    SecureStorage.setRefreshToken(refreshToken);
    api.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;

    setUser(userData);
    router.push("/dashboard");
  } catch (error: any) {
    throw new Error(error.response?.data?.message || "Erro ao fazer login");
  }
}
```

**Status**: Funcional, mas não suporta 2FA. Mantido para compatibilidade.

### Migração de Tokens Antigos

Não há dados a migrar. Tokens em sessionStorage serão ignorados e expirarão naturalmente.

**Ação Necessária**: Usuários autenticados antes da correção precisarão fazer login novamente após deploy.

---

## Segurança

### Melhorias

✅ **Ponto único de armazenamento**: Reduz superfície de ataque
✅ **Consistência**: Tokens sempre no mesmo local
✅ **Centralização**: Facilita auditoria de segurança
✅ **Tratamento de erros**: Mensagens de erro estruturadas

### Considerações Futuras

⚠️ **Base64 não é criptografia**: Considerar AES-GCM ou similar
⚠️ **localStorage acessível via JavaScript**: Avaliar cookies HttpOnly para refresh token
⚠️ **CSRF**: Implementar tokens CSRF se usar cookies
⚠️ **XSS**: Sanitizar inputs e usar Content Security Policy

---

## Testes Unitários (Sugeridos)

### AuthContext

```typescript
describe('AuthContext.loginWithCredentials', () => {
  it('deve salvar tokens em localStorage após login bem-sucedido', async () => {
    // Mock api.post
    // Chamar loginWithCredentials
    // Verificar localStorage.setItem foi chamado
    // Verificar setUser foi chamado
    // Verificar router.push foi chamado
  });

  it('deve retornar requires2FA quando backend retorna erro de 2FA', async () => {
    // Mock api.post para lançar erro com mensagem "2FA"
    // Chamar loginWithCredentials
    // Verificar retorno { success: false, requires2FA: true }
  });

  it('deve retornar erro quando credenciais inválidas', async () => {
    // Mock api.post para lançar erro
    // Verificar retorno { success: false, error: "..." }
  });
});

describe('AuthContext.loginWith2FA', () => {
  it('deve completar login após código 2FA válido', async () => {
    // Similar ao teste de login normal
  });

  it('deve retornar erro quando código 2FA inválido', async () => {
    // Testar resposta de erro
  });
});
```

### use2FALogin

```typescript
describe('use2FALogin', () => {
  it('deve delegar para AuthContext.loginWithCredentials', async () => {
    // Mock AuthContext
    // Chamar attemptLogin
    // Verificar que loginWithCredentials foi chamado
  });

  it('deve atualizar requires2FA quando 2FA necessário', async () => {
    // Mock retorno { requires2FA: true }
    // Verificar estado atualizado
  });
});
```

---

## Monitoramento e Logs

### Eventos a Registrar

Para produção, considerar logging de:

1. **Login bem-sucedido**: `{ userId, timestamp, ip, userAgent }`
2. **Login falhado**: `{ email, reason, ip, timestamp }`
3. **2FA solicitado**: `{ email, timestamp }`
4. **2FA validado**: `{ userId, timestamp }`
5. **Token renovado**: `{ userId, timestamp }`
6. **Logout**: `{ userId, timestamp }`

### Métricas Sugeridas

- Taxa de sucesso de login
- Tempo médio de login
- Falhas de login por usuário
- Uso de 2FA (percentual de usuários)
- Renovações de token

---

## Conclusão Técnica

A correção implementa um padrão de **Single Source of Truth** para autenticação, eliminando inconsistências entre diferentes camadas da aplicação.

**Princípios Aplicados**:
- **Separation of Concerns**: Hook gerencia UI, Context gerencia autenticação
- **DRY**: Lógica de salvamento de tokens em um único lugar
- **Fail-Safe**: Tratamento robusto de erros e casos extremos
- **Backward Compatible**: Código legado continua funcional

**Resultados**:
✅ Login funciona corretamente
✅ Redirecionamento confiável
✅ Tokens persistidos adequadamente
✅ Fluxo 2FA preservado
✅ Zero mudanças no backend
