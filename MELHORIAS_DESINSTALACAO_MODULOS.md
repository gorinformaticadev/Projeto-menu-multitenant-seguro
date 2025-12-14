# Melhorias no Sistema de Desinstalação de Módulos

## Problema Identificado

O sistema estava corretamente verificando se um módulo estava ativo em alguma tenant antes de permitir a desinstalação, mas a mensagem de erro não era suficientemente informativa. O usuário não sabia **quais tenants** estavam usando o módulo.

## Solução Implementada

### 1. Mensagem de Erro Melhorada

**Antes:**
```
Não é possível remover o módulo 'module-exemplo' pois está ativo em 1 tenant(s)
```

**Depois:**
```
Não é possível remover o módulo 'module-exemplo' pois está ativo em 1 tenant(s): Empresa ABC. Desative o módulo em todos os tenants antes de desinstalá-lo.
```

A nova mensagem:
- ✅ Lista os **nomes** dos tenants que estão usando o módulo
- ✅ Fornece uma **instrução clara** sobre o que fazer
- ✅ Registra um **log de warning** com detalhes completos

### 2. Novo Endpoint de Consulta

Foi criado um novo endpoint para consultar detalhes sobre o uso de um módulo:

**Endpoint:** `GET /modules/:name/tenants`

**Resposta:**
```json
{
  "module": {
    "name": "module-exemplo",
    "displayName": "Módulo de Exemplo",
    "version": "1.0.0"
  },
  "summary": {
    "total": 3,
    "active": 1,
    "inactive": 2,
    "canUninstall": false
  },
  "activeTenants": [
    {
      "tenantId": "uuid-123",
      "tenantName": "Empresa ABC",
      "tenantEmail": "contato@empresaabc.com",
      "tenantActive": true,
      "activatedAt": "2025-12-01T10:00:00Z",
      "config": null
    }
  ],
  "inactiveTenants": [
    {
      "tenantId": "uuid-456",
      "tenantName": "Empresa XYZ",
      "tenantEmail": "contato@empresaxyz.com",
      "tenantActive": true,
      "deactivatedAt": "2025-12-10T15:30:00Z",
      "config": null
    }
  ]
}
```

### 3. Benefícios

1. **Transparência**: O administrador sabe exatamente quais tenants estão usando o módulo
2. **Ação Direcionada**: Pode desativar o módulo especificamente nos tenants listados
3. **Auditoria**: Logs detalhados de tentativas de desinstalação bloqueadas
4. **Prevenção de Erros**: Informação clara sobre por que a desinstalação foi bloqueada

## Regra de Negócio Confirmada

✅ **Módulos são globais** - instalados uma vez no sistema
✅ **Desinstalação bloqueada** - apenas se houver tenants com o módulo **ATIVO** (`isActive: true`)
✅ **Desinstalação permitida** - se nenhum tenant tiver o módulo ativo (mesmo que tenha registros inativos)

## Como Usar

### Para Desinstalar um Módulo:

1. **Consultar quais tenants usam o módulo:**
   ```bash
   GET /modules/module-exemplo/tenants
   ```

2. **Desativar o módulo em cada tenant ativo:**
   ```bash
   PUT /tenants/{tenantId}/modules/module-exemplo
   {
     "isActive": false
   }
   ```

3. **Desinstalar o módulo:**
   ```bash
   DELETE /modules/module-exemplo/uninstall
   ```

## Arquivos Modificados

1. **`backend/src/modules/module-installer.service.ts`**
   - Método `removeModule()` - Mensagem de erro melhorada
   - Novo método `getModuleTenants()` - Consulta detalhada de uso

2. **`backend/src/modules/modules.controller.ts`**
   - Novo endpoint `GET /modules/:name/tenants`

## Segurança

- ✅ Todos os endpoints requerem autenticação JWT
- ✅ Apenas `SUPER_ADMIN` pode acessar esses endpoints
- ✅ Validação de existência do módulo antes de processar
- ✅ Logs detalhados de todas as operações
