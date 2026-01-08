# Correção: Persistência de Módulos por Tenant

**Data**: 18 de dezembro de 2024

## 🎯 Problema Identificado

O toggle de módulos estava mostrando a mensagem de "Módulo habilitado", mas ao recarregar a página o estado não persistia. O módulo voltava a aparecer como desabilitado.

### Causa Raiz

O endpoint `/tenants/:id/modules/active` estava usando o método `TenantsService.getTenantActiveModules()` que retornava arrays vazios:

```typescript
async getTenantActiveModules(tenantId: string) {
  // Método temporariamente desabilitado - usar ModuleSecurityService
  return {
    activeModules: [],
    modules: [],
  };
}
```

Isso fazia com que:
1. O backend salvava corretamente na tabela `module_tenant`
2. Mas ao buscar os módulos ativos, sempre retornava vazio
3. O frontend interpretava como "nenhum módulo ativo"
4. O toggle voltava para desabilitado

## ✅ Solução Implementada

### 1. Atualizado `TenantsController`

Ambos os endpoints agora usam `TenantModuleService.getModulesForTenant()`:

#### Endpoint 1: GET `/tenants/my-tenant/modules/active`

```typescript
@Get('my-tenant/modules/active')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@SkipThrottle()
async getMyTenantActiveModules(@Req() req: ExpressRequest & { user: any }) {
  if (!req.user.tenantId) {
    if (req.user.role === Role.SUPER_ADMIN) {
      throw new BadRequestException('SUPER_ADMIN não possui contexto de tenant. Use um usuário ADMIN de tenant.');
    }
    throw new BadRequestException('Usuário sem vinculo com tenant.');
  }
  
  // ✅ USANDO TenantModuleService
  const modules = await this.tenantModuleService.getModulesForTenant(req.user.tenantId);
  return {
    modules: modules.filter(m => m.enabled).map(m => ({
      name: m.slug,
      isActive: m.enabled
    })),
    activeModules: modules.filter(m => m.enabled).map(m => m.slug)
  };
}
```

#### Endpoint 2: GET `/tenants/:id/modules/active`

```typescript
@Get(':id/modules/active')
@Roles(Role.SUPER_ADMIN)
@SkipTenantIsolation()
@SkipThrottle()
async getTenantActiveModules(@Param('id') id: string) {
  // ✅ USANDO TenantModuleService
  const modules = await this.tenantModuleService.getModulesForTenant(id);
  return {
    modules: modules.filter(m => m.enabled).map(m => ({
      name: m.slug,
      isActive: m.enabled
    })),
    activeModules: modules.filter(m => m.enabled).map(m => m.slug)
  };
}
```

### 2. Atualizado `TenantsModule`

Importado `TenantModulesModule` para que o `TenantModuleService` fique disponível via injeção de dependência:

```typescript
import { TenantModulesModule } from '../core/tenant-modules.module';

@Module({
  imports: [TenantModulesModule], // ✅ ADICIONADO
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
```

## 📊 Fluxo Correto Agora

### 1. Ativar Módulo

```
Frontend: Clica no toggle
  ↓
POST /tenants/{id}/modules/{slug}/activate
  ↓
TenantModuleService.activateModuleForTenant()
  ↓
Verifica: module.status === 'active' no sistema
  ↓
UPSERT na tabela module_tenant:
  - moduleId: ID do módulo
  - tenantId: ID do tenant
  - enabled: true ✅
  ↓
Retorna sucesso
```

### 2. Buscar Módulos Ativos

```
Frontend: Recarrega dados
  ↓
GET /tenants/{id}/modules/active
  ↓
TenantModuleService.getModulesForTenant()
  ↓
SELECT FROM modules 
  WHERE status = 'active'
  LEFT JOIN module_tenant
  WHERE tenantId = {id}
  ↓
Retorna:
{
  modules: [
    { name: 'sistema', isActive: true }  ✅
  ],
  activeModules: ['sistema']
}
  ↓
Frontend exibe toggle como ATIVO
```

## 🗄️ Estrutura do Banco de Dados

### Tabela: `module_tenant`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | ID único do registro |
| moduleId | UUID | FK para `modules.id` |
| tenantId | UUID | FK para `tenants.id` |
| **enabled** | **Boolean** | **Se módulo está habilitado para este tenant** |
| createdAt | DateTime | Data de criação |
| updatedAt | DateTime | Data de última atualização |

