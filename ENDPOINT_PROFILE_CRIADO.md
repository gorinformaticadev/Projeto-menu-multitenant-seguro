# ✅ Endpoint de Atualização de Perfil Criado

## 🎯 Problema Resolvido

O endpoint `PUT /users/:id` não existia e retornava 404. Criado novo endpoint específico para atualização de perfil.

---

## ✨ O que foi criado

### 1. DTO de Atualização de Perfil
**Arquivo:** `backend/src/users/dto/update-profile.dto.ts`

```typescript
export class UpdateProfileDto {
  @Trim()
  @IsString()
  @IsNotEmpty()
  name: string;

  @Trim()
  @ToLowerCase()
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
```

### 2. Método no Service
**Arquivo:** `backend/src/users/users.service.ts`

```typescript
async updateProfile(userId: string, updateProfileDto: { name: string; email: string }) {
  // Verificar se email já está em uso
  const existingUser = await this.prisma.user.findUnique({
    where: { email },
  });

  if (existingUser && existingUser.id !== userId) {
    throw new ConflictException('Este email já está em uso');
  }

  // Atualizar usuário
  const user = await this.prisma.user.update({
    where: { id: userId },
    data: { name, email },
    include: { tenant: true },
  });

  // Remove senha do retorno
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}
```

### 3. Endpoint no Controller
**Arquivo:** `backend/src/users/users.controller.ts`

```typescript
/**
 * PUT /users/profile
 * Atualizar perfil do usuário logado
 */
@Put('profile')
updateProfile(
  @Body() updateProfileDto: UpdateProfileDto,
  @CurrentUser() user: any,
) {
  return this.usersService.updateProfile(user.id, updateProfileDto);
}
```

### 4. Frontend Atualizado
**Arquivo:** `frontend/src/app/perfil/page.tsx`

```typescript
// Antes (404):
await api.put(`/users/${user?.id}`, { name, email });

// Depois (funciona):
await api.put('/users/profile', { name, email });
```

---

## 🔒 Segurança Implementada

### Validações
- ✅ Email único (não pode usar email de outro usuário)
- ✅ Campos obrigatórios (name e email)
- ✅ Formato de email válido
- ✅ Sanitização automática (@Trim, @ToLowerCase)

### Autenticação
- ✅ Requer autenticação (JwtAuthGuard)
- ✅ Usuário só pode atualizar próprio perfil
- ✅ userId vem do token JWT (@CurrentUser)

### Auditoria
- ✅ Logs automáticos (via AuditInterceptor)
- ✅ Rastreabilidade de mudanças

---

## 📡 API

### Endpoint
```
PUT /users/profile
```

### Headers
```
Authorization: Bearer <token>
Content-Type: application/json
```

### Body
```json
{
  "name": "João Pedro Silva",
  "email": "joao.silva@example.com"
}
```

### Resposta Sucesso (200)
```json
{
  "id": "uuid",
  "name": "João Pedro Silva",
  "email": "joao.silva@example.com",
  "role": "ADMIN",
  "tenantId": "uuid",
  "tenant": {
    "id": "uuid",
    "nomeFantasia": "Empresa Teste"
  },
  "createdAt": "2025-11-18T...",
  "updatedAt": "2025-11-18T..."
}
```

### Resposta Erro - Email em Uso (409)
```json
{
  "statusCode": 409,
  "message": "Este email já está em uso",
  "error": "Conflict"
}
```

### Resposta Erro - Validação (400)
```json
{
  "statusCode": 400,
  "message": [
    "name should not be empty",
    "email must be an email"
  ],
  "error": "Bad Request"
}
```

---

## 🧪 Como Testar

### Teste 1: Atualizar Nome

```bash
# Fazer login e pegar token
TOKEN="seu-token-aqui"

# Atualizar nome
curl -X PUT http://localhost:4000/users/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Pedro Silva",
    "email": "joao@example.com"
  }'
```

**Resultado esperado:**
- ✅ Status 200
- ✅ Dados atualizados retornados
- ✅ Sem senha no retorno

### Teste 2: Atualizar Email

```bash
curl -X PUT http://localhost:4000/users/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao.novo@example.com"
  }'
```

**Resultado esperado:**
- ✅ Status 200
- ✅ Email atualizado

### Teste 3: Email Duplicado

```bash
# Tentar usar email de outro usuário
curl -X PUT http://localhost:4000/users/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "admin@system.com"
  }'
```

**Resultado esperado:**
- ✅ Status 409
- ✅ Mensagem "Este email já está em uso"

### Teste 4: Validação

```bash
# Enviar dados inválidos
curl -X PUT http://localhost:4000/users/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "",
    "email": "email-invalido"
  }'
```

**Resultado esperado:**
- ✅ Status 400
- ✅ Mensagens de validação

### Teste 5: Sem Autenticação

```bash
# Tentar sem token
curl -X PUT http://localhost:4000/users/profile \
  -H "Content-Type: application/json" \
  -d '{
    "name": "João Silva",
    "email": "joao@example.com"
  }'
```

**Resultado esperado:**
- ✅ Status 401
- ✅ Mensagem "Unauthorized"

---

## 📁 Arquivos Criados/Modificados

### Backend - Novos
- ✅ `backend/src/users/dto/update-profile.dto.ts`

### Backend - Modificados
- ✅ `backend/src/users/users.service.ts`
- ✅ `backend/src/users/users.controller.ts`

### Frontend - Modificados
- ✅ `frontend/src/app/perfil/page.tsx`

---

## 🔄 Diferença dos Endpoints

### PUT /users/:id (Existente)
- **Acesso:** SUPER_ADMIN, ADMIN
- **Uso:** Admin atualizar qualquer usuário
- **DTO:** UpdateUserDto (pode alterar role, tenantId, etc)

### PUT /users/profile (Novo)
- **Acesso:** Qualquer usuário autenticado
- **Uso:** Usuário atualizar próprio perfil
- **DTO:** UpdateProfileDto (apenas name e email)

---

## ✅ Checklist de Validação

### Backend
- [x] DTO criado
- [x] Método no service criado
- [x] Endpoint no controller criado
- [x] Validações implementadas
- [x] Sem erros de diagnóstico

### Frontend
- [x] Endpoint atualizado
- [x] Sem erros de diagnóstico

### Testes
- [ ] Atualizar nome funciona
- [ ] Atualizar email funciona
- [ ] Email duplicado é rejeitado
- [ ] Validação funciona
- [ ] Sem autenticação é rejeitado
- [ ] Dados aparecem atualizados no frontend

---

## 🚀 Próximo Passo

**REINICIAR O BACKEND:**

```bash
# Parar (Ctrl+C) e reiniciar
cd backend
npm run start:dev
```

Depois testar a edição de perfil no frontend!

---

**Status:** ✅ ENDPOINT CRIADO  
**Método:** PUT /users/profile  
**Acesso:** Usuário autenticado  
**Pronto para:** Teste

