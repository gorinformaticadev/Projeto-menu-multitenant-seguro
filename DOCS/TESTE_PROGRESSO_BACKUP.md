# 🧪 Guia de Teste - Progresso em Tempo Real do Backup

## ✅ O Que Foi Implementado

Agora o backup **mostra em tempo real o que está sendo copiado**, resolvendo o problema: 
> "Backup só criando e não vai. Ao menos deve ter um retorno do que está sendo copiado no momento"

---

## 🚀 Como Testar

### 1. Iniciar o Sistema

```powershell
# Terminal 1 - Backend
cd D:\github\2026\apps\backend
npm run start:dev

# Terminal 2 - Frontend  
cd D:\github\2026\apps\frontend
npm run dev
```

---

### 2. Acessar a Página

1. Abrir navegador: `http://localhost:3000`
2. Fazer login como **SUPER_ADMIN**
3. Navegar para: **Configurações → Sistema → Updates**
4. Clicar na aba: **"Backup & Restore"**

---

### 3. Executar Backup com Progresso

1. **Clicar em:** "Criar Backup Agora"

2. **Observar o que aparece na tela:**

```
┌────────────────────────────────────────────────────┐
│ 🔄 Processando backup...                           │
│ Executando pg_dump - processando tabela users...  │
│                                                     │
│ 📋 Log de progresso:                               │
│ • Iniciando backup do banco de dados...           │
│ • Executando pg_dump - iniciando exportação...    │
│ • pg_dump: processing table public.users          │
│ • pg_dump: processing table public.tenants        │
│ • pg_dump: creating indexes                       │
│                                                     │
│ Tempo decorrido: 12s     🔵 Em andamento          │
│ [████████████▓▓▓▓▓▓▓▓] 70%                        │
│                                                     │
│ ⚠ Aguarde... Isso pode levar alguns minutos...    │
└────────────────────────────────────────────────────┘
```

3. **Verificar:**
   - ✅ Mensagens aparecem em tempo real (conforme o backup processa)
   - ✅ Log mostra as últimas 5 mensagens
   - ✅ Timer atualiza a cada segundo
   - ✅ Mensagens mudam conforme o pg_dump processa

---

### 4. Verificar Console do Navegador (F12)

Abrir DevTools (F12) e verificar a aba **Console**:

**✅ Deve mostrar:**
```
EventSource conectado: /api/backup/progress/backup_1737415200123_abc123
Recebendo progresso: { message: "Iniciando backup...", timestamp: 1737415200125 }
Recebendo progresso: { message: "Executando pg_dump...", timestamp: 1737415202340 }
Recebendo progresso: { message: "pg_dump: processing table public.users", timestamp: 1737415204567 }
...
Conexão SSE fechada
```

**❌ Se aparecer erro:**
```
EventSource failed: Network error
CORS error
401 Unauthorized
```
→ Verificar se backend está rodando e autenticação está funcionando

---

### 5. Verificar Logs do Backend

No terminal do backend, deve aparecer:

```
[BackupController] Criando backup com sessionId: backup_1737415200123_abc123
[BackupService] Iniciando backup: backup_system2026_2026-01-20T15-30-00.dump
[BackupService] Executando pg_dump...
[BackupService] Progresso: pg_dump: processing table public.users
[BackupService] Progresso: pg_dump: processing table public.tenants
[BackupService] Progresso: pg_dump: processing table public.ordem_servico
[BackupService] Progresso: pg_dump: processing table public.equipment
[BackupService] Progresso: pg_dump: creating indexes
[BackupService] Progresso: pg_dump: writing constraints
[BackupService] Backup exportado com sucesso, validando arquivo...
[BackupService] Calculando checksum de integridade...
[BackupService] Backup finalizado: backup_system2026_2026-01-20.dump (45.23 MB)
[BackupService] Backup criado com sucesso (15 segundos)
```

---

## 🎯 Validações

### ✅ Checklist de Sucesso:

