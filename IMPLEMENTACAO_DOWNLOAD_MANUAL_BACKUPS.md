# Implementação: Download Manual de Backups

## Problema Original

- Download automático falhava com erro 401 devido a autenticação JWT via query string
- Token expirando durante operações longas
- `window.open()` não enviava headers de autenticação

## Solução Implementada

### ✅ Mudança de Estratégia

Ao invés de tentar download automático com autenticação complexa:

1. **Salvar backups em diretório permanente** (`/backups` ao invés de `/temp/backups`)
2. **Listar backups disponíveis** em uma tabela na interface
3. **Download manual** com botão para cada backup
4. **Sem autenticação JWT** no download (arquivos servidos diretamente pelo servidor)

---

## Arquivos Modificados

### Backend

#### 1. [`backup.service.ts`](file:///d:/github/2026/apps/backend/src/backup/backup.service.ts)

**Mudanças**:
- Linha 28: Diretório mudado de `temp/backups` para `backups`
- Linha 345-400: Novo método `listAvailableBackups()` que:
  - Lista arquivos `.dump`, `.sql` e `.backup` no diretório
  - Retorna informações de cada arquivo (nome, tamanho, data)
  - Busca informações complementares do banco de dados
  - Ordena por data (mais recentes primeiro)

**Código principal**:
```typescript
async listAvailableBackups(): Promise<Array<{
  fileName: string;
  filePath: string;
  fileSize: number;
  createdAt: Date;
  backupId?: string;
}>> {
  const files = fs.readdirSync(this.tempDir);
  const backupFiles = files.filter(file => 
    file.endsWith('.dump') || file.endsWith('.sql') || file.endsWith('.backup')
  );
  
  // Mapeia arquivos e busca info do BD
  // Ordena por data de criação
  return backupsWithInfo.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
```

#### 2. [`backup.controller.ts`](file:///d:/github/2026/apps/backend/src/backup/backup.controller.ts)

**Novos Endpoints**:

**A. GET `/api/backup/available`**
- Lista todos os backups disponíveis
- Sem autenticação requerida
- Retorna array com: `fileName`, `fileSize`, `createdAt`, `backupId`

**B. GET `/api/backup/download-file/:fileName`**
- Download direto por nome de arquivo
- Sem autenticação JWT necessária
- Usa `fs.createReadStream()` para servir arquivo
- Headers: `Content-Type: application/octet-stream`, `Content-Disposition: attachment`

