# ✅ Implementação de Configurações de Login e Inatividade

## 📋 O Que Foi Implementado

### 1. ✅ Configuração de Tentativas de Login

**Antes:** Valores hardcoded no código (5 tentativas, 30 minutos de bloqueio)

**Agora:** Configurável pelo SUPER_ADMIN na tela de Configurações de Segurança

**Campos Adicionados:**
- `loginMaxAttempts` - Número máximo de tentativas antes de bloquear (1-100)
- `loginLockDurationMinutes` - Duração do bloqueio em minutos (5-1440 / até 24h)

**Comportamento:**
- Usuário recebe feedback sobre tentativas restantes
- Mensagem especial quando resta apenas 1 tentativa
- Bloqueio automático após atingir o limite
- Mensagem informa quanto tempo falta para desbloquear
- Admin pode desbloquear manualmente

---

### 2. ✅ Configuração de Logout por Inatividade

**Novo Campo:**
- `sessionTimeoutMinutes` - Tempo de inatividade antes de logout automático (5-1440 minutos / até 24h)

**Comportamento:**
- Sistema monitora atividade do usuário (mouse, teclado, scroll, touch)
- Aviso 1 minuto antes do logout
- Logout automático após o tempo configurado
- Timer é resetado a cada interação do usuário

---

## 📁 Arquivos Modificados

### Backend

1. **`backend/prisma/schema.prisma`**
   - Adicionado `loginLockDurationMinutes` (duração do bloqueio)
   - Renomeado `sessionTimeout` para `sessionTimeoutMinutes` (clareza)

2. **`backend/src/auth/auth.service.ts`**
   - Busca configurações do banco ao invés de usar valores hardcoded
   - Usa `loginMaxAttempts` e `loginLockDurationMinutes` dinâmicos
   - Mensagens de erro incluem tempo de bloqueio configurado

3. **`backend/src/security-config/dto/update-security-config.dto.ts`**
   - Adicionado validação para `loginLockDurationMinutes` (5-1440 minutos)
   - Atualizado validação de `sessionTimeoutMinutes` (5-1440 minutos)

### Frontend

4. **`frontend/src/app/configuracoes/seguranca/page.tsx`**
   - Adicionado campo "Duração do Bloqueio" na seção de Login
   - Reorganizado seções para melhor clareza:
     - "Controle de Tentativas de Login" (nova seção dedicada)
     - "Rate Limiting Global" (separado)
   - Atualizado campo de timeout de sessão com descrição melhorada

5. **`frontend/src/hooks/useInactivityLogout.ts`** (NOVO)
   - Hook customizado para monitorar inatividade
   - Detecta eventos: mousedown, mousemove, keypress, scroll, touchstart, click
   - Avisa 1 minuto antes do logout
   - Executa logout automático

6. **`frontend/src/components/InactivityLogout.tsx`** (NOVO)
   - Componente que busca configuração do backend
   - Aplica o hook de inatividade com timeout configurado
   - Não renderiza nada (componente lógico)

7. **`frontend/src/app/layout.tsx`**
   - Adicionado `<InactivityLogout />` no layout principal
   - Ativo em todas as páginas quando usuário está logado

---

## 🗄️ Migration do Banco de Dados

**Migration Criada:**
```
20251119114214_add_login_lock_duration_and_session_timeout
```

**Campos Adicionados:**
- `loginLockDurationMinutes` INT DEFAULT 30
- `sessionTimeoutMinutes` INT DEFAULT 30 (renomeado de sessionTimeout)

**Status:** ✅ Migration aplicada com sucesso

---

## 🚨 Próximos Passos (IMPORTANTE)

### 1. Regenerar Prisma Client

O backend precisa ser **parado e reiniciado** para que o Prisma Client seja regenerado com os novos campos.

**Passos:**

```bash
# 1. Parar o backend (Ctrl+C no terminal)

# 2. Regenerar Prisma Client
cd backend
npx prisma generate

# 3. Reiniciar o backend
npm run start:dev
```

### 2. Testar Configurações

**Teste 1: Configurar Tentativas de Login**
1. Login como SUPER_ADMIN
2. Ir em "Configurações" → "Segurança"
3. Alterar "Máximo de Tentativas de Login" para 3
4. Alterar "Duração do Bloqueio" para 5 minutos
5. Salvar

**Teste 2: Testar Bloqueio**
1. Fazer logout
2. Tentar login com senha errada 3 vezes
3. Verificar mensagens:
   - 1ª tentativa: "Credenciais inválidas. Você tem 2 tentativas restantes."
   - 2ª tentativa: "Credenciais inválidas. ATENÇÃO: Você tem apenas 1 tentativa restante antes de sua conta ser bloqueada por 5 minutos."
   - 3ª tentativa: "Conta bloqueada por múltiplas tentativas de login. Tente novamente em 5 minutos ou contate um administrador."

**Teste 3: Configurar Logout por Inatividade**
1. Login como SUPER_ADMIN
2. Ir em "Configurações" → "Segurança"
3. Alterar "Logout por Inatividade" para 2 minutos (para teste rápido)
4. Salvar
5. Recarregar a página (para aplicar nova configuração)
6. Ficar inativo por 1 minuto → deve aparecer aviso
7. Ficar inativo por mais 1 minuto → deve fazer logout automático

**Teste 4: Verificar Reset de Timer**
1. Configurar timeout para 2 minutos
2. Ficar inativo por 1 minuto
3. Mover o mouse ou pressionar uma tecla
4. Timer deve resetar e não fazer logout

---

## 🎯 Funcionalidades Implementadas

### ✅ Configuração de Tentativas de Login
- [x] Campo configurável no banco de dados
- [x] Interface na tela de configurações (SUPER_ADMIN)
- [x] Validação (1-100 tentativas)
- [x] Uso dinâmico no auth.service
- [x] Mensagens de feedback ao usuário
- [x] Logs de auditoria

### ✅ Configuração de Duração de Bloqueio
- [x] Campo configurável no banco de dados
- [x] Interface na tela de configurações (SUPER_ADMIN)
- [x] Validação (5-1440 minutos / até 24h)
- [x] Uso dinâmico no auth.service
- [x] Mensagens incluem tempo de bloqueio
- [x] Logs de auditoria

### ✅ Configuração de Logout por Inatividade
- [x] Campo configurável no banco de dados
- [x] Interface na tela de configurações (SUPER_ADMIN)
- [x] Validação (5-1440 minutos / até 24h)
- [x] Hook customizado de monitoramento
- [x] Componente de aplicação global
- [x] Aviso 1 minuto antes do logout
- [x] Reset de timer em qualquer interação
- [x] Toast de notificação

---

## 📊 Valores Padrão

| Configuração | Valor Padrão | Mínimo | Máximo |
|--------------|--------------|--------|--------|
| Tentativas de Login | 5 | 1 | 100 |
| Duração do Bloqueio | 30 min | 5 min | 1440 min (24h) |
| Logout por Inatividade | 30 min | 5 min | 1440 min (24h) |

---

## 🔒 Segurança

**Acesso às Configurações:**
- ✅ Apenas SUPER_ADMIN pode acessar
- ✅ Validação no backend (guard)
- ✅ Validação no frontend (redirect)
- ✅ Logs de auditoria em todas as alterações

**Proteção contra Ataques:**
- ✅ Bloqueio automático após tentativas falhas
- ✅ Tempo de bloqueio configurável
- ✅ Logout automático por inatividade
- ✅ Mensagens não revelam se email existe
- ✅ Logs de todas as tentativas de login

---

## 💡 Observações

1. **Logout por Inatividade:**
   - Funciona apenas quando usuário está logado
   - Monitora eventos do navegador (não detecta inatividade em outras abas)
   - Timer é resetado em qualquer interação

2. **Bloqueio de Conta:**
   - Bloqueio é por tempo (não permanente)
   - Admin pode desbloquear manualmente
   - Após expirar, usuário pode tentar novamente

3. **Configurações Globais:**
   - Afetam todos os usuários do sistema
   - Mudanças são aplicadas imediatamente (exceto logout por inatividade que precisa recarregar)
   - Valores são validados no backend

---

## 🐛 Troubleshooting

### Erro ao regenerar Prisma Client
**Problema:** `EPERM: operation not permitted`

**Solução:**
1. Parar o backend (Ctrl+C)
2. Aguardar 5 segundos
3. Executar `npx prisma generate`
4. Reiniciar backend

### Logout por inatividade não funciona
**Possíveis causas:**
1. Configuração não foi salva
2. Página não foi recarregada após salvar
3. Usuário não está logado
4. Erro ao buscar configuração do backend

**Solução:**
1. Verificar se configuração foi salva
2. Recarregar página (Ctrl+Shift+R)
3. Verificar console do navegador (F12)
4. Verificar se backend está rodando

### Mensagens de bloqueio não aparecem
**Possíveis causas:**
1. Backend não foi reiniciado após migration
2. Prisma Client não foi regenerado

**Solução:**
1. Parar backend
2. Executar `npx prisma generate`
3. Reiniciar backend
4. Testar novamente

---

**✅ Implementação completa! Basta reiniciar o backend e testar.**
