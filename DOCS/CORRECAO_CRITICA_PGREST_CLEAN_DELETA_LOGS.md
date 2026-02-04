# Correção Crítica: Log Deletado pelo pg_restore --clean

## Problema Identificado

O restore estava **funcionando corretamente**, mas ao tentar atualizar o log de sucesso, o sistema lançava erro:

```
[Nest] 6556  - 20/01/2026, 13:02:30   ERROR [BackupService] 
Erro ao executar restore: 
Invalid `this.prisma.backupLog.update()` invocation in
D:\github\2026\apps\backend\src\backup\backup.service.ts:673:35

An operation failed because it depends on one or more records that were required but not found. 
Record to update not found.
```

**Local do erro**: Linha 673 - **UPDATE DE SUCESSO** (não no catch de erro)

## Causa Raiz (Descoberta Crítica!)

### O Problema com pg_restore --clean

O comando `pg_restore` estava sendo executado com a flag `--clean`:

```typescript
pg_restore --host=... --clean --if-exists --no-owner --no-acl --verbose "backup.dump"
```

**O que `--clean` faz?**
- Remove **TODOS OS OBJETOS** do banco de dados antes de restaurar
- Executa `DROP TABLE`, `DROP SEQUENCE`, etc.
- Isso inclui **deletar a tabela `backup_logs`** e todos os seus registros!

### Fluxo do Problema

1. ✅ Sistema cria registro em `backup_logs` (linha 625)
2. ✅ Executa backup de segurança
3. ✅ Inicia pg_restore com `--clean`
4. ❌ **pg_restore deleta TODAS as tabelas, incluindo `backup_logs`**
5. ✅ pg_restore restaura dados do backup
6. ❌ Sistema tenta atualizar log que **não existe mais** (linha 673)
7. 💥 **ERRO: Record to update not found**

### Por que isso acontece?

O backup antigo **não contém o registro do restore atual**, então:
- Tabela `backup_logs` é limpa
- Dados antigos são restaurados
- Registro criado na linha 625 **é perdido**

## Solução Implementada

Adicionado **try-catch com recriação** no update de sucesso (similar ao catch de erro):

### Código Anterior (Problemático)

```typescript
// Atualizar log de restore
await this.prisma.backupLog.update({
  where: { id: restoreLog.id },
  data: {
    status: 'SUCCESS',
    completedAt: new Date(),
    durationSeconds,
  },
});
```

❌ Falha se o log foi deletado pelo `--clean`

### Código Novo (Corrigido)

```typescript
// Atualizar log de restore com proteção contra deleção pelo --clean
try {
  await this.prisma.backupLog.update({
    where: { id: restoreLog.id },
    data: {
      status: 'SUCCESS',
      completedAt: new Date(),
      durationSeconds,
    },
  });
} catch (updateError) {
  // Se o log foi deletado pelo pg_restore --clean, criar novo
  this.logger.warn(`Log foi deletado durante restore, recriando: ${updateError.message}`);
  try {
    restoreLog = await this.prisma.backupLog.create({
      data: {
        operationType: 'RESTORE',
        status: 'SUCCESS',
        fileName: file.originalname,
        fileSize: BigInt(file.size),
        executedBy: userId,
        ipAddress,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationSeconds,
        metadata: {
          originalFileName: file.originalname,
          fileSize: file.size,
          recreated: true, // ✅ Flag indicando que foi recriado
        } as any,
      },
    });
  } catch (createError) {
    this.logger.error(`Erro ao recriar log: ${createError.message}`);
    // Continua mesmo se não conseguir criar o log
  }
}
```

✅ Se update falhar, recria o log automaticamente

## Melhorias Implementadas

### 1. Proteção Contra Deleção
```typescript
try {
  await this.prisma.backupLog.update({ ... });
} catch (updateError) {
  // Recria se foi deletado
}
```

### 2. Flag de Rastreamento
```typescript
metadata: {
  recreated: true, // Indica que foi recriado após deleção
}
```
Permite identificar logs que foram recriados.

### 3. Timestamp de Início Preservado
```typescript
startedAt: new Date(startTime),
```
Mantém o tempo real de início do restore.

