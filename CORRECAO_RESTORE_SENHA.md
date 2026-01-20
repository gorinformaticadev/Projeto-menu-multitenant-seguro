# Correção: Senha no Comando pg_restore

## Problema Identificado

Durante a operação de restore (restauração) do banco de dados, o sistema ficava travado na tela "Restaurando..." e o terminal do backend exibia:

```
Senha:
```

Isso indicava que o comando `pg_restore` estava solicitando a senha interativamente, bloqueando a execução.

## Causa Raiz

A função `restoreBackup()` no `BackupService` executava dois comandos PostgreSQL:
1. **Backup de segurança** (pg_dump) - antes do restore
2. **Restore** (pg_restore) - para restaurar os dados

Ambos os comandos **não estavam recebendo a senha** via variável de ambiente `PGPASSWORD`, fazendo com que o PostgreSQL solicitasse a senha interativamente no terminal.

### Código Problemático

**Linha 656** - Backup de segurança:
```typescript
await this.executeCommand(backupCommand, this.timeout);
// ❌ Faltando o parâmetro password
```

**Linha 662** - Restore:
```typescript
await this.executeCommand(restoreCommand, this.timeout, (progress) => {
  if (progress.trim()) {
    this.logger.debug(`pg_restore: ${progress.trim()}`);
  }
});
// ❌ Faltando o parâmetro password
```

## Solução Implementada

Adicionado o parâmetro `dbConfig.password` nas chamadas de `executeCommand()` para **ambos os comandos** durante o processo de restore:

### Código Corrigido

**Linha 656** - Backup de segurança:
```typescript
await this.executeCommand(backupCommand, this.timeout, null, dbConfig.password);
// ✅ Senha adicionada via 4º parâmetro
```

**Linha 662** - Restore:
```typescript
await this.executeCommand(restoreCommand, this.timeout, (progress) => {
  if (progress.trim()) {
    this.logger.debug(`pg_restore: ${progress.trim()}`);
  }
}, dbConfig.password);
// ✅ Senha adicionada via 4º parâmetro
```

### Como Funciona

A função `executeCommand()` recebe a senha e a injeta no ambiente do processo filho:

```typescript
private async executeCommand(
  command: string,
  timeoutMs: number,
  onProgress?: (data: string) => void,
  password?: string, // ✅ Parâmetro de senha
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    if (password) {
      env.PGPASSWORD = password; // ✅ Define PGPASSWORD no ambiente
    }

    const childProcess = exec(command, { 
      timeout: timeoutMs, 
      maxBuffer: 1024 * 1024 * 10,
      env, // ✅ Passa ambiente com senha
    });
    // ...
  });
}
```

## Resultado

Agora o processo de restore:
1. ✅ Cria backup de segurança **sem solicitar senha**
2. ✅ Executa restore **sem solicitar senha**
3. ✅ Não trava na tela de "Restaurando..."
4. ✅ Completa a operação com sucesso

## Arquivos Modificados

- **`d:\github\2026\apps\backend\src\backup\backup.service.ts`**
  - Linha 656: Adicionada senha no backup de segurança
  - Linha 667: Adicionada senha no comando pg_restore

## Teste

Para testar:
1. Gerar um backup via interface
2. Fazer upload do mesmo arquivo para restore
3. Confirmar operação de restore
4. ✅ Sistema deve restaurar sem pedir senha no terminal
5. ✅ Interface deve mostrar progresso e conclusão

## Histórico de Correções Relacionadas

Este problema é similar ao resolvido anteriormente no backup:
- **Correção Anterior**: [`CORRECAO_PGDUMP_SENHA.md`](./CORRECAO_PGDUMP_SENHA.md) - Adicionada senha no pg_dump
- **Correção Atual**: Adicionada senha também no pg_restore e no backup de segurança

## Data da Correção

20/01/2026 - 12:57