- [ ] **SSE conecta** - Console mostra EventSource conectado
- [ ] **Mensagens aparecem em tempo real** - UI atualiza conforme backend processa
- [ ] **Log visível** - Últimas 5 mensagens aparecem na caixa de log
- [ ] **Timer funciona** - Contador de segundos atualiza
- [ ] **Progresso do pg_dump** - Mensagens mostram tabelas sendo processadas
- [ ] **Conclusão** - Mensagem final "Backup concluído!" aparece
- [ ] **Download inicia** - Arquivo é baixado automaticamente
- [ ] **Toast de sucesso** - Notificação com nome e tamanho do arquivo

---

## 🐛 Troubleshooting

### Problema: "Aguardando resposta..." fica parado

**Causa:** SSE não conectou

**Solução:**
```powershell
# Verificar se backend está rodando
curl http://localhost:3001/api/backup/progress/test123

# Deve retornar erro 401 (é esperado - significa que endpoint existe)
# Se retornar 404, o endpoint não foi registrado corretamente
```

---

### Problema: Nenhuma mensagem de progresso aparece

**Causa:** Callback não está sendo chamado

**Verificar:**
1. Logs do backend - deve mostrar `[BackupService] Progresso: ...`
2. Se logs aparecem no backend mas não no frontend → problema no SSE
3. Se logs não aparecem → callback não está sendo passado

**Solução:**
```typescript
// Verificar em backup.controller.ts se tem:
const progressCallback = (message: string) => {
  const subject = this.progressSubjects.get(sessionId);
  if (subject) {
    subject.next({ data: { message, timestamp: Date.now() } } as MessageEvent);
  }
};

const result = await this.backupService.createBackup(dto, userId, ipAddress, progressCallback);
```

---

### Problema: CORS error no SSE

**Causa:** EventSource não está enviando credenciais

**Verificar frontend:**
```typescript
const eventSource = new EventSource(
  `${apiUrl}/api/backup/progress/${sessionId}`,
  { withCredentials: true } // ✅ DEVE estar presente
);
```

**Verificar backend** - `main.ts` deve ter:
```typescript
app.enableCors({
  origin: ['http://localhost:3000'],
  credentials: true,
});
```

---

### Problema: "A propriedade 'backupLog' não existe no tipo 'PrismaService'"

**Causa:** Cache do TypeScript desatualizado

**Solução:**
```powershell
cd D:\github\2026\apps\backend

# 1. Matar processos Node.js
taskkill /F /IM node.exe

# 2. Regenerar Prisma Client
npx prisma generate

# 3. Recompilar
npm run build

# 4. Reiniciar backend
npm run start:dev
```

---

## 📊 Exemplo de Output Esperado

### Frontend (UI):
```
┌─────────────────────────────────────────────────────────┐
│ 🔄 Processando backup...                                │
│ pg_dump: processing table public.ordem_servico          │
│                                                          │
│ 📋 Log de progresso:                                    │
│ • Executando pg_dump - iniciando exportação...         │
│ • pg_dump: processing table public.users               │
│ • pg_dump: processing table public.tenants             │
│ • pg_dump: processing table public.ordem_servico       │
│ • pg_dump: creating indexes                            │
│                                                          │
│ Tempo decorrido: 18s     🔵 Em andamento               │
│ [████████████████▓▓▓▓▓▓] 70%                           │
│                                                          │
│ ⚠ Aguarde... Isso pode levar alguns minutos...         │
└─────────────────────────────────────────────────────────┘
```

