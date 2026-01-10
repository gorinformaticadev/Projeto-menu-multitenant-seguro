# Sistema de Logging e Auditoria de Segurança

## 📋 Visão Geral

Este sistema fornece logging automático e manual de eventos de segurança, permitindo monitoramento completo de atividades críticas no sistema.

## 🏗️ Arquitetura

### Componentes Principais

1. **AuditService** - Serviço central de auditoria
2. **SecurityAuditInterceptor** - Interceptor para logging automático
3. **SecurityLogGuard** - Guard para logging baseado em decorators
4. **SecurityLog Decorator** - Marcação de endpoints para logging manual

## 🔧 Implementação

### 1. Logging Automático

O `SecurityAuditInterceptor` registra automaticamente:

- **Operações críticas**: login, registro, modificações de usuários/tenants
- **Erros de segurança**: tentativas de acesso não autorizadas
- **Violações**: falhas de autenticação, CSRF, etc.

**Endpoints monitorados automaticamente:**
```
POST /auth/login
POST /auth/register  
PUT /users/profile
POST /users
DELETE /users
POST /tenants
PUT /tenants
DELETE /tenants
```

### 2. Logging Manual com Decorators

```typescript
import { SecurityLog } from '@audit/decorators/security-log.decorator';

@Controller('financial')
export class FinancialController {
  
  @Get('reports')
  @SecurityLog({
    action: 'FINANCIAL_REPORT_ACCESS',
    includeUser: true,
    includeTenant: true,
    includeIp: true,
    customDetails: { reportType: 'annual' }
  })
  async getFinancialReports() {
    // operação sensível
  }
}
```

### 3. Configurações do Decorator

```typescript
interface SecurityLogOptions {
  action: string;              // Nome da ação (obrigatório)
  includeUser?: boolean;       // Incluir dados do usuário
  includeTenant?: boolean;     // Incluir tenant ID
  includeIp?: boolean;         // Incluir IP do cliente
  includeUserAgent?: boolean;  // Incluir User-Agent
  customDetails?: Record<string, any>; // Detalhes personalizados
}
```

## 📊 Estrutura dos Logs

### Formato Padrão

```json
{
  "action": "SECURITY_SUCCESS_POST_AUTH_LOGIN",
  "userId": "user-uuid",
  "tenantId": "tenant-uuid", 
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "details": {
    "method": "POST",
    "url": "/auth/login",
    "statusCode": 200,
    "durationMs": 150,
    "timestamp": "2024-01-10T14:30:00.000Z"
  }
}
```

### Tipos de Ações

**Sucesso:**
- `SECURITY_SUCCESS_{METHOD}_{ENDPOINT}`
- `SECURITY_FAILED_{METHOD}_{ENDPOINT}`

**Violações:**
- `SECURITY_VIOLATION_{STATUS}_{METHOD}_{ENDPOINT}`

**Customizadas:**
- Definidas pelo decorator `@SecurityLog`

## 🛡️ Proteções de Privacidade

### Mascaramento de Dados Sensíveis

Parâmetros sensíveis são automaticamente mascarados:

```typescript
// Campos mascarados automaticamente:
password → [REDACTED]
senha → [REDACTED]  
token → [REDACTED]
authorization → [REDACTED]
cpf → [REDACTED]
cnpj → [REDACTED]
creditCard → [REDACTED]
```

### Coleta de IPs

Múltiplas fontes para IP real:
```
X-Forwarded-For → X-Real-IP → X-Client-IP → request.ip
```

## 📈 Monitoramento

### Consultas Úteis

```typescript
// Buscar todas as tentativas de login
const loginAttempts = await auditService.findAll({
  action: 'SECURITY_*_AUTH_LOGIN'
});

// Buscar violações de segurança
const violations = await auditService.findAll({
  action: 'SECURITY_VIOLATION_*'
});

// Estatísticas por período
const stats = await auditService.getStats({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31')
});
```

### Métricas Importantes

- Taxa de tentativas de login falhas
- Padrões de acesso suspeitos
- Frequência de violações por usuário/tenant
- Tempo de resposta de operações críticas

## 🔍 Debugging e Troubleshooting

### Logs de Desenvolvimento

```bash
# Ver logs de auditoria em desenvolvimento
npm run audit:dev

# Filtrar por tipo específico
npm run audit:filter -- --action=SECURITY_VIOLATION
```

### Erros Comuns

**Log não registrado:**
- Verificar se o decorator está aplicado corretamente
- Confirmar que o AuditService está injetado
- Checar permissões do banco de dados

**Dados incompletos:**
- Validar se o usuário está autenticado
- Confirmar configuração de proxy para IP real
- Verificar headers de autenticação

