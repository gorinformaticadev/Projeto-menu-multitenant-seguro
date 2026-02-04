# Correção: pg_dump pedindo senha interativamente

## Problema Identificado

Durante a execução do backup, o `pg_dump` estava **pedindo senha interativamente** no terminal do backend:

```
[Nest] 12784  - 20/01/2026, 10:47:41     LOG [BackupService] Iniciando backup: backup_multitenant_db_2026-01-20T13-47-41.dump
[Nest] 12784  - 20/01/2026, 10:47:41     LOG [BackupService] Executando pg_dump...
Senha: 
```

Isso travava o processo porque:
1. O comando `pg_dump` não estava recebendo a senha automaticamente
2. O processo ficava aguardando entrada interativa no terminal
3. O frontend ficava esperando indefinidamente
4. Nenhum feedback de erro era retornado

## Causa Raiz

O método `executeCommand` no `BackupService` não estava passando a variável de ambiente `PGPASSWORD` para o processo filho (`child_process.exec`). 

O PostgreSQL, por padrão, pede senha interativamente quando:
- A senha não está em `PGPASSWORD`
- Não existe arquivo `.pgpass` configurado
- A autenticação não é configurada como `trust` no `pg_hba.conf`

## Solução Implementada

### 1. Atualização do método `executeCommand`

**Arquivo**: `apps/backend/src/backup/backup.service.ts`

**Antes**:
```typescript
private async executeCommand(
  command: string,
  timeoutMs: number,
  onProgress?: (data: string) => void,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const childProcess = exec(command, { 
      timeout: timeoutMs, 
      maxBuffer: 1024 * 1024 * 10 
    });
    // ...
  });
}
```

**Depois**:
```typescript
private async executeCommand(
  command: string,
  timeoutMs: number,
  onProgress?: (data: string) => void,
  password?: string, // ✅ Novo parâmetro
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    // Preparar variáveis de ambiente incluindo PGPASSWORD
    const env = { ...process.env };
    if (password) {
      env.PGPASSWORD = password; // ✅ Define senha no ambiente
    }

    const childProcess = exec(command, { 
      timeout: timeoutMs, 
      maxBuffer: 1024 * 1024 * 10,
      env, // ✅ Passa variáveis de ambiente com PGPASSWORD
    });
    // ...
  });
}
```

### 2. Passagem da senha na chamada

**Linha 117-125**:

**Antes**:
```typescript
await this.executeCommand(command, this.timeout, (progress) => {
  // Log do progresso para debug e envio para frontend
  if (progress.trim()) {
    this.logger.debug(`pg_dump: ${progress.trim()}`);
    if (onProgress) {
      onProgress(progress.trim());
    }
  }
});
```

**Depois**:
```typescript
await this.executeCommand(command, this.timeout, (progress) => {
  // Log do progresso para debug e envio para frontend
  if (progress.trim()) {
    this.logger.debug(`pg_dump: ${progress.trim()}`);
    if (onProgress) {
      onProgress(progress.trim());
    }
  }
}, dbConfig.password); // ✅ Passar senha para evitar prompt interativo
```

## Como Funciona

1. O `parseDatabaseUrl()` extrai a senha da `DATABASE_URL`
2. A senha é passada como parâmetro para `executeCommand`
3. `executeCommand` define `PGPASSWORD` no ambiente do processo
4. O `pg_dump` lê `PGPASSWORD` automaticamente
5. Nenhum prompt interativo é exibido

## Variável de Ambiente PGPASSWORD

A variável `PGPASSWORD` é uma funcionalidade oficial do PostgreSQL que permite passar a senha sem interação:

```bash
# Exemplo de uso manual
PGPASSWORD=minhasenha pg_dump -U usuario -d database > backup.sql
```

No código, isso é feito automaticamente ao definir `env.PGPASSWORD` nas opções do `exec`.

## Verificação da Correção

### Backend
Após reiniciar o backend, ao criar um backup você deve ver:
```
[Nest] 10756  - 20/01/2026, 10:50:41     LOG [BackupService] Iniciando backup: backup_multitenant_db_2026-01-20T13-50-41.dump
[Nest] 10756  - 20/01/2026, 10:50:41     LOG [BackupService] Executando pg_dump...
[Nest] 10756  - 20/01/2026, 10:50:42     DEBUG [BackupService] pg_dump: dumping contents of table public.tenants
[Nest] 10756  - 20/01/2026, 10:50:43     DEBUG [BackupService] pg_dump: dumping contents of table public.users
...
```

**SEM** o prompt `Senha:` aparecendo.

### Frontend
O progresso deve ser exibido em tempo real:
- "Executando pg_dump - iniciando exportação..."
- "dumping contents of table public.tenants"
- "dumping contents of table public.users"
- "Backup exportado com sucesso, validando arquivo..."
- "Calculando checksum de integridade..."
- "Backup finalizado: backup_xxx.dump (XX.XX MB)"

## Próximos Passos

1. ✅ Correção implementada
2. ⏳ Testar criação de backup no frontend
3. ⏳ Verificar progresso em tempo real
4. ⏳ Confirmar download automático do arquivo

## Nota de Segurança

A senha é passada **apenas** através da variável de ambiente `PGPASSWORD` no processo filho, que é:
- **Isolado**: Cada processo tem seu próprio ambiente
- **Temporário**: A variável existe apenas durante a execução do comando
- **Não logado**: Não aparece em logs ou stdout

A senha original permanece segura na `DATABASE_URL` que já é armazenada como variável de ambiente protegida.

---

**Data da Correção**: 20/01/2026 10:50
**Arquivos Modificados**: 
- `apps/backend/src/backup/backup.service.ts` (linhas 117-125, 270-287)