**Constraint Único**: `(moduleId, tenantId)` - Um módulo só pode ter um registro por tenant

## 🧪 Como Testar

### Teste 1: Verificar Estado no Banco de Dados

Execute o script SQL em `DOCS/verificar-modulos-tenant.sql`:

```sql
-- Ver módulos habilitados para um tenant específico
SELECT 
    m.slug,
    m.name,
    m.status as system_status,
    mt.enabled as enabled_for_tenant,
    mt."updatedAt" as last_updated
FROM modules m
LEFT JOIN module_tenant mt ON m.id = mt."moduleId" 
    AND mt."tenantId" = 'SEU_TENANT_ID_AQUI'
WHERE m.status = 'active'
ORDER BY m.name;
```

**Resultado Esperado**:

| slug | name | system_status | enabled_for_tenant | last_updated |
|------|------|---------------|-------------------|--------------|
| sistema | Sistema | active | **true** | 2024-12-18 14:20:00 |

### Teste 2: Verificar API

**2.1. Ativar Módulo**:

```bash
POST http://localhost:4000/tenants/{TENANT_ID}/modules/sistema/activate
Authorization: Bearer {TOKEN}
```

**Resposta Esperada**:
```json
{
  "message": "Módulo sistema ativado para o tenant {TENANT_ID}"
}
```

**2.2. Buscar Módulos Ativos**:

```bash
GET http://localhost:4000/tenants/{TENANT_ID}/modules/active
Authorization: Bearer {TOKEN}
```

**Resposta Esperada**:
```json
{
  "modules": [
    {
      "name": "sistema",
      "isActive": true
    }
  ],
  "activeModules": ["sistema"]
}
```

### Teste 3: Verificar Frontend

1. Acesse `/empresas`
2. Selecione um tenant
3. Vá para aba "Módulos"
4. Certifique-se que o módulo "sistema" está com status "Sistema: Ativo" (verde)
5. Ative o toggle do módulo
6. Verifique que aparece badge "Tenant: Ativo" (azul)
7. **Recarregue a página completa (F5)**
8. Volte para aba "Módulos"
9. **Verifique que o toggle ainda está ATIVO** ✅

## 📝 Resumo das Mudanças

### Arquivos Modificados

1. **backend/src/tenants/tenants.controller.ts**
   - Linha 197-210: Atualizado `getMyTenantActiveModules()` para usar `TenantModuleService`
   - Linha 212-221: Atualizado `getTenantActiveModules()` para usar `TenantModuleService`

2. **backend/src/tenants/tenants.module.ts**
   - Linha 4: Importado `TenantModulesModule`
   - Linha 7: Adicionado `TenantModulesModule` aos imports

### Arquivos Criados

1. **DOCS/verificar-modulos-tenant.sql**
   - Scripts SQL para verificar estado dos módulos no banco

## ✅ Resultado

Agora quando você ativa um módulo:

1. ✅ O estado é **salvo** na tabela `module_tenant`
2. ✅ Ao buscar módulos ativos, o backend **retorna os dados corretos** do banco
3. ✅ O frontend **exibe o estado persistido** corretamente
4. ✅ Após recarregar a página, **o toggle permanece ativo**

## 🔍 Troubleshooting

### Problema: Toggle ainda não persiste

**Verificar**:

1. Backend está rodando a versão atualizada?
   ```bash
   # Veja os logs do backend
   # Deve mostrar rotas mapeadas para /tenants/:id/modules/active
   ```

2. Banco de dados tem a tabela `module_tenant`?
   ```sql
   SELECT * FROM module_tenant;
   ```

3. Módulo está com `status = 'active'` no sistema?
   ```sql
   SELECT slug, name, status FROM modules WHERE slug = 'sistema';
   ```

4. Há erros no console do navegador?
   - Abra DevTools (F12)
   - Veja a aba Console
   - Veja a aba Network ao clicar no toggle

### Problema: Erro 500 ao buscar módulos

**Possível Causa**: `TenantModulesModule` não está importado corretamente

**Solução**: Verifique que `TenantsModule` tem o import:
```typescript
imports: [TenantModulesModule]
```

## 📚 Documentação Relacionada

- `DOCS/CORRECAO_DOIS_NIVEIS_MODULOS.md` - Arquitetura de dois níveis
- `DOCS/CORRECAO_TOGGLE_MODULOS_TENANT.md` - Correção inicial do toggle
- `RELATORIO_MODULOS.md` - Documentação completa do sistema de módulos
