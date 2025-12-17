# Correção do Erro 404 no Endpoint `/me/modules` na Página de Login

## Problema Identificado

Ao acessar a página de login, o frontend tenta carregar os módulos disponíveis através do endpoint `GET http://localhost:4000/me/modules`, mas recebe um erro 404 (Not Found).

### Análise da Causa Raiz

O erro ocorre devido a uma inconsistência na estrutura de módulos do backend. Existem dois arquivos `common.module.ts` diferentes:

| Arquivo | Localização | Status |
|---------|------------|--------|
| CommonModule Principal | `backend/src/common/common.module.ts` | **Em uso pelo AppModule** - NÃO contém UserModulesController |
| CommonModule Legado | `backend/src/core/common.module.ts` | **NÃO importado** - Contém UserModulesController |

#### Fluxo Atual (Quebrado)

```
Frontend (useModuleRegistry.ts)
  ↓
Chama: GET /me/modules
  ↓
Backend (AppModule)
  ↓
Importa: CommonModule de ./common/common.module
  ↓
CommonModule NÃO possui UserModulesController
  ↓
Resultado: 404 Not Found
```

#### Componentes Existentes mas Não Registrados

O controller `UserModulesController` existe em `backend/src/core/user-modules.controller.ts` com a seguinte estrutura:

- **Rota Base**: `@Controller('me')`
- **Endpoint**: `@Get('modules')`
- **Guard**: `JwtAuthGuard` (requer autenticação)
- **Funcionalidade**: Retorna módulos disponíveis para o tenant do usuário autenticado

O serviço `ModuleSecurityService` também existe em `backend/src/core/module-security.service.ts` e fornece o método `getAvailableModules(tenantId)`.

## Solução Proposta

### Estratégia de Correção

Integrar o `UserModulesController` e suas dependências no `CommonModule` principal que está sendo utilizado pelo `AppModule`.

### Alterações Necessárias

#### 1. Atualização do CommonModule Principal

**Arquivo**: `backend/src/common/common.module.ts`

Adicionar as seguintes importações e registros:

| Componente | Tipo | Origem | Finalidade |
|------------|------|--------|------------|
| UserModulesController | Controller | `@core/user-modules.controller` | Expor endpoint `/me/modules` |
| ModuleSecurityService | Provider | `@core/module-security.service` | Fornecer lógica de segurança e busca de módulos |
| NotificationService | Provider | `@core/notification.service` | Dependência do sistema de módulos |
| EventBus | Provider (Value) | `@core/events/EventBus` | Sistema de eventos do core |

#### 2. Dependências do Módulo

Garantir que o `CommonModule` tenha acesso ao `PrismaModule`:

- **Adicionar ao imports**: `PrismaModule` (necessário para `ModuleSecurityService`)
- **Manter no imports**: `SecurityConfigModule` (já existente)

#### 3. Estrutura do Módulo Atualizado

```
@Module({
  imports: [
    PrismaModule,
    SecurityConfigModule
  ],
  controllers: [
    CspReportController,
    UserModulesController  // NOVO
  ],
  providers: [
    PlatformInitService,
    ModuleSecurityService,  // NOVO
    NotificationService,    // NOVO
    {
      provide: 'EventBus',
      useValue: eventBus    // NOVO
    }
  ],
  exports: [
    PlatformInitService,
    ModuleSecurityService,  // NOVO
    NotificationService     // NOVO
  ]
})
```

### Fluxo Corrigido

```
Frontend (useModuleRegistry.ts)
  ↓
Chama: GET /me/modules (após autenticação)
  ↓
Backend (AppModule)
  ↓
Importa: CommonModule de ./common/common.module
  ↓
CommonModule possui UserModulesController
  ↓
Controller usa JwtAuthGuard para validar token
  ↓
Extrai tenantId do usuário autenticado
  ↓
ModuleSecurityService.getAvailableModules(tenantId)
  ↓
Consulta banco de dados (Prisma)
  ↓
Retorna: { modules: [...] }
  ↓
Frontend recebe e renderiza módulos
```

## Validações de Segurança

### Proteções Mantidas

| Aspecto | Mecanismo | Implementação |
|---------|-----------|---------------|
| Autenticação | JwtAuthGuard | Endpoint protegido, requer token válido |
| Isolamento de Tenant | TenantInterceptor | Apenas módulos do tenant do usuário são retornados |
| Controle de Acesso | ModuleSecurityService | Verifica status ativo e habilitação por tenant |
| Rate Limiting | ThrottlerGuard | Limites globais aplicados (2000 req/min dev, 100 req/min prod) |

### Comportamentos Esperados

#### Cenário 1: Usuário Não Autenticado
- **Request**: `GET /me/modules` sem token
- **Response**: `401 Unauthorized`
- **Motivo**: JwtAuthGuard bloqueia a requisição

#### Cenário 2: Usuário Autenticado Sem Tenant
- **Request**: `GET /me/modules` com token válido mas sem tenantId
- **Response**: `{ modules: [] }`
- **Motivo**: Retorno seguro de array vazio

#### Cenário 3: Usuário Autenticado Com Tenant
- **Request**: `GET /me/modules` com token válido e tenantId
- **Response**: `{ modules: [...] }` com módulos ativos e habilitados
- **Motivo**: Fluxo normal de operação

## Impacto da Correção

### Funcionalidades Restauradas

- Login Page: Carregamento correto do Module Registry
- User Experience: Eliminação do erro 404 no console
- Module System: Inicialização adequada do sistema de módulos no frontend

### Áreas Afetadas

| Componente | Tipo de Impacto | Descrição |
|------------|-----------------|-----------|
| CommonModule | Modificação | Adição de controller e providers |
| PrismaModule | Importação | Necessário para ModuleSecurityService |
| Frontend Module Registry | Resolução | Endpoint agora disponível |
| Login Flow | Melhoria | Módulos carregados corretamente após autenticação |

### Compatibilidade

- **Backward Compatible**: Sim, não quebra funcionalidades existentes
- **Database Changes**: Nenhuma alteração necessária
- **API Changes**: Nenhuma mudança nas assinaturas de endpoints
- **Frontend Changes**: Nenhuma alteração necessária

## Próximos Passos Após Implementação

### Validação Funcional

1. Reiniciar o backend após as alterações
2. Acessar a página de login
3. Verificar no console do navegador que não há mais o erro 404
4. Confirmar que a mensagem `✅ Module Registry inicializado com sucesso` aparece
5. Testar login e verificar que os módulos do tenant são carregados corretamente

### Limpeza Técnica (Opcional)

Considerar em um segundo momento:

- Avaliar a necessidade de manter `backend/src/core/common.module.ts`
- Se não utilizado, remover o arquivo duplicado
- Consolidar toda a lógica de módulos em uma única estrutura

## Decisões de Design

### Por que não mover o controller para dentro de backend/src/common/?

**Razão**: O `UserModulesController` está localizado em `backend/src/core/` porque faz parte do sistema core de módulos. Mover arquivos pode quebrar outros imports e referências. A solução mais segura é importar no módulo correto.

### Por que não criar um novo módulo específico para módulos de usuário?

**Razão**: O `CommonModule` já é o local apropriado para funcionalidades compartilhadas e transversais. Adicionar o controller aqui mantém a coesão e evita proliferação desnecessária de módulos.

### Por que manter dois arquivos common.module.ts?

**Razão**: Por enquanto, mantemos ambos para evitar quebra de possíveis referências. A limpeza pode ser feita posteriormente após validação completa do sistema.
