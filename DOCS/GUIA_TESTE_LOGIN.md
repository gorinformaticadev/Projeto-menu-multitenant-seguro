# Guia de Teste - Correção do Login

## Pré-requisitos

✅ Backend rodando em http://localhost:4000
✅ Frontend rodando em http://localhost:5000

Se os serviços não estiverem rodando:
```powershell
# Terminal 1 - Backend
cd backend
npm run start:dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## Teste 1: Login Básico SUPER_ADMIN

### Objetivo
Validar que o login funciona e redireciona para o dashboard.

### Passos
1. Abra o navegador em: http://localhost:5000/login
2. Verifique que a página de login carrega corretamente
3. Preencha os campos:
   - **Email**: `admin@system.com`
   - **Senha**: `admin123`
4. Clique no botão **"Entrar"**

### Resultado Esperado
✅ Loading é exibido por alguns segundos
✅ Redirecionamento automático para http://localhost:5000/dashboard
✅ Dashboard carrega mostrando:
   - Nome do usuário: "Super Admin"
   - Role: "SUPER_ADMIN"
   - Menu lateral visível
   - Opções de administração disponíveis

### O que NÃO deve acontecer
❌ Permanecer na página de login após clicar em "Entrar"
❌ Toast de erro aparecendo
❌ Redirecionamento em loop (login → dashboard → login)
❌ Página em branco ou erro 404

---

## Teste 2: Login como ADMIN

### Passos
1. Se estiver autenticado, faça logout (canto superior direito)
2. Na página de login, preencha:
   - **Email**: `admin@empresa1.com`
   - **Senha**: `admin123`
3. Clique em **"Entrar"**

### Resultado Esperado
✅ Redirecionamento para dashboard
✅ Dados do usuário:
   - Nome: "Admin da Empresa"
   - Role: "ADMIN"
✅ Menu com opções de gestão de empresa

---

## Teste 3: Login como USER

### Passos
1. Faça logout se necessário
2. Na página de login, preencha:
   - **Email**: `user@empresa1.com`
   - **Senha**: `user123`
3. Clique em **"Entrar"**

### Resultado Esperado
✅ Redirecionamento para dashboard
✅ Dados do usuário:
   - Nome: "Usuário Comum"
   - Role: "USER"
✅ Menu com opções limitadas (sem acesso administrativo)

---

## Teste 4: Persistência de Sessão

### Objetivo
Validar que o usuário permanece autenticado após recarregar a página.

### Passos
1. Faça login com qualquer credencial
2. Aguarde carregar o dashboard
3. Pressione **F5** ou **Ctrl+R** para recarregar
4. Aguarde página carregar

### Resultado Esperado
✅ Dashboard recarrega normalmente
✅ Usuário permanece autenticado
✅ Dados do usuário são mantidos
✅ Não há redirecionamento para /login

### Validação Técnica (DevTools)
1. Abra DevTools (F12)
2. Vá em **Application** → **Local Storage** → http://localhost:5000
3. Verifique existência de:
   - `@App:token` (valor em Base64)
   - `@App:refreshToken` (valor em Base64)

---

## Teste 5: Credenciais Inválidas

### Objetivo
Validar tratamento de erros de login.

### Passos
1. Faça logout se necessário
2. Na página de login, preencha:
   - **Email**: `invalido@test.com`
   - **Senha**: `senhaerrada`
3. Clique em **"Entrar"**

### Resultado Esperado
✅ Toast de erro aparece com mensagem: "Credenciais inválidas"
✅ Usuário permanece na página de login
✅ Campos de entrada permanecem editáveis
✅ Nenhum token é salvo no localStorage

---

## Teste 6: Logout e Limpeza

### Objetivo
Validar que logout remove tokens corretamente.

### Passos
1. Faça login com qualquer credencial
2. No dashboard, clique no menu do usuário (canto superior direito)
3. Clique em **"Sair"**

### Resultado Esperado
✅ Redirecionamento imediato para /login
✅ Tokens removidos do localStorage
✅ Tentar acessar /dashboard redireciona para /login

### Validação Técnica (DevTools)
1. Abra DevTools → Application → Local Storage
2. Verifique que NÃO existem:
   - `@App:token`
   - `@App:refreshToken`

---

## Teste 7: Proteção de Rotas

### Objetivo
Validar que rotas protegidas redirecionam para login.

### Passos
1. Certifique-se de estar deslogado
2. Tente acessar diretamente: http://localhost:5000/dashboard

### Resultado Esperado
✅ Redirecionamento automático para /login
✅ Não consegue acessar dashboard sem autenticação

### Outros URLs para testar
- http://localhost:5000/usuarios
- http://localhost:5000/empresas
- http://localhost:5000/logs
- http://localhost:5000/configuracoes

Todos devem redirecionar para /login se não autenticado.

---

## Teste 8: Campos Vazios

### Objetivo
Validar validação de formulário.

### Passos
1. Na página de login, deixe os campos vazios
2. Clique em **"Entrar"**

### Resultado Esperado
✅ Toast de erro: "Preencha todos os campos"
✅ Nenhuma requisição ao backend
✅ Usuário permanece na página de login

---

## Teste 9: Login com 2FA (Se Disponível)

### Pré-requisito
Usuário com 2FA ativado.

### Passos
1. Faça login com credenciais de usuário com 2FA
2. Aguarde tela de código 2FA aparecer
3. Abra aplicativo autenticador (Google Authenticator, Authy, etc.)
4. Insira código de 6 dígitos
5. Clique em **"Verificar"**

### Resultado Esperado
✅ Tela de código 2FA é exibida após primeira tentativa
✅ Código válido completa o login
✅ Redirecionamento para dashboard
✅ Tokens salvos corretamente

### Código Inválido
- Digite código errado
- Verifique toast de erro: "Código inválido"
- Possibilidade de tentar novamente

---

## Teste 10: Inspeção do Console

### Durante Todos os Testes

Abra DevTools (F12) → **Console** e verifique:

✅ **Não deve haver**:
- Erros de JavaScript (texto vermelho)
- Warnings de React sobre atualizações de estado
- Erros de CORS
- Erros 401/403 após login bem-sucedido
- Erros de "Cannot read property of undefined"

✅ **Pode haver** (normal):
- Logs informativos do sistema
- Avisos de desenvolvimento do Next.js
- Mensagens de conexão WebSocket (se aplicável)

---

## Checklist Final

Após realizar todos os testes:

- [ ] Login com SUPER_ADMIN funciona
- [ ] Login com ADMIN funciona
- [ ] Login com USER funciona
- [ ] Redirecionamento para dashboard após login
- [ ] Dashboard carrega dados do usuário
- [ ] Persistência após F5 funciona
- [ ] Logout limpa tokens
- [ ] Rotas protegidas redirecionam para login
- [ ] Credenciais inválidas mostram erro apropriado
- [ ] Validação de campos vazios funciona
- [ ] Console sem erros críticos
- [ ] Tokens visíveis em localStorage
- [ ] Login com 2FA funciona (se disponível)

---

## Resolução de Problemas

### Problema: Fica na página de login após clicar "Entrar"

**Possíveis causas**:
1. Backend não está rodando (porta 4000)
2. Frontend não está rodando (porta 5000)
3. CORS bloqueando requisições

**Solução**:
```powershell
# Verificar se backend está rodando
curl http://localhost:4000

