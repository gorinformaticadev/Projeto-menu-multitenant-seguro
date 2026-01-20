# Guia de Teste - Backup e Restore

## ✅ Status da Implementação

A funcionalidade foi implementada com sucesso! O build do backend passou sem erros.

## Como Testar

### Pré-requisitos
1. Sistema rodando (backend e frontend)
2. Usuário com permissão SUPER_ADMIN
3. PostgreSQL instalado no servidor com `pg_dump` e `pg_restore` disponíveis

### Teste 1: Criar Backup

1. Faça login como SUPER_ADMIN
2. Acesse: `/configuracoes/sistema/updates`
3. Clique na aba "Backup & Restore"
4. Clique em "Criar Backup Agora"
5. Aguarde o processamento
6. O download deve iniciar automaticamente
7. Verifique que o arquivo `.dump` foi baixado

**Esperado:**
- Toast de sucesso
- Arquivo de backup baixado
- Operação registrada no histórico

### Teste 2: Validar Arquivo

1. Na mesma página, seção "Restaurar Backup"
2. Selecione o arquivo de backup que acabou de baixar
3. Sistema deve validar automaticamente
4. Deve aparecer mensagem "Arquivo Válido" em verde

**Esperado:**
- Validação automática ao selecionar arquivo
- Feedback visual com checkmark verde
- Informações do arquivo exibidas

### Teste 3: Restaurar Backup

⚠️ **ATENÇÃO**: Este teste é destrutivo!

1. Com arquivo válido selecionado
2. Clique em "Restaurar Backup"
3. Leia os avisos no modal
4. Digite "CONFIRMAR" no campo
5. Clique em "Confirmar Restore"
6. Aguarde conclusão

**Esperado:**
- Modal de confirmação exibido
- Backup de segurança criado automaticamente
- Restore executado com sucesso
- Toast de confirmação
- Operação registrada no histórico

### Teste 4: Verificar Histórico

1. Role para baixo na aba "Backup & Restore"
2. Verifique a seção "Histórico de Backups e Restores"
3. Devem aparecer as operações realizadas

**Esperado:**
- Lista de operações com:
  - Tipo (Backup/Restore)
  - Status
  - Nome do arquivo
  - Tamanho
  - Duração
  - Usuário executor
  - Data/hora

### Teste 5: Validação de Segurança

1. Tente acessar com usuário não-SUPER_ADMIN
2. Endpoints devem retornar 403 Forbidden

**Esperado:**
- Acesso negado para usuários sem permissão

## Troubleshooting

### Erro: "pg_dump: command not found"

**Solução:** Instalar PostgreSQL client tools no servidor:
```bash
# Ubuntu/Debian
sudo apt-get install postgresql-client

# Windows
# Adicionar pasta bin do PostgreSQL ao PATH
# Ex: C:\Program Files\PostgreSQL\15\bin
```

### Erro: "EPERM: operation not permitted"

**Solução:** 
```bash
# Parar todos os processos Node.js
taskkill /F /IM node.exe

# Regenerar Prisma Client
cd apps/backend
npx prisma generate
```

### Erro: "User ID é obrigatório"

**Solução:** Verifique se está autenticado e o JWT contém o userId (sub).

### Arquivo de backup muito grande

**Ajuste:** Aumentar o limite no `.env`:
```env
BACKUP_MAX_SIZE=5368709120  # 5GB
```

### Timeout durante operação

**Ajuste:** Aumentar timeout no `.env`:
```env
BACKUP_TIMEOUT=1800  # 30 minutos
```

## Comandos Úteis

### Verificar logs de backup no banco
```sql
SELECT * FROM backup_logs ORDER BY started_at DESC LIMIT 10;
```

### Limpar arquivos temporários manualmente
```bash
cd apps/backend/temp/backups
rm -rf *
```

### Testar comandos PostgreSQL manualmente
```bash
# Teste pg_dump
pg_dump --host=localhost --port=5432 --username=postgres --dbname=multitenant_db --format=custom --file=test.dump

# Teste pg_restore
pg_restore --host=localhost --port=5432 --username=postgres --dbname=multitenant_db --list test.dump
```

## Checklist de Validação

- [ ] Backup criado com sucesso
- [ ] Arquivo de backup baixado
- [ ] Arquivo validado corretamente
- [ ] Restore executado com sucesso
- [ ] Backup de segurança criado antes do restore
- [ ] Histórico de operações exibido
- [ ] Operações registradas no banco
- [ ] Auditoria funcionando
- [ ] Acesso restrito a SUPER_ADMIN
- [ ] Rate limiting aplicado
- [ ] Erros tratados adequadamente

## Notas Importantes

1. **Backup de Segurança**: Antes de cada restore, um backup automático é criado e mantido por 3 horas
2. **Rate Limiting**: 
   - Backups: máximo 5 por hora
   - Restores: máximo 2 por hora
3. **Tamanho Máximo**: 2GB por padrão (configurável)
4. **Timeout**: 15 minutos por padrão (configurável)
5. **Formato**: Usa formato custom do PostgreSQL (`.dump`) para melhor compressão

## Suporte

Em caso de problemas, verificar:
1. Logs do backend: `apps/backend/logs/`
2. Tabela de auditoria: `audit_logs`
3. Tabela de backup logs: `backup_logs`
4. Console do navegador (F12) para erros no frontend
