# Guia de Teste - Sistema de Instalação de Módulos

## 🎯 Objetivo

Validar que o sistema de instalação de módulos está funcionando corretamente e registrando os módulos no banco de dados.

## 📋 Pré-requisitos

- [ ] Backend rodando (`npm run dev` ou `npm start`)
- [ ] Banco de dados PostgreSQL conectado
- [ ] Usuário SUPER_ADMIN autenticado
- [ ] Token JWT válido

## 🧪 Teste 1: Instalação de Novo Módulo

### Passo 1: Preparar o Módulo de Teste

Crie um arquivo ZIP com a seguinte estrutura:

```
module-teste/
├── module.json
└── README.md
```

**Conteúdo do `module.json`:**
```json
{
  "name": "module-teste",
  "displayName": "Módulo de Teste",
  "version": "1.0.0",
  "description": "Módulo criado para testar o sistema de instalação",
  "author": "Equipe de Testes",
  "category": "testes"
}
```

**Conteúdo do `README.md`:**
```markdown
# Módulo de Teste
Este é um módulo simples para validar o sistema de instalação.
```

### Passo 2: Fazer Upload

**Endpoint:** `POST /modules/upload`

**Headers:**
```
Authorization: Bearer {seu-token-jwt}
Content-Type: multipart/form-data
```

**Body:**
```
module: [arquivo module-teste.zip]
```

**Usando cURL:**
```bash
curl -X POST http://localhost:3000/modules/upload \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -F "module=@module-teste.zip"
```

**Usando Postman/Insomnia:**
1. Método: POST
2. URL: `http://localhost:3000/modules/upload`
3. Headers: `Authorization: Bearer SEU_TOKEN`
4. Body: form-data
   - Key: `module` (tipo: File)
   - Value: Selecionar arquivo `module-teste.zip`

### Passo 3: Verificar Resposta

**Resposta Esperada (200 OK):**
```json
{
  "success": true,
  "module": {
    "name": "module-teste",
    "displayName": "Módulo de Teste",
    "version": "1.0.0",
    "description": "Módulo criado para testar o sistema de instalação",
    "config": null,
    "author": "Equipe de Testes",
    "category": "testes",
    "id": "uuid-gerado-automaticamente",
    "isActive": true,
    "createdAt": "2025-12-14T...",
    "updatedAt": "2025-12-14T..."
  },
  "message": "Módulo 'module-teste' instalado com sucesso",
  "action": "installed"
}
```

### Passo 4: Verificar no Banco de Dados

Execute a query SQL:
```sql
SELECT * FROM modules WHERE name = 'module-teste';
```

**Resultado Esperado:**
- ✅ Registro encontrado
- ✅ `name` = 'module-teste'
- ✅ `displayName` = 'Módulo de Teste'
- ✅ `version` = '1.0.0'
- ✅ `isActive` = true
- ✅ `createdAt` preenchido
- ✅ `updatedAt` preenchido

### Passo 5: Verificar Arquivos Físicos

Verificar se a pasta foi criada:
```
../modules/module-teste/
├── module.json
└── README.md
```

### Passo 6: Listar Módulos Instalados

**Endpoint:** `GET /modules/installed`

**Resposta Esperada:**
```json
[
  {
    "id": "uuid",
    "name": "module-teste",
    "displayName": "Módulo de Teste",
    "version": "1.0.0",
    "description": "Módulo criado para testar o sistema de instalação",
    "isActive": true,
    "config": null,
    "isInstalled": true,
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

**✅ Teste 1 PASSOU** se:
- Resposta do upload foi 200 OK
- Módulo aparece no banco de dados
- Módulo aparece em `/modules/installed`
- Arquivos foram descompactados corretamente
- `isInstalled: true`

---

## 🧪 Teste 2: Atualização de Módulo Existente

### Passo 1: Modificar o Módulo

Edite o `module.json`:
```json
{
  "name": "module-teste",
  "displayName": "Módulo de Teste (Atualizado)",
  "version": "1.1.0",
  "description": "Módulo atualizado para testar o sistema",
  "author": "Equipe de Testes",
  "category": "testes"
}
```

Crie novo ZIP com o mesmo nome.

### Passo 2: Fazer Upload Novamente

```bash
POST /modules/upload
```

### Passo 3: Verificar Resposta

**Resposta Esperada:**
```json
{
  "success": true,
  "module": {
    "name": "module-teste",
    "displayName": "Módulo de Teste (Atualizado)",
    "version": "1.1.0",
    ...
  },
  "message": "Módulo 'module-teste' atualizado com sucesso",
  "action": "updated"  // ← Note: "updated" ao invés de "installed"
}
```

### Passo 4: Verificar no Banco

```sql
SELECT * FROM modules WHERE name = 'module-teste';
```

**Resultado Esperado:**
- ✅ `displayName` = 'Módulo de Teste (Atualizado)'
- ✅ `version` = '1.1.0'
- ✅ `updatedAt` foi atualizado
- ✅ `id` continua o mesmo (não criou novo registro)

**✅ Teste 2 PASSOU** se:
- `action: "updated"` na resposta
- Versão foi atualizada no banco
- Não criou registro duplicado
- `updatedAt` foi modificado

---

## 🧪 Teste 3: Módulo com Migrações SQL

### Passo 1: Criar Módulo com Migração

```
module-com-migracao/
├── module.json
└── migrations/
    └── 001_create_test_table.sql
```

**`module.json`:**
```json
{
  "name": "module-com-migracao",
  "displayName": "Módulo com Migração",
  "version": "1.0.0",
  "description": "Teste de execução de migrações"
}
```

**`migrations/001_create_test_table.sql`:**
```sql
CREATE TABLE IF NOT EXISTS test_module_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Passo 2: Fazer Upload

```bash
POST /modules/upload
```

### Passo 3: Verificar Logs do Servidor

Procure por:
```
[ModuleInstallerService] Executando migração: 001_create_test_table.sql
[ModuleInstallerService] Migração 001_create_test_table.sql executada com sucesso
```

### Passo 4: Verificar Tabela no Banco

```sql
SELECT * FROM information_schema.tables 
WHERE table_name = 'test_module_table';
```

**✅ Teste 3 PASSOU** se:
- Tabela foi criada no banco
- Logs mostram execução da migração
- Nenhum erro foi lançado

---

## 🧪 Teste 4: Módulo com Dependências NPM

### Passo 1: Criar Módulo com package.json

```
module-com-deps/
├── module.json
└── package.json
```

**`package.json`:**
```json
{
  "name": "module-com-deps",
  "version": "1.0.0",
  "dependencies": {
    "lodash": "^4.17.21"
  }
}
```

### Passo 2: Fazer Upload

```bash
POST /modules/upload
```

### Passo 3: Verificar Logs

Procure por:
```
[ModuleInstallerService] Instalando dependências do módulo...
[ModuleInstallerService] Dependências instaladas com sucesso
```

### Passo 4: Verificar node_modules

Verificar se existe:
```
../modules/module-com-deps/node_modules/lodash/
```

**✅ Teste 4 PASSOU** se:
- Dependências foram instaladas
- Pasta `node_modules` foi criada
- Logs mostram sucesso

---

## 🧪 Teste 5: Verificar Integração com Tenants

### Passo 1: Ativar Módulo para um Tenant

```bash
POST /tenants/{tenantId}/modules/module-teste/activate
```

### Passo 2: Verificar Ativação

```bash
GET /modules/module-teste/tenants
```

**Resposta Esperada:**
```json
{
  "summary": {
    "total": 1,
    "active": 1,
    "inactive": 0,
    "canUninstall": false
  },
  "activeTenants": [
    {
      "tenantId": "...",
      "tenantName": "...",
      ...
    }
  ]
}
```

### Passo 3: Tentar Desinstalar (Deve Falhar)

```bash
DELETE /modules/module-teste/uninstall
```

**Resposta Esperada (400 Bad Request):**
```json
{
  "statusCode": 400,
  "message": "Não é possível remover o módulo 'module-teste' pois está ativo em 1 tenant(s): Nome do Tenant. Desative o módulo em todos os tenants antes de desinstalá-lo."
}
```

### Passo 4: Desativar Módulo

```bash
POST /tenants/{tenantId}/modules/module-teste/deactivate
```

### Passo 5: Desinstalar (Agora Deve Funcionar)

```bash
DELETE /modules/module-teste/uninstall
```

**Resposta Esperada (200 OK):**
```json
{
  "success": true,
  "message": "Módulo 'module-teste' removido com sucesso"
}
```

**✅ Teste 5 PASSOU** se:
- Módulo foi ativado para o tenant
- Desinstalação foi bloqueada quando ativo
- Desinstalação funcionou após desativar
- Registro foi removido do banco
- Arquivos foram removidos do disco

---

## 📊 Checklist Final

Após executar todos os testes, verificar:

- [ ] ✅ Novos módulos são registrados no banco
- [ ] ✅ Módulos existentes são atualizados (não duplicados)
- [ ] ✅ Migrações SQL são executadas automaticamente
- [ ] ✅ Dependências NPM são instaladas
- [ ] ✅ Arquivos são descompactados corretamente
- [ ] ✅ Módulos aparecem em `/modules/installed`
- [ ] ✅ Integração com tenants funciona
- [ ] ✅ Desinstalação respeita regras de negócio
- [ ] ✅ Logs são informativos e completos
- [ ] ✅ Mensagens de erro são claras

## 🐛 Troubleshooting

### Problema: Módulo não aparece em `/modules/installed`

**Verificar:**
1. Logs do servidor para erros
2. Se o registro foi criado no banco: `SELECT * FROM modules WHERE name = 'nome-do-modulo'`
3. Se há erros de permissão nos diretórios

### Problema: Migração falhou

**Verificar:**
1. Sintaxe SQL da migração
2. Se as tabelas já existem (usar `CREATE TABLE IF NOT EXISTS`)
3. Permissões do usuário do banco de dados

### Problema: Dependências não instaladas

**Verificar:**
1. Se o `package.json` é válido
2. Se o NPM está instalado no servidor
3. Logs do servidor - instalação de deps não bloqueia instalação do módulo

## 📝 Relatório de Teste

Após executar todos os testes, preencher:

```
Data do Teste: _______________
Versão do Sistema: _______________

Teste 1 (Instalação): [ ] PASSOU [ ] FALHOU
Teste 2 (Atualização): [ ] PASSOU [ ] FALHOU
Teste 3 (Migrações): [ ] PASSOU [ ] FALHOU
Teste 4 (Dependências): [ ] PASSOU [ ] FALHOU
Teste 5 (Integração): [ ] PASSOU [ ] FALHOU

Observações:
_________________________________
_________________________________
_________________________________
```
