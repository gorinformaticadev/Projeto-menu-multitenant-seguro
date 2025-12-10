# Guia de Verificação de Email

## 📧 Visão Geral

Sistema completo de verificação de email implementado com:
- ✅ Envio de emails com templates HTML profissionais
- ✅ Tokens JWT com expiração de 24 horas
- ✅ 3 níveis de restrição (SOFT, MODERATE, STRICT)
- ✅ Integração com audit logs
- ✅ Rate limiting (3 envios por hora por usuário)

## 🚀 Instalação e Configuração

### Passo 1: Aplicar Migração do Banco

```powershell
# IMPORTANTE: Parar o backend primeiro
cd backend

# Aplicar migração
npx prisma migrate dev

# Regenerar Prisma Client
npx prisma generate
```

### Passo 2: Instalar Dependências

```powershell
cd backend
npm install nodemailer @types/nodemailer
```

### Passo 3: Configurar SMTP

Editar `backend/.env` e adicionar credenciais SMTP:

```bash
# Exemplo: Gmail
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="seu-email@gmail.com"
SMTP_PASS="sua-senha-de-app"
EMAIL_FROM="noreply@seudominio.com"
EMAIL_FROM_NAME="Sistema Multitenant"
```

#### Como obter senha de app do Gmail:
1. Acessar: https://myaccount.google.com/apppasswords
2. Selecionar "App" → "Outro"
3. Digitar "Sistema Multitenant"
4. Copiar senha gerada (16 caracteres sem espaços)

### Passo 4: Configurar SecurityConfig (Opcional)

```sql
-- Habilitar verificação de email (opcional)
UPDATE security_config 
SET 
  email_verification_required = true,
  email_verification_level = 'SOFT';
```

**Níveis disponíveis**:
- `SOFT`: Apenas aviso, acesso completo
- `MODERATE`: Funcionalidades limitadas
- `STRICT`: Bloqueio total até verificação

## 📡 Endpoints API

### 1. Enviar Email de Verificação

```http
POST /auth/email/send-verification
Authorization: Bearer {accessToken}
```

**Rate Limit**: 3 requisições por hora

**Resposta** (200):
```json
{
  "message": "Email de verificação enviado com sucesso"
}
```

**Erros**:
- `400`: Email já verificado
- `401`: Token JWT inválido
- `429`: Rate limit excedido (3/hora)

### 2. Verificar Email com Token

```http
POST /auth/email/verify
Content-Type: application/json

{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Rate Limit**: 10 requisições por minuto

**Resposta** (200):
```json
{
  "message": "Email verificado com sucesso!"
}
```

**Erros**:
- `400`: Token inválido ou expirado
- `400`: Email já verificado
- `429`: Rate limit excedido

### 3. Verificar Status de Verificação

```http
GET /auth/email/status
Authorization: Bearer {accessToken}
```

**Resposta** (200):
```json
{
  "verified": false,
  "required": true,
  "level": "SOFT",
  "shouldBlock": false,
  "message": "Por favor, verifique seu email. Um link de verificação foi enviado."
}
```

## 🧪 Testando a Funcionalidade

### Teste 1: Envio de Email

```powershell
# 1. Login
$login = Invoke-RestMethod -Uri "http://localhost:4000/auth/login" -Method POST -Body (@{
    email = "admin@system.com"
    password = "Admin@123456"
} | ConvertTo-Json) -ContentType "application/json"

$token = $login.accessToken

# 2. Solicitar verificação
Invoke-RestMethod -Uri "http://localhost:4000/auth/email/send-verification" -Method POST `
    -Headers @{ Authorization = "Bearer $token" }
```

**Resultado esperado**:
- Retorno: `{ "message": "Email de verificação enviado com sucesso" }`
- Email recebido com link de verificação

### Teste 2: Verificação com Token

```powershell
# Extrair token do email recebido
$verificationToken = "TOKEN_DO_EMAIL"

# Verificar email
Invoke-RestMethod -Uri "http://localhost:4000/auth/email/verify" -Method POST `
    -Body (@{ token = $verificationToken } | ConvertTo-Json) `
    -ContentType "application/json"
```

**Resultado esperado**:
- Retorno: `{ "message": "Email verificado com sucesso!" }`
- Campo `emailVerified` no banco = `true`

### Teste 3: Status de Verificação

```powershell
Invoke-RestMethod -Uri "http://localhost:4000/auth/email/status" -Method GET `
    -Headers @{ Authorization = "Bearer $token" }