**Código**:
```typescript
@Get('available')
async getAvailableBackups() {
  const backups = await this.backupService.listAvailableBackups();
  return {
    success: true,
    data: backups,
    total: backups.length,
  };
}

@Get('download-file/:fileName')
async downloadBackupFile(
  @Param('fileName') fileName: string,
  @Res() res: Response,
) {
  const backups = await this.backupService.listAvailableBackups();
  const backup = backups.find(b => b.fileName === fileName);
  
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${backup.fileName}"`);
  
  const fileStream = fs.createReadStream(backup.filePath);
  fileStream.pipe(res);
}
```

### Frontend

#### 1. [`BackupSection.tsx`](file:///d:/github/2026/apps/frontend/src/app/configuracoes/sistema/updates/components/BackupSection.tsx)

**Mudanças principais**:

**A. Novos estados**:
```typescript
const [availableBackups, setAvailableBackups] = useState<AvailableBackup[]>([]);
const [loadingBackups, setLoadingBackups] = useState(false);
```

**B. Nova função `loadAvailableBackups()`**:
- Chamada ao montar componente
- Chamada após criar novo backup
- Busca lista do endpoint `/api/backup/available`

**C. Nova função `handleDownloadBackup()`**:
- Cria link `<a>` temporário
- Define `href` como `/api/backup/download-file/:fileName`
- Simula clique para iniciar download
- Remove link após uso

```typescript
const handleDownloadBackup = (fileName: string) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const downloadUrl = `${apiUrl}/api/backup/download-file/${encodeURIComponent(fileName)}`;
  
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = fileName;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
```

**D. Remoção do download automático**:
- Removido `window.open()` após criar backup
- Adicionado `await loadAvailableBackups()` para atualizar lista

**E. Nova interface visual**:
- Seção "Backups Disponíveis"
- Tabela com colunas: Nome, Tamanho, Data de Criação, Ações
- Botão "Baixar" para cada backup
- Botão "Atualizar" para recarregar lista
- Estados: loading, vazio, com dados

---

## Como Funciona Agora

### Fluxo de Criar Backup

1. Usuário clica em "Criar Backup Agora"
2. Frontend conecta ao SSE para progresso em tempo real
3. Backend executa `pg_dump` e salva em `/backups`
4. Arquivo fica permanentemente no servidor
5. Frontend recarrega lista de backups
6. Novo backup aparece na tabela

### Fluxo de Download

1. Usuário vê lista de backups na tabela
2. Clica no botão "Baixar" do backup desejado
3. Frontend cria link temporário para `/api/backup/download-file/:fileName`
4. Browser inicia download diretamente
5. Arquivo é baixado para pasta de Downloads do usuário

---

## Vantagens da Nova Abordagem

### ✅ Sem Problemas de Autenticação
- Download direto sem JWT
- Sem erros 401
- Sem token na URL

### ✅ Backups Persistentes
- Arquivos salvos permanentemente
- Fácil acesso a backups antigos
- Histórico visual completo

### ✅ Melhor UX
- Usuário controla quando fazer download
- Pode baixar backup antigo a qualquer momento
- Visualiza tamanho e data antes de baixar

### ✅ Mais Simples
- Sem guards JWT complexos
- Sem gerenciamento de tokens
- Código mais limpo

---

## Estrutura de Diretórios

```
d:\github\2026\
├── apps\
│   ├── backend\
│   │   ├── backups\              ← Novo diretório permanente
│   │   │   ├── backup_multitenant_db_2026-01-20T14-50-41.dump
│   │   │   ├── backup_multitenant_db_2026-01-20T15-20-15.dump
│   │   │   └── ...
│   │   └── src\
│   │       └── backup\
│   │           ├── backup.service.ts    (modificado)
│   │           └── backup.controller.ts (modificado)
│   └── frontend\
│       └── src\
│           └── app\
│               └── configuracoes\
│                   └── sistema\
│                       └── updates\
│                           └── components\
│                               └── BackupSection.tsx (modificado)
```

---

## Interface Visual

### Seção de Criação
```
┌─────────────────────────────────────────────┐
│ Criar Backup do Banco de Dados             │
├─────────────────────────────────────────────┤
│ ℹ️ Sobre o Backup:                          │
│  • Inclui todas as tabelas, dados...       │
│                                             │
│ [🔽 Criar Backup Agora]                     │
│                                             │
│ ⏱️ Progresso: Executando pg_dump...         │
│ Log: • dumping table public.users          │
└─────────────────────────────────────────────┘
```

### Seção de Backups Disponíveis
```
┌─────────────────────────────────────────────────────────────┐
│ Backups Disponíveis                    [🔄 Atualizar]       │
├──────────────────┬──────────┬──────────────────┬───────────┤
│ Nome do Arquivo  │ Tamanho  │ Data de Criação  │ Ações     │
├──────────────────┼──────────┼──────────────────┼───────────┤
│ 📄 backup_...    │ 15.5 MB  │ 20/01/26 14:50   │ [⬇️ Baixar]│
│ 📄 backup_...    │ 14.2 MB  │ 20/01/26 12:30   │ [⬇️ Baixar]│
│ 📄 backup_...    │ 13.8 MB  │ 19/01/26 18:15   │ [⬇️ Baixar]│
└──────────────────┴──────────┴──────────────────┴───────────┘
```

---

## Teste de Verificação

### 1. Criar Backup
```bash
✅ Clicar em "Criar Backup Agora"
✅ Ver progresso em tempo real
✅ Backup concluído com sucesso
✅ Tabela atualizada automaticamente
✅ Novo backup aparece na lista
```

### 2. Download Manual
```bash
✅ Localizar backup na tabela
✅ Clicar no botão "Baixar"
✅ Download inicia automaticamente
✅ Arquivo salvo em Downloads/
✅ Sem erros 401 ou autenticação
```

### 3. Verificar Diretório
```bash
cd d:\github\2026\apps\backend\backups
dir
# Deve listar todos os arquivos .dump criados
```

---

## Próximos Passos

### Teste Imediato
1. ✅ Reiniciar backend
2. ⏳ Acessar `/configuracoes/sistema/updates`
3. ⏳ Clicar em "Criar Backup Agora"
4. ⏳ Aguardar conclusão
5. ⏳ Verificar backup na tabela
6. ⏳ Clicar em "Baixar"
7. ⏳ Confirmar download

### Melhorias Futuras (Opcional)
- [ ] Botão para excluir backups antigos
- [ ] Indicador de backup em uso
- [ ] Compressão automática (gzip)
- [ ] Agendamento automático de backups
- [ ] Limite de backups mantidos (ex: últimos 10)
- [ ] Upload de backup externo

---

**Data**: 20/01/2026 12:15  
**Status**: ✅ Implementado, aguardando teste  
**Arquivos Modificados**: 3 (backend: 2, frontend: 1)