## 📋 Boas Práticas

### 1. Logging de Operações Sensíveis

```typescript
// ✅ Bom - Logging explícito para operações críticas
@Post('transfer')
@SecurityLog({
  action: 'FUNDS_TRANSFER',
  includeUser: true,
  includeTenant: true,
  includeIp: true,
  customDetails: { amount: transfer.amount, currency: transfer.currency }
})
async transferFunds(@Body() transfer: TransferDto) { }

// ❌ Ruim - Sem logging de operação financeira crítica
@Post('transfer')
async transferFunds(@Body() transfer: TransferDto) { }
```

### 2. Granularidade Apropriada

```typescript
// Para operações de alto impacto
@SecurityLog({
  action: 'SYSTEM_CONFIGURATION_CHANGE',
  includeUser: true,
  includeTenant: true,
  includeIp: true,
  includeUserAgent: true
})

// Para operações de baixo impacto
@SecurityLog({
  action: 'USER_PROFILE_VIEW',
  includeUser: true
})
```

### 3. Performance

- Evitar logging excessivo em loops
- Usar paginação em consultas de logs
- Considerar TTL para logs antigos
- Indexar campos de busca frequentes

## 🚀 Configuração Avançada

### Customização do Interceptor

```typescript
// Adicionar operações críticas personalizadas
const customCriticalOperations = [
  'POST /api/payments',
  'DELETE /api/users/*/permissions'
];
```

### Integração com SIEM

```typescript
// Exportar logs para sistemas externos
async exportToSIEM(startDate: Date, endDate: Date) {
  const logs = await this.auditService.findAll({
    startDate,
    endDate
  });
  
  // Enviar para ELK, Splunk, etc.
}
```

## 📊 Relatórios

### Relatório Diário de Segurança

```typescript
async generateDailySecurityReport(date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return {
    date: date.toISOString().split('T')[0],
    totalLogs: await this.getTotalLogs(startOfDay, endOfDay),
    failedLogins: await this.getFailedLoginAttempts(startOfDay, endOfDay),
    securityViolations: await this.getSecurityViolations(startOfDay, endOfDay),
    topUsers: await this.getTopActiveUsers(startOfDay, endOfDay)
  };
}
```

---

*Sistema projetado para compliance e monitoramento proativo de segurança*
*Última atualização: Janeiro 2024*# Sistema de Logging e Auditoria de Segurança

## 📋 Visão Geral

Este sistema fornece logging automático e manual de eventos de segurança, permitindo monitoramento completo de atividades críticas no sistema.

## 🏗️ Arquitetura

### Componentes Principais

1. **AuditService** - Serviço central de auditoria
2. **SecurityAuditInterceptor** - Interceptor para logging automático
3. **SecurityLogGuard** - Guard para logging baseado em decorators
4. **SecurityLog Decorator** - Marcação de endpoints para logging manual

## 🔧 Implementação

### 1. Logging Automático

O `SecurityAuditInterceptor` registra automaticamente:

- **Operações críticas**: login, registro, modificações de usuários/tenants
- **Erros de segurança**: tentativas de acesso não autorizadas
- **Violações**: falhas de autenticação, CSRF, etc.

**Endpoints monitorados automaticamente:**
```
POST /auth/login
POST /auth/register  
PUT /users/profile
POST /users
DELETE /users
POST /tenants
PUT /tenants
DELETE /tenants
```

### 2. Logging Manual com Decorators

```typescript
import { SecurityLog } from '@audit/decorators/security-log.decorator';

@Controller('financial')
export class FinancialController {
  
  @Get('reports')
  @SecurityLog({
    action: 'FINANCIAL_REPORT_ACCESS',
    includeUser: true,
    includeTenant: true,
    includeIp: true,
    customDetails: { reportType: 'annual' }
  })
  async getFinancialReports() {
    // operação sensível
  }
}
```

### 3. Configurações do Decorator

```typescript
interface SecurityLogOptions {
  action: string;              // Nome da ação (obrigatório)
  includeUser?: boolean;       // Incluir dados do usuário
  includeTenant?: boolean;     // Incluir tenant ID
  includeIp?: boolean;         // Incluir IP do cliente
  includeUserAgent?: boolean;  // Incluir User-Agent
  customDetails?: Record<string, any>; // Detalhes personalizados
}
```

## 📊 Estrutura dos Logs

### Formato Padrão

```json
{
  "action": "SECURITY_SUCCESS_POST_AUTH_LOGIN",
  "userId": "user-uuid",
  "tenantId": "tenant-uuid", 
  "ipAddress": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "details": {
    "method": "POST",
    "url": "/auth/login",
    "statusCode": 200,
    "durationMs": 150,
    "timestamp": "2024-01-10T14:30:00.000Z"
  }
}
```