```

**Resultado esperado**:
```json
{
  "verified": true,
  "required": false,
  "level": "SOFT",
  "shouldBlock": false
}
```

## 🔧 Configurações Avançadas

### Personalizar Templates de Email

Editar `backend/src/email/email.service.ts`:

```typescript
private getVerificationEmailTemplate(name: string, verificationUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <!-- Personalizar HTML aqui -->
    </html>
  `;
}
```

### Alterar Tempo de Expiração do Token

Editar `backend/src/auth/email-verification.service.ts` (linha 28):

```typescript
// Padrão: 24 horas
const verificationToken = this.jwtService.sign(
  { userId: user.id, email: user.email, type: 'email_verification' },
  { expiresIn: '48h' } // Alterar aqui
);
```

### Configurar Nível de Restrição por Tenant

```typescript
// Futuro: Permitir configuração por tenant
const tenantConfig = await this.prisma.tenant.findUnique({
  where: { id: user.tenantId },
  include: { securityConfig: true }
});

const level = tenantConfig?.securityConfig?.emailVerificationLevel || 'SOFT';
```

## 📊 Monitoramento

### Verificar Logs de Auditoria

```sql
-- Emails de verificação enviados
SELECT * FROM audit_logs 
WHERE action = 'EMAIL_VERIFICATION_SENT'
ORDER BY created_at DESC
LIMIT 10;

-- Emails verificados com sucesso
SELECT * FROM audit_logs 
WHERE action = 'EMAIL_VERIFIED'
ORDER BY created_at DESC
LIMIT 10;
```

### Listar Usuários Não Verificados

```sql
SELECT id, name, email, created_at
FROM users
WHERE email_verified = false
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

### Taxa de Verificação

```sql
-- Percentual de usuários verificados
SELECT 
  COUNT(*) FILTER (WHERE email_verified = true) * 100.0 / COUNT(*) as verification_rate
FROM users;
```

## 🚨 Troubleshooting

### Problema: Email não está sendo enviado

**Verificações**:
1. SMTP configurado corretamente no `.env`
2. Credenciais SMTP válidas
3. Porta SMTP liberada no firewall (587 ou 465)
4. Logs do backend: `ERROR Email service desabilitado`

**Solução**:
```powershell
# Testar conexão SMTP manualmente
telnet smtp.gmail.com 587
```

### Problema: Token expirado

**Causa**: Token tem validade de 24 horas

**Solução**:
- Solicitar novo email de verificação via `POST /auth/email/send-verification`

### Problema: Rate limit excedido

**Causa**: 3 envios por hora por usuário

**Solução**:
- Aguardar 1 hora
- OU ajustar rate limit em `auth.controller.ts` (linha 128):
  ```typescript
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5/hora
  ```

## 📱 Integração com Frontend

### Exemplo: Página de Verificação

```typescript
// app/verify-email/page.tsx
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (token) {
      api.post('/auth/email/verify', { token })
        .then(() => setStatus('success'))
        .catch(() => setStatus('error'));
    }
  }, [token]);

  return (
    <div>
      {status === 'loading' && <p>Verificando email...</p>}
      {status === 'success' && <p>✅ Email verificado com sucesso!</p>}
      {status === 'error' && <p>❌ Token inválido ou expirado</p>}
    </div>
  );
}
```

### Exemplo: Componente de Aviso

```typescript
// components/EmailVerificationBanner.tsx
'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';

export default function EmailVerificationBanner() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.get('/auth/email/status')
      .then(res => setStatus(res.data))
      .catch(console.error);
  }, []);

  if (!status || status.verified) return null;

  return (
    <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4">
      <p className="text-yellow-700">
        ⚠️ {status.message}
        <button onClick={sendVerification} className="ml-4 underline">
          Reenviar email
        </button>
      </p>
    </div>
  );

  function sendVerification() {
    api.post('/auth/email/send-verification')
      .then(() => alert('Email enviado!'))
      .catch(console.error);
  }
}
```

## 📋 Checklist de Implementação

- [x] Migração do banco aplicada
- [x] Dependências instaladas (nodemailer)
- [x] SMTP configurado no .env
- [x] Endpoints testados (send, verify, status)
- [ ] Template de email personalizado (opcional)
- [ ] Página de verificação no frontend
- [ ] Banner de aviso no dashboard
- [ ] Monitoramento de taxa de verificação
- [ ] Documentação para usuários finais

## 🔗 Referências

- **Nodemailer**: https://nodemailer.com/
- **Gmail App Passwords**: https://support.google.com/accounts/answer/185833
- **JWT Best Practices**: https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html

---

**Última atualização**: 10/12/2024