### Backend (Console):
```
[NestApplication] Nest application successfully started
[BackupController] POST /api/backup/create - sessionId: backup_1737415200_xyz
[BackupService] Iniciando backup: backup_system2026_2026-01-20.dump
[BackupService] Executando pg_dump com flag --verbose
[BackupService] Progresso: pg_dump: last built-in OID is 16383
[BackupService] Progresso: pg_dump: reading extensions
[BackupService] Progresso: pg_dump: identifying extension members
[BackupService] Progresso: pg_dump: reading schemas
[BackupService] Progresso: pg_dump: reading user-defined tables
[BackupService] Progresso: pg_dump: reading user-defined functions
[BackupService] Progresso: pg_dump: reading user-defined types
[BackupService] Progresso: pg_dump: reading procedural languages
[BackupService] Progresso: pg_dump: reading user-defined aggregate functions
[BackupService] Progresso: pg_dump: reading user-defined operators
[BackupService] Progresso: pg_dump: reading user-defined access methods
[BackupService] Progresso: pg_dump: reading user-defined operator classes
[BackupService] Progresso: pg_dump: reading user-defined operator families
[BackupService] Progresso: pg_dump: reading user-defined text search parsers
[BackupService] Progresso: pg_dump: reading user-defined text search templates
[BackupService] Progresso: pg_dump: reading user-defined text search dictionaries
[BackupService] Progresso: pg_dump: reading user-defined text search configurations
[BackupService] Progresso: pg_dump: reading user-defined foreign-data wrappers
[BackupService] Progresso: pg_dump: reading user-defined foreign servers
[BackupService] Progresso: pg_dump: reading default privileges
[BackupService] Progresso: pg_dump: reading user-defined collations
[BackupService] Progresso: pg_dump: reading user-defined conversions
[BackupService] Progresso: pg_dump: reading type casts
[BackupService] Progresso: pg_dump: reading transforms
[BackupService] Progresso: pg_dump: reading table inheritance information
[BackupService] Progresso: pg_dump: reading event triggers
[BackupService] Progresso: pg_dump: finding extension tables
[BackupService] Progresso: pg_dump: finding inheritance relationships
[BackupService] Progresso: pg_dump: reading column info for interesting tables
[BackupService] Progresso: pg_dump: flagging inherited columns in subtables
[BackupService] Progresso: pg_dump: reading indexes
[BackupService] Progresso: pg_dump: flagging indexes in partitioned tables
[BackupService] Progresso: pg_dump: reading extended statistics
[BackupService] Progresso: pg_dump: reading constraints
[BackupService] Progresso: pg_dump: reading triggers
[BackupService] Progresso: pg_dump: reading rewrite rules
[BackupService] Progresso: pg_dump: reading policies
[BackupService] Progresso: pg_dump: reading publications
[BackupService] Progresso: pg_dump: reading publication membership
[BackupService] Progresso: pg_dump: reading subscriptions
[BackupService] Progresso: pg_dump: reading large objects
[BackupService] Progresso: pg_dump: reading dependency data
[BackupService] Progresso: pg_dump: saving encoding = UTF8
[BackupService] Progresso: pg_dump: saving standard_conforming_strings = on
[BackupService] Progresso: pg_dump: saving search_path = 
[BackupService] Progresso: pg_dump: creating SCHEMA "public"
[BackupService] Progresso: pg_dump: creating TABLE "public"."User"
[BackupService] Progresso: pg_dump: creating TABLE "public"."Tenant"
[BackupService] Progresso: pg_dump: creating TABLE "public"."OrdemServico"
[BackupService] Backup exportado com sucesso, validando arquivo...
[BackupService] Calculando checksum de integridade...
[BackupService] Backup finalizado: backup_system2026_2026-01-20.dump (45.23 MB)
[BackupService] Backup criado com sucesso em 18 segundos
[AuditService] BACKUP_SUCCESS - userId: xxx, backupId: yyy
```

---

## ✅ Conclusão do Teste

Se você ver **mensagens de progresso em tempo real** aparecendo na UI e no console do backend conforme o backup é processado, a implementação está funcionando corretamente! ✨

O usuário agora consegue ver **exatamente o que está sendo copiado no momento**, resolvendo completamente o problema reportado.

---

## 📞 Suporte

Se algum problema persistir:

1. Verificar logs do backend em tempo real
2. Verificar console do navegador (F12)
3. Verificar Network tab do DevTools - deve ter conexão SSE ativa
4. Verificar se `pg_dump` tem flag `--verbose` no comando (linha 240 de `backup.service.ts`)

---

**Documentação criada em:** 20/01/2026  
**Autor:** Sistema de Backup & Restore  
**Versão:** 1.0.0
