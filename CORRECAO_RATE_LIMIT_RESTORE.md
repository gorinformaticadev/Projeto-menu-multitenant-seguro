# Correção: Rate Limiting no Endpoint de Restore

## Problema Identificado

O usuário recebia erro **429 (Too Many Requests)** ao tentar executar restore do banco de dados:

```
RestoreSection.tsx:110  POST http://localhost:4000/api/backup/restore 429 (Too Many Requests)
```

## Causa Raiz

O endpoint `/api/backup/restore` tinha um **throttle muito restritivo**:

```typescript
@Throttle({ default: { limit: 2, ttl: 3600000 } }) // 2 por hora
```

**Problema**: 
- Limite de apenas **2 requisições por hora**
- Durante testes e desenvolvimento, é comum fazer múltiplas tentativas
- Uma vez atingido o limite, o usuário precisaria **esperar 1 hora** para tentar novamente

## Solução Implementada

Aumentado o limite de rate para **10 requisições por hora**:

```typescript
@Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 por hora (aumentado para testes)
```

### Código Modificado

**Arquivo**: `d:\github\2026\apps\backend\src\backup\backup.controller.ts`

**Linha 182**:
```typescript
// ANTES
@Throttle({ default: { limit: 2, ttl: 3600000 } }) // 2 por hora

// DEPOIS
@Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 por hora (aumentado para testes)
```

## Contexto do Rate Limiting

### Rate Limiting Global

O sistema tem rate limiting global configurado em `app.module.ts`:

```typescript
ThrottlerModule.forRoot([
  {
    name: 'default',
    ttl: 60000, // 60 segundos (1 minuto)
    limit: 10000, // 10000 req/min em desenvolvimento
  },
  {
    name: 'login',
    ttl: 60000, // 60 segundos
    limit: process.env.NODE_ENV === 'production' ? 5 : 10,
  },
])
```

### Rate Limiting Específico

Endpoints críticos têm limites mais restritivos:

| Endpoint | Limite Anterior | Limite Atual | TTL |
|----------|----------------|--------------|-----|
| `/api/backup/create` | 5/hora | 5/hora | 1 hora |
| `/api/backup/restore` | **2/hora** | **10/hora** | 1 hora |
| `/api/update/execute` | 3/hora | 3/hora | 1 hora |

## Por que Aumentar o Limite?

### Razões para Aumentar

1. **Desenvolvimento e Testes**
   - Múltiplas tentativas são necessárias durante debug
   - Erros de validação podem exigir resubmissão
   - Testes de integração precisam rodar múltiplas vezes

2. **Experiência do Usuário**
   - Usuários podem errar na confirmação
   - Problemas de rede podem exigir retry
   - Validação de arquivo pode falhar, exigindo nova tentativa

3. **Flexibilidade Operacional**
   - Administradores podem precisar fazer múltiplos restores
   - Testes de disaster recovery
   - Rollbacks sequenciais

### Por que Manter Rate Limiting?

1. **Segurança**
   - Previne ataques de DoS
   - Protege recursos do servidor
   - Evita sobrecarga do banco de dados

2. **Proteção contra Erros**
   - Evita loops acidentais
   - Previne operações duplicadas
   - Dá tempo para reverter erros

3. **Uso Responsável de Recursos**
   - Restore é operação pesada (CPU, I/O, memória)
   - PostgreSQL precisa de recursos durante restore
   - Sistema pode ficar indisponível durante operação

## Configurações Recomendadas

### Desenvolvimento
```typescript
@Throttle({ default: { limit: 10, ttl: 3600000 } }) // 10 por hora
```

### Produção
```typescript
@Throttle({ default: { limit: 3, ttl: 3600000 } }) // 3 por hora
```

### Staging/Testes
```typescript
@Throttle({ default: { limit: 20, ttl: 3600000 } }) // 20 por hora
```

## Como Limpar Contador Manualmente

Se o contador de rate limit precisar ser resetado:

1. **Reiniciar Backend**:
   ```powershell
   Get-Process -Name node | Stop-Process -Force
   npm run start:dev
   ```

2. **Aguardar TTL expirar**: 1 hora no caso do restore

3. **Usar IP diferente**: Rate limiting usa IP como chave

## Melhorias Futuras

### Opção 1: Rate Limiting por Ambiente
```typescript
const restoreLimit = process.env.NODE_ENV === 'production' ? 2 : 10;

@Throttle({ default: { limit: restoreLimit, ttl: 3600000 } })
```

### Opção 2: Configuração via Variável de Ambiente
```typescript
const restoreLimit = parseInt(process.env.RESTORE_RATE_LIMIT || '10', 10);

@Throttle({ default: { limit: restoreLimit, ttl: 3600000 } })
```

### Opção 3: Rate Limiting por Usuário
```typescript
// Usar ID do usuário em vez de IP
@Throttle({ 
  default: { 
    limit: 10, 
    ttl: 3600000,
    keyGenerator: (req) => req.user?.id || req.ip 
  } 
})
```

## Arquivos Modificados

- **`d:\github\2026\apps\backend\src\backup\backup.controller.ts`**
  - Linha 182: Throttle aumentado de 2 para 10 requisições/hora

## Teste

Para validar a correção:

1. ✅ **Reiniciar backend** (já feito)
2. ✅ **Tentar restore** - deve funcionar
3. ✅ **Fazer 10 tentativas sequenciais** - todas devem funcionar
4. ❌ **11ª tentativa** - deve retornar 429
5. ⏱️ **Aguardar 1 hora** - contador deve resetar

## Observações

- Rate limiting usa memória local do backend
- Se backend reiniciar, contador é resetado
- Em cluster/load balancing, considerar Redis para rate limiting compartilhado
- Logs de throttle podem ser encontrados em `@nestjs/throttler`

## Data da Correção

20/01/2026 - 13:21