### Tipos de Ações

**Sucesso:**
- `SECURITY_SUCCESS_{METHOD}_{ENDPOINT}`
- `SECURITY_FAILED_{METHOD}_{ENDPOINT}`

**Violações:**
- `SECURITY_VIOLATION_{STATUS}_{METHOD}_{ENDPOINT}`

**Customizadas:**
- Definidas pelo decorator `@SecurityLog`

## 🛡️ Proteções de Privacidade

### Mascaramento de Dados Sensíveis

Parâmetros sensíveis são automaticamente mascarados:

```typescript
// Campos mascarados automaticamente:
password → [REDACTED]
senha → [REDACTED]  
token → [REDACTED]
authorization → [REDACTED]
cpf → [REDACTED]
cnpj → [REDACTED]
creditCard → [REDACTED]
```

### Coleta de IPs

Múltiplas fontes para IP real:
```
X-Forwarded-For → X-Real-IP → X-Client-IP → request.ip
```

## 📈 Monitoramento

### Consultas Úteis

```typescript
// Buscar todas as tentativas de login
const loginAttempts = await auditService.findAll({
  action: 'SECURITY_*_AUTH_LOGIN'
});

// Buscar violações de segurança
const violations = await auditService.findAll({
  action: 'SECURITY_VIOLATION_*'
});

// Estatísticas por período
const stats = await auditService.getStats({
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31')
});
```

### Métricas Importantes

- Taxa de tentativas de login falhas
- Padrões de acesso suspeitos
- Frequência de violações por usuário/tenant
- Tempo de resposta de operações críticas

## 🔍 Debugging e Troubleshooting

### Logs de Desenvolvimento

```bash
# Ver logs de auditoria em desenvolvimento
npm run audit:dev

# Filtrar por tipo específico
npm run audit:filter -- --action=SECURITY_VIOLATION
```

### Erros Comuns

**Log não registrado:**
- Verificar se o decorator está aplicado corretamente
- Confirmar que o AuditService está injetado
- Checar permissões do banco de dados

**Dados incompletos:**
- Validar se o usuário está autenticado
- Confirmar configuração de proxy para IP real
- Verificar headers de autenticação

## 📋 Boas Práticas

### 1. Logging de Operações Sensíveis

```typescript
// ✅ Bom - Logging explícito para operações críticas
@Post('transfer')
@SecurityLog({
  action: 'FUNDS_TRANSFER',
  includeUser: true,
  includeTenant: true,
  includeIp: true,
  customDetails: { amount: transfer.amount, currency: transfer.currency }
})
async transferFunds(@Body() transfer: TransferDto) { }

// ❌ Ruim - Sem logging de operação financeira crítica
@Post('transfer')
async transferFunds(@Body() transfer: TransferDto) { }
```

### 2. Granularidade Apropriada

```typescript
// Para operações de alto impacto
@SecurityLog({
  action: 'SYSTEM_CONFIGURATION_CHANGE',
  includeUser: true,
  includeTenant: true,
  includeIp: true,
  includeUserAgent: true
})

// Para operações de baixo impacto
@SecurityLog({
  action: 'USER_PROFILE_VIEW',
  includeUser: true
})
```

### 3. Performance

- Evitar logging excessivo em loops
- Usar paginação em consultas de logs
- Considerar TTL para logs antigos
- Indexar campos de busca frequentes

## 🚀 Configuração Avançada

### Customização do Interceptor

```typescript
// Adicionar operações críticas personalizadas
const customCriticalOperations = [
  'POST /api/payments',
  'DELETE /api/users/*/permissions'
];
```

### Integração com SIEM

```typescript
// Exportar logs para sistemas externos
async exportToSIEM(startDate: Date, endDate: Date) {
  const logs = await this.auditService.findAll({
    startDate,
    endDate
  });
  
  // Enviar para ELK, Splunk, etc.
}
```

## 📊 Relatórios

### Relatório Diário de Segurança

```typescript
async generateDailySecurityReport(date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return {
    date: date.toISOString().split('T')[0],
    totalLogs: await this.getTotalLogs(startOfDay, endOfDay),
    failedLogins: await this.getFailedLoginAttempts(startOfDay, endOfDay),
    securityViolations: await this.getSecurityViolations(startOfDay, endOfDay),
    topUsers: await this.getTopActiveUsers(startOfDay, endOfDay)
  };
}
```

---

*Sistema projetado para compliance e monitoramento proativo de segurança*
*Última atualização: Janeiro 2024*