# Correção do Sistema de Instalação de Módulos

## Problema Identificado

O método `uploadModule` estava **apenas descompactando** os arquivos do módulo, mas **não estava registrando** o módulo no banco de dados. Isso fazia com que o módulo não fosse reconhecido pelo sistema.

## Correções Implementadas

### 1. Registro no Banco de Dados

O método `uploadModule` agora:

1. ✅ **Descompacta** o módulo
2. ✅ **Executa migrações** SQL (se existirem)
3. ✅ **Instala dependências** NPM (se existir package.json)
4. ✅ **Registra no banco** de dados na tabela `Module`
5. ✅ **Atualiza** se o módulo já existir

### 2. Fluxo Completo de Instalação

```typescript
async uploadModule(file: Express.Multer.File) {
  // 1. Validar e salvar arquivo temporário
  // 2. Descompactar e extrair informações do module.json
  // 3. Verificar se módulo já existe no banco
  // 4. Executar migrações SQL
  // 5. Instalar dependências NPM
  // 6. Criar ou atualizar registro no banco
  // 7. Retornar informações completas
}
```

### 3. Informações Extraídas do module.json

O sistema agora extrai e armazena:

- ✅ `name` - Nome único do módulo (obrigatório)
- ✅ `displayName` - Nome de exibição (obrigatório)
- ✅ `version` - Versão do módulo (obrigatório)
- ✅ `description` - Descrição do módulo
- ✅ `config` - Configurações específicas do módulo
- ✅ `author` - Autor do módulo
- ✅ `category` - Categoria do módulo

### 4. Resposta da API

**Antes:**
```json
{
  "success": true,
  "module": {
    "name": "module-exemplo",
    "displayName": "Módulo de Exemplo",
    "version": "1.0.0",
    "description": "..."
  },
  "message": "Módulo descompactado com sucesso"
}
```

**Depois:**
```json
{
  "success": true,
  "module": {
    "name": "module-exemplo",
    "displayName": "Módulo de Exemplo",
    "version": "1.0.0",
    "description": "...",
    "config": { ... },
    "author": "Nome do Autor",
    "category": "categoria",
    "id": "uuid-do-registro",
    "isActive": true,
    "createdAt": "2025-12-14T18:00:00Z",
    "updatedAt": "2025-12-14T18:00:00Z"
  },
  "message": "Módulo 'module-exemplo' instalado com sucesso",
  "action": "installed"
}
```

## Estrutura do module.json

Todo módulo deve ter um arquivo `module.json` na raiz com a seguinte estrutura:

```json
{
  "name": "module-exemplo",
  "displayName": "Módulo de Exemplo",
  "version": "1.0.0",
  "description": "Descrição detalhada do módulo",
  "author": "Nome do Desenvolvedor",
  "category": "vendas",
  "config": {
    "defaultSettings": {
      "feature1": true,
      "feature2": false
    },
    "permissions": ["read", "write"],
    "routes": [
      {
        "path": "/exemplo",
        "component": "ExemploPage"
      }
    ]
  }
}
```

## Estrutura de Diretórios do Módulo

```
module-exemplo/
├── module.json          # Configuração do módulo (obrigatório)
├── package.json         # Dependências NPM (opcional)
├── migrations/          # Migrações SQL (opcional)
│   ├── 001_create_tables.sql
│   └── 002_add_columns.sql
├── frontend/            # Código frontend (opcional)
│   ├── components/
│   ├── pages/
│   └── routes.tsx
└── backend/             # Código backend (opcional)
    ├── controllers/
    ├── services/
    └── routes.ts
```

## Processo de Instalação

### 1. Via Upload (Interface Web)

```bash
POST /modules/upload
Content-Type: multipart/form-data

module: [arquivo.zip]
```

### 2. Verificação no Banco

Após o upload bem-sucedido, verificar se o módulo foi registrado:

```bash
GET /modules/installed
```

Resposta esperada:
```json
[
  {
    "id": "uuid",
    "name": "module-exemplo",
    "displayName": "Módulo de Exemplo",
    "version": "1.0.0",
    "isActive": true,
    "isInstalled": true,
    "config": { ... },
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

### 3. Ativar para um Tenant

```bash
POST /tenants/{tenantId}/modules/module-exemplo/activate
```

## Logs do Sistema

Durante a instalação, você verá logs como:

```
[ModuleInstallerService] Iniciando upload do módulo: module-exemplo.zip
[ModuleInstallerService] Tamanho do arquivo: 1234567 bytes
[ModuleInstallerService] Arquivo temporário salvo: ...
[ModuleInstallerService] Descompactando ZIP com 25 arquivos
[ModuleInstallerService] Módulo identificado: module-exemplo
[ModuleInstallerService] Descompactação concluída para o módulo: module-exemplo
[ModuleInstallerService] Módulo module-exemplo descompactado com sucesso
[ModuleInstallerService] Executando migração: 001_create_tables.sql
[ModuleInstallerService] Migração 001_create_tables.sql executada com sucesso
[ModuleInstallerService] Instalando dependências do módulo...
[ModuleInstallerService] Dependências instaladas com sucesso
[ModuleInstallerService] Registrando novo módulo module-exemplo no banco de dados...
[ModuleInstallerService] Módulo module-exemplo registrado com sucesso
```

## Atualização de Módulos

Se você enviar um módulo que já existe:

1. ✅ Os arquivos serão **sobrescritos**
2. ✅ As migrações serão **executadas novamente**
3. ✅ O registro no banco será **atualizado**
4. ✅ A mensagem indicará: `"action": "updated"`

## Troubleshooting

### Módulo não aparece na lista

**Problema:** Módulo foi descompactado mas não aparece em `/modules/installed`

**Solução:** Verificar logs do servidor para erros durante o registro no banco

### Erro ao executar migrações

**Problema:** Migração SQL falhou

**Solução:** 
- Verificar sintaxe SQL
- Verificar se as tabelas já existem
- Usar `CREATE TABLE IF NOT EXISTS` nas migrações

### Dependências NPM não instaladas

**Problema:** `package.json` existe mas dependências não foram instaladas

**Solução:**
- Verificar se o `package.json` é válido
- Verificar logs - instalação de dependências não bloqueia a instalação do módulo
- Instalar manualmente se necessário

## Arquivos Modificados

1. **`backend/src/modules/module-installer.service.ts`**
   - Método `uploadModule()` - Agora registra no banco
   - Método `extractModule()` - Retorna informações completas do module.json

## Próximos Passos

Após a instalação do módulo:

1. ✅ Verificar se aparece em `/modules/installed`
2. ✅ Ativar para tenants específicos via `/tenants/{id}/modules/{name}/activate`
3. ✅ Configurar permissões e rotas conforme necessário
4. ✅ Testar funcionalidades do módulo