### 4. Continuidade Garantida
```typescript
catch (createError) {
  this.logger.error(`Erro ao recriar log: ${createError.message}`);
  // Continua mesmo se não conseguir criar o log
}
```
Restore continua funcionando mesmo se falhar ao recriar log.

## Por que não remover --clean?

### Opção 1: Remover --clean (NÃO RECOMENDADO)
```typescript
// SEM --clean
pg_restore --host=... --no-owner --no-acl --verbose "backup.dump"
```

❌ **Problemas**:
- Objetos órfãos permanecem no banco
- Pode causar conflitos de constraints
- Schema pode ficar inconsistente
- Dados antigos podem coexistir com novos

### Opção 2: Manter --clean + Proteção (IMPLEMENTADO)
```typescript
// COM --clean + proteção
pg_restore --host=... --clean --if-exists --no-owner --no-acl --verbose "backup.dump"
```

✅ **Benefícios**:
- Banco é completamente limpo antes do restore
- Garante estado consistente
- Sem objetos órfãos ou conflitos
- Log é recriado automaticamente após restore

## Resultado

Agora o sistema:
1. ✅ Cria log de restore inicial
2. ✅ Executa pg_restore com `--clean` (limpa o banco)
3. ✅ Detecta que log foi deletado
4. ✅ **Recria o log automaticamente**
5. ✅ Registra auditoria corretamente
6. ✅ Retorna sucesso ao usuário

## Logs Esperados

### Sucesso Normal (Update funciona)
```
[BackupService] Iniciando restore: backup_xxx.dump
[BackupService] Criando backup de segurança...
[BackupService] Backup de segurança criado
[BackupService] Executando restore...
[BackupService] Restore concluído com sucesso: backup_xxx.dump
```

### Sucesso com Recriação (Update falha, log recriado)
```
[BackupService] Iniciando restore: backup_xxx.dump
[BackupService] Criando backup de segurança...
[BackupService] Backup de segurança criado
[BackupService] Executando restore...
[BackupService] WARN Log foi deletado durante restore, recriando: ...
[BackupService] Restore concluído com sucesso: backup_xxx.dump
```

## Impacto na Auditoria

Os logs recriados têm a flag `recreated: true` no metadata, permitindo:
- Identificar quais restores tiveram logs recriados
- Diferenciar logs originais de recriados
- Manter rastreabilidade completa
- Análise de comportamento do sistema

## Arquivos Modificados

- **`d:\github\2026\apps\backend\src\backup\backup.service.ts`**
  - Linhas 669-706: Update de sucesso protegido com try-catch

## Teste

Para validar a correção:

1. **Gerar backup** com dados atuais
2. **Fazer restore** do backup
3. ✅ **Verificar**: Sistema deve completar com sucesso
4. ✅ **Verificar logs**: Deve mostrar warning de recriação
5. ✅ **Verificar banco**: Log de restore deve existir com `recreated: true`

## Lições Aprendidas

### 1. pg_restore --clean é Destrutivo
O `--clean` remove **tudo**, incluindo tabelas de sistema/auditoria.

### 2. Logs Devem Ser Resilientes
Sistemas de auditoria devem sobreviver a operações destrutivas.

### 3. Separação de Dados
Em produção, considerar:
- Banco separado para logs/auditoria
- Replicação de logs antes de restore
- Backup incremental de logs

## Alternativas Futuras (Melhoria)

### Opção A: Schema de Auditoria Separado
```sql
CREATE SCHEMA audit;
CREATE TABLE audit.backup_logs (...);

-- pg_restore só limpa schema 'public'
pg_restore --schema=public --clean ...
```

### Opção B: Banco de Dados Separado
```typescript
// Conexão separada para logs
const auditDB = new PrismaClient({ 
  datasources: { db: { url: AUDIT_DATABASE_URL } } 
});
```

### Opção C: Backup de Logs Antes do Restore
```typescript
// Backup da tabela backup_logs antes do restore
await this.backupLogsTable();
await this.executeRestore();
await this.restoreLogsTable();
```

## Data da Correção

20/01/2026 - 13:02

## Prioridade

🔴 **CRÍTICA** - Sistema estava falhando em 100% dos restores bem-sucedidos