# Verificar logs do backend
# Procurar por requisição POST /auth/login

# Verificar console do navegador
# Procurar por erros de rede ou CORS
```

### Problema: Erro 401 ou 403 após login

**Causa**: Tokens não estão sendo salvos/lidos corretamente

**Solução**:
1. Abra DevTools → Application → Local Storage
2. Limpe todo o storage
3. Tente login novamente
4. Verifique se tokens aparecem após login

### Problema: Redirecionamento em loop

**Causa**: AuthContext não está reconhecendo estado do usuário

**Solução**:
1. Limpe localStorage
2. Feche todas as abas do navegador
3. Abra nova janela anônima
4. Tente login novamente

### Problema: Dashboard mostra dados errados

**Causa**: Cache ou tokens de sessão anterior

**Solução**:
1. Faça logout completo
2. Limpe localStorage e sessionStorage
3. Faça login novamente
4. Verifique endpoint /auth/me:
   ```powershell
   # PowerShell
   $token = "SEU_TOKEN_AQUI"
   $headers = @{ Authorization = "Bearer $token" }
   Invoke-RestMethod -Uri http://localhost:4000/auth/me -Headers $headers
   ```

---

## Testes Avançados (Opcional)

### Token Expirado (15 minutos)

1. Faça login
2. Aguarde 15 minutos (ou ajuste JWT_ACCESS_EXPIRES_IN para 1m para teste rápido)
3. Faça qualquer ação no dashboard
4. Verifique renovação automática do token

**Resultado Esperado**:
- Requisição inicial retorna 401
- API Client automaticamente renova token
- Requisição é retentada com novo token
- Usuário não percebe interrupção

### Múltiplas Abas

1. Abra dashboard em 2 abas
2. Faça logout em uma aba
3. Tente navegar na outra aba

**Comportamento Atual**:
- Cada aba gerencia seu próprio estado
- Logout em uma aba não afeta outra imediatamente
- Ao tentar requisição na segunda aba, erro de autenticação ocorre

**Melhoria Futura**: Sincronização entre abas via StorageEvent

---

## Relatório de Teste

Após completar os testes, documente:

| Teste | Status | Observações |
|-------|--------|-------------|
| Login SUPER_ADMIN | ✅/❌ | |
| Login ADMIN | ✅/❌ | |
| Login USER | ✅/❌ | |
| Persistência F5 | ✅/❌ | |
| Logout | ✅/❌ | |
| Proteção de rotas | ✅/❌ | |
| Credenciais inválidas | ✅/❌ | |
| Validação de campos | ✅/❌ | |
| Console sem erros | ✅/❌ | |
| Login 2FA | ✅/❌/N/A | |

**Conclusão**:
[Descreva se a correção funcionou conforme esperado]

**Problemas encontrados**:
[Liste qualquer problema ou comportamento inesperado]
