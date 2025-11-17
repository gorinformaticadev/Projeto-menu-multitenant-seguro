# 📡 Exemplos de Requisições da API

Este documento contém exemplos de requisições HTTP para testar a API do backend.

## 🔐 Autenticação

### Login

```http
POST http://localhost:4000/auth/login
Content-Type: application/json

{
  "email": "admin@system.com",
  "password": "admin123"
}
```

**Resposta de Sucesso (200)**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-do-usuario",
    "email": "admin@system.com",
    "name": "Super Admin",
    "role": "SUPER_ADMIN",
    "tenantId": null,
    "tenant": null
  }
}
```

**Resposta de Erro (401)**:
```json
{
  "statusCode": 401,
  "message": "Credenciais inválidas",
  "error": "Unauthorized"
}
```

## 🏢 Tenants (Empresas)

### Listar Todas as Empresas

**Requer**: SUPER_ADMIN

```http
GET http://localhost:4000/tenants
Authorization: Bearer SEU_TOKEN_JWT_AQUI
```

**Resposta de Sucesso (200)**:
```json
[
  {
    "id": "uuid-do-tenant",
    "email": "empresa1@example.com",
    "cnpjCpf": "12345678901234",
    "nomeFantasia": "Empresa Exemplo LTDA",
    "nomeResponsavel": "João Silva",
    "telefone": "(11) 98765-4321",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "_count": {
      "users": 2
    }
  }
]
```

**Resposta de Erro (403)** - Usuário sem permissão:
```json
{
  "statusCode": 403,
  "message": "Você não tem permissão para acessar este recurso",
  "error": "Forbidden"
}
```

**Resposta de Erro (401)** - Token inválido:
```json
{
  "statusCode": 401,
  "message": "Token inválido ou expirado",
  "error": "Unauthorized"
}
```

### Criar Nova Empresa

**Requer**: SUPER_ADMIN

```http
POST http://localhost:4000/tenants
Authorization: Bearer SEU_TOKEN_JWT_AQUI
Content-Type: application/json

{
  "email": "novaemp@example.com",
  "cnpjCpf": "98765432109876",
  "nomeFantasia": "Nova Empresa LTDA",
  "nomeResponsavel": "Maria Santos",
  "telefone": "(21) 91234-5678"
}
```

**Resposta de Sucesso (201)**:
```json
{
  "id": "uuid-do-novo-tenant",
  "email": "novaemp@example.com",
  "cnpjCpf": "98765432109876",
  "nomeFantasia": "Nova Empresa LTDA",
  "nomeResponsavel": "Maria Santos",
  "telefone": "(21) 91234-5678",
  "createdAt": "2024-01-15T11:00:00.000Z",
  "updatedAt": "2024-01-15T11:00:00.000Z"
}
```

**Resposta de Erro (400)** - Validação falhou:
```json
{
  "statusCode": 400,
  "message": [
    "Email inválido",
    "CNPJ/CPF deve ter no mínimo 11 caracteres"
  ],
  "error": "Bad Request"
}
```

**Resposta de Erro (409)** - Empresa já existe:
```json
{
  "statusCode": 409,
  "message": "Já existe uma empresa com este email ou CNPJ/CPF",
  "error": "Conflict"
}
```

## 🧪 Testando com cURL

### Login

```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@system.com",
    "password": "admin123"
  }'
```

### Listar Empresas

```bash
# Substitua SEU_TOKEN pelo token recebido no login
curl -X GET http://localhost:4000/tenants \
  -H "Authorization: Bearer SEU_TOKEN"
```

### Criar Empresa

```bash
# Substitua SEU_TOKEN pelo token recebido no login
curl -X POST http://localhost:4000/tenants \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "novaemp@example.com",
    "cnpjCpf": "98765432109876",
    "nomeFantasia": "Nova Empresa LTDA",
    "nomeResponsavel": "Maria Santos",
    "telefone": "(21) 91234-5678"
  }'
```

## 🧪 Testando com Postman

### 1. Criar Collection

1. Abra o Postman
2. Crie uma nova Collection chamada "Sistema Multitenant"
3. Adicione uma variável `baseUrl` com valor `http://localhost:4000`
4. Adicione uma variável `token` (será preenchida após o login)

### 2. Requisição de Login

- **Method**: POST
- **URL**: `{{baseUrl}}/auth/login`
- **Body** (raw JSON):
```json
{
  "email": "admin@system.com",
  "password": "admin123"
}
```
- **Tests** (para salvar o token automaticamente):
```javascript
if (pm.response.code === 200) {
    const response = pm.response.json();
    pm.collectionVariables.set("token", response.accessToken);
}
```

### 3. Requisição de Listar Empresas

- **Method**: GET
- **URL**: `{{baseUrl}}/tenants`
- **Headers**:
  - `Authorization`: `Bearer {{token}}`

### 4. Requisição de Criar Empresa

- **Method**: POST
- **URL**: `{{baseUrl}}/tenants`
- **Headers**:
  - `Authorization`: `Bearer {{token}}`
  - `Content-Type`: `application/json`
- **Body** (raw JSON):
```json
{
  "email": "novaemp@example.com",
  "cnpjCpf": "98765432109876",
  "nomeFantasia": "Nova Empresa LTDA",
  "nomeResponsavel": "Maria Santos",
  "telefone": "(21) 91234-5678"
}
```

## 🔒 Testando Segurança

### 1. Testar sem Token

```bash
curl -X GET http://localhost:4000/tenants
```

**Esperado**: Erro 401 (Unauthorized)

### 2. Testar com Token Inválido

```bash
curl -X GET http://localhost:4000/tenants \
  -H "Authorization: Bearer token_invalido"
```

**Esperado**: Erro 401 (Unauthorized)

### 3. Testar com Usuário sem Permissão

```bash
# 1. Fazer login como USER
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@empresa1.com",
    "password": "user123"
  }'

# 2. Tentar acessar /tenants com o token do USER
curl -X GET http://localhost:4000/tenants \
  -H "Authorization: Bearer TOKEN_DO_USER"
```

**Esperado**: Erro 403 (Forbidden)

### 4. Testar Validação de Dados

```bash
curl -X POST http://localhost:4000/tenants \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "email_invalido",
    "cnpjCpf": "123"
  }'
```

**Esperado**: Erro 400 (Bad Request) com mensagens de validação

## 📊 Códigos de Status HTTP

| Código | Significado | Quando Ocorre |
|--------|-------------|---------------|
| 200 | OK | Requisição bem-sucedida (GET) |
| 201 | Created | Recurso criado com sucesso (POST) |
| 400 | Bad Request | Dados inválidos ou faltando |
| 401 | Unauthorized | Token ausente, inválido ou expirado |
| 403 | Forbidden | Usuário sem permissão para o recurso |
| 409 | Conflict | Recurso já existe (email/CNPJ duplicado) |
| 500 | Internal Server Error | Erro no servidor |

## 🎯 Payload do JWT

Ao fazer login, o JWT retornado contém o seguinte payload:

```json
{
  "sub": "uuid-do-usuario",
  "email": "admin@system.com",
  "role": "SUPER_ADMIN",
  "tenantId": null,
  "iat": 1705315200,
  "exp": 1705920000
}
```

- `sub`: ID do usuário
- `email`: Email do usuário
- `role`: Role do usuário (SUPER_ADMIN, ADMIN, USER, CLIENT)
- `tenantId`: ID do tenant (null para SUPER_ADMIN)
- `iat`: Timestamp de emissão
- `exp`: Timestamp de expiração

Você pode decodificar o JWT em [jwt.io](https://jwt.io) para visualizar o payload.

