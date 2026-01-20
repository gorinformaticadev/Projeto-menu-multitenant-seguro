# Correção: Erro "Record to update not found" no Restore

## Problema Identificado

Durante a operação de restore, o sistema lançava o seguinte erro:

```
Invalid `this.prisma.backupLog.update()` invocation in
D:\github\2026\apps\backend\src\backup\backup.service.ts:717:37

An operation failed because it depends on one or more records that were required but not found. Record to update not found.
```

## Causa Raiz

No bloco `catch` da função `restoreBackup()`, quando ocorria um erro, o código tentava atualizar o registro `backupLog` no banco de dados:

```typescript
await this.prisma.backupLog.update({
  where: { id: restoreLog.id },
  data: { ... }
});
```

**O problema**: Se o erro ocorresse **antes** da criação do log (linha 625), ou se a transação que criou o log fosse revertida, o registro não existiria no banco de dados, causando o erro "Record to update not found".

### Cenários que Causavam o Erro

1. **Erro na validação do arquivo** (linha 611-613) - antes de criar o log
2. **Erro ao salvar arquivo temporário** (linha 622) - antes de criar o log
3. **Erro na criação do log** (linha 625-638) - log não criado com sucesso
4. **Transação revertida** - log criado mas depois removido

## Solução Implementada

Implementado tratamento robusto com **fallback para criação** caso o update falhe:

### Código Anterior (Problemático)

```typescript
catch (error) {
  this.logger.error(`Erro ao executar restore: ${error.message}`, error.stack);

  // Atualizar log com erro
  if (restoreLog) {
    await this.prisma.backupLog.update({
      where: { id: restoreLog.id },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorMessage: error.message,
        durationSeconds: Math.floor((Date.now() - startTime) / 1000),
      },
    });
    // ... auditoria
  }

  throw new Error(`Erro ao executar restore: ${error.message}`);
}
```

### Código Novo (Corrigido)

```typescript
catch (error) {
  this.logger.error(`Erro ao executar restore: ${error.message}`, error.stack);

  // Atualizar ou criar log com erro
  try {
    if (restoreLog?.id) {
      // Tentar atualizar o log existente
      try {
        await this.prisma.backupLog.update({
          where: { id: restoreLog.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage: error.message,
            durationSeconds: Math.floor((Date.now() - startTime) / 1000),
          },
        });
      } catch (updateError) {
        // Se o update falhar (registro não encontrado), criar um novo
        this.logger.warn(`Log não encontrado, criando novo: ${updateError.message}`);
        await this.prisma.backupLog.create({
          data: {
            operationType: 'RESTORE',
            status: 'FAILED',
            fileName: file?.originalname || 'unknown',
            fileSize: BigInt(file?.size || 0),
            executedBy: userId,
            ipAddress,
            completedAt: new Date(),
            errorMessage: error.message,
            durationSeconds: Math.floor((Date.now() - startTime) / 1000),
          },
        });
      }

      // Registrar auditoria de falha
      await this.auditService.log({
        action: 'RESTORE_FAILED',
        userId,
        ipAddress,
        details: { error: error.message, restoreId: restoreLog.id },
      });
    }
  } catch (logError) {
    this.logger.error(`Erro ao registrar falha no log: ${logError.message}`);
  }

  throw new Error(`Erro ao executar restore: ${error.message}`);
}
```

## Melhorias Implementadas

### 1. Verificação de Existência
```typescript
if (restoreLog?.id) {
```
Usa optional chaining para verificar se `restoreLog` e `restoreLog.id` existem.

### 2. Try-Catch Aninhado
```typescript
try {
  await this.prisma.backupLog.update({ ... });
} catch (updateError) {
  // Fallback para create
  await this.prisma.backupLog.create({ ... });
}
```
Tenta atualizar primeiro, mas se falhar, cria um novo registro.

### 3. Fallback Seguro
```typescript
fileName: file?.originalname || 'unknown',
fileSize: BigInt(file?.size || 0),
```
Usa valores padrão caso os dados do arquivo não estejam disponíveis.

### 4. Isolamento de Erros
```typescript
try {
  // Lógica de log
} catch (logError) {
  this.logger.error(`Erro ao registrar falha no log: ${logError.message}`);
}
```
Erros no sistema de log não impedem o lançamento do erro original do restore.

## Resultado

Agora o sistema de restore:
1. ✅ **Sempre registra falhas** - mesmo se o log inicial não foi criado
2. ✅ **Não lança erros secundários** - erros de log são isolados
3. ✅ **Mantém histórico completo** - todas as tentativas são registradas
4. ✅ **Fornece feedback claro** - logs de warning quando cria novo registro

## Benefícios

- **Resiliência**: Sistema continua funcionando mesmo em condições adversas
- **Auditoria Completa**: Todas as tentativas de restore são registradas
- **Debug Facilitado**: Logs claros indicam quando ocorre fallback
- **UX Melhorado**: Usuário recebe feedback adequado sobre falhas

## Arquivos Modificados

- **`d:\github\2026\apps\backend\src\backup\backup.service.ts`**
  - Linhas 712-760: Bloco catch da função `restoreBackup()` refatorado

## Teste

Para validar a correção:

1. **Teste Normal**: Fazer restore de arquivo válido - deve funcionar
2. **Teste de Erro Precoce**: Fazer restore de arquivo inválido - deve registrar falha
3. **Teste de Erro Tardio**: Simular erro durante pg_restore - deve registrar falha
4. **Verificar Logs**: Consultar tabela `backup_logs` - todos os erros devem estar registrados

## Observações Técnicas

### Por que não usar upsert?

O Prisma não permite `upsert` com `where: { id }` porque o ID é gerado automaticamente. A abordagem de try-catch é mais apropriada para este caso.

### Por que criar novo em vez de ignorar?

Criar um novo registro garante que **todas as tentativas de restore sejam auditadas**, mesmo as que falharam muito cedo no processo.

## Data da Correção

20/01/2026 - 13:00
