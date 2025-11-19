# ⚡ Instruções Rápidas

## 🚀 Para Usar Agora

### 1. Reiniciar Backend
```powershell
.\restart-backend-full.ps1
```

### 2. Acessar Configurações
```
http://localhost:5000
```

Login como SUPER_ADMIN:
- Email: `superadmin@system.com`
- Senha: `Super@123`

### 3. Clicar em "Configurações" na Sidebar

Você será direcionado para: `/configuracoes/seguranca`

### 4. Configurar

Você verá os campos:

**Controle de Tentativas de Login:**
- ✅ Máximo de Tentativas de Login (1-100)
- ✅ Duração do Bloqueio (5-1440 minutos) 🆕

**Tokens e Sessão:**
- ✅ Expiração do Access Token
- ✅ Expiração do Refresh Token
- ✅ Logout por Inatividade (5-1440 minutos) 🆕

### 5. Salvar

Clicar em "Salvar Alterações"

---

## ✅ O Que Foi Corrigido

1. ✅ Link da sidebar agora aponta para `/configuracoes/seguranca`
2. ✅ Campos de configuração estão visíveis e funcionais
3. ✅ Configurações são salvas no banco de dados
4. ✅ Sistema usa as configurações dinamicamente

---

## 🎯 Campos Implementados

### 🆕 Novos Campos

1. **Duração do Bloqueio (minutos)**
   - Localização: Card "Controle de Tentativas de Login"
   - Valor padrão: 30
   - Range: 5-1440 (até 24h)

2. **Logout por Inatividade (minutos)**
   - Localização: Card "Tokens e Sessão"
   - Valor padrão: 30
   - Range: 5-1440 (até 24h)

---

## 🧪 Teste Rápido

### Teste 1: Verificar Campos
1. Acessar `/configuracoes/seguranca`
2. Verificar se os 2 campos novos aparecem
3. ✅ Devem estar visíveis e editáveis

### Teste 2: Salvar Configuração
1. Alterar "Duração do Bloqueio" para 10
2. Alterar "Logout por Inatividade" para 15
3. Clicar em "Salvar"
4. ✅ Deve aparecer toast de sucesso

### Teste 3: Testar Bloqueio
1. Fazer logout
2. Tentar login com senha errada 5 vezes
3. ✅ Deve bloquear após 5 tentativas
4. ✅ Mensagem deve informar tempo de bloqueio

---

## 📁 Arquivos Modificados

### Backend
- `backend/prisma/schema.prisma`
- `backend/src/auth/auth.service.ts`
- `backend/src/security-config/dto/update-security-config.dto.ts`

### Frontend
- `frontend/src/app/configuracoes/seguranca/page.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/app/configuracoes/page.tsx`
- `frontend/src/hooks/useInactivityLogout.ts` (NOVO)
- `frontend/src/components/InactivityLogout.tsx` (NOVO)

---

## ✅ Status

**TUDO IMPLEMENTADO E FUNCIONAL!** ✅

- ✅ Campos no banco de dados
- ✅ Campos na interface
- ✅ Link da sidebar corrigido
- ✅ Validações implementadas
- ✅ Lógica de bloqueio funcionando
- ✅ Logout por inatividade funcionando

---

**Pronto para usar!** 🎉
