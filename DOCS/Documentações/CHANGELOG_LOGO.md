# 📋 Changelog - Funcionalidade de Upload de Logo

## Data: 17/11/2025

### ✨ Nova Funcionalidade: Upload de Logo para Empresas

#### Backend

##### 1. Schema do Banco de Dados
- **Arquivo**: `backend/prisma/schema.prisma`
- **Mudança**: Adicionado campo `logoUrl` (String opcional) no model `Tenant`
- **Migration**: `20251117162820_add_tenant_logo`

##### 2. Configuração de Upload
- **Arquivo**: `backend/src/common/config/multer.config.ts` (NOVO)
- **Funcionalidade**: 
  - Configuração do Multer para upload de arquivos
  - Validação de tipo de arquivo (apenas imagens)
  - Limite de tamanho (5MB)
  - Nomenclatura única com UUID

##### 3. Controller
- **Arquivo**: `backend/src/tenants/tenants.controller.ts`
- **Novos Endpoints**:
  - `POST /tenants/:id/upload-logo` - Upload de logo
  - `PATCH /tenants/:id/remove-logo` - Remoção de logo
- **Imports**: Adicionados `FileInterceptor`, `UploadedFile`, `BadRequestException`

##### 4. Service
- **Arquivo**: `backend/src/tenants/tenants.service.ts`
- **Novos Métodos**:
  - `updateLogo(id, filename)` - Atualiza logo e remove o antigo
  - `removeLogo(id)` - Remove logo do banco e do sistema de arquivos
- **Imports**: Adicionados `unlink` (fs/promises) e `join` (path)

##### 5. Main Application
- **Arquivo**: `backend/src/main.ts`
- **Mudanças**:
  - Configuração de arquivos estáticos com `useStaticAssets`
  - Servir pasta `/uploads/` com prefixo `/uploads/`
  - Tipo alterado para `NestExpressApplication`

##### 6. Dependências
- **Instaladas**:
  - `@nestjs/platform-express`
  - `multer`
  - `@types/multer` (dev)
  - `uuid`
  - `@types/uuid` (dev)

##### 7. Estrutura de Pastas
- **Criada**: `backend/uploads/logos/`
- **Arquivos**: 
  - `.gitkeep` - Mantém a pasta no git
  - `.gitignore` - Ignora arquivos de upload

#### Frontend

##### 1. Interface Tenant
- **Arquivo**: `frontend/src/app/empresas/page.tsx`
- **Mudança**: Adicionado campo `logoUrl?: string | null` na interface `Tenant`

##### 2. Estados
- **Novos Estados**:
  - `showLogoDialog` - Controla exibição do dialog de logo
  - `logoFile` - Arquivo selecionado para upload
  - `logoPreview` - Preview do logo antes do upload

##### 3. Funções
- **Novas Funções**:
  - `openLogoDialog(tenant)` - Abre dialog de gerenciamento
  - `handleLogoFileChange(e)` - Processa seleção de arquivo
  - `handleUploadLogo()` - Faz upload do logo
  - `handleRemoveLogo()` - Remove logo existente

##### 4. UI Components
- **Card de Empresa**:
  - Exibe logo quando disponível
  - Fallback para ícone Building2
  - Botão "Logo" para gerenciar
- **Dialog de Logo**:
  - Upload de arquivo
  - Preview do logo atual
  - Preview do novo logo
  - Botão de remoção
  - Validações visuais

##### 5. Ícones
- **Novos Ícones**: `Image as ImageIcon`, `Upload`, `X`

#### Documentação

##### 1. README.md
- **Seção de Rotas**: Adicionadas rotas de upload/remoção de logo
- **Funcionalidades**: Marcado upload de arquivos como implementado
- **Nova Seção**: "📤 Upload de Arquivos" com detalhes técnicos

##### 2. GUIA_UPLOAD_LOGO.md (NOVO)
- Guia completo de uso da funcionalidade
- Especificações técnicas
- Troubleshooting
- Exemplos de uso
- Boas práticas

##### 3. CHANGELOG_LOGO.md (NOVO)
- Este arquivo com todas as mudanças realizadas

### 🔒 Segurança

- ✅ Apenas SUPER_ADMIN pode fazer upload/remover logos
- ✅ Validação de tipo de arquivo (backend)
- ✅ Validação de tamanho (backend e frontend)
- ✅ Nomenclatura única para evitar conflitos
- ✅ Remoção automática de logos antigos

### 🎨 UX/UI

- ✅ Dialog intuitivo para gerenciamento
- ✅ Preview antes do upload
- ✅ Exibição do logo nos cards
- ✅ Feedback visual de sucesso/erro
- ✅ Validações em tempo real

### 🧪 Testes Recomendados

1. **Upload de Logo**
   - [ ] Upload de PNG
   - [ ] Upload de JPG
   - [ ] Upload de GIF
   - [ ] Upload de WEBP
   - [ ] Rejeição de arquivo não-imagem
   - [ ] Rejeição de arquivo > 5MB

2. **Remoção de Logo**
   - [ ] Remover logo existente
   - [ ] Tentar remover quando não há logo

3. **Substituição de Logo**
   - [ ] Upload de novo logo substitui o antigo
   - [ ] Arquivo antigo é removido do sistema

4. **Exibição**
   - [ ] Logo aparece no card da empresa
   - [ ] Fallback para ícone quando não há logo
   - [ ] URL do logo está correta

5. **Permissões**
   - [ ] SUPER_ADMIN pode fazer upload
   - [ ] ADMIN não pode fazer upload
   - [ ] USER não pode fazer upload

### 📊 Estatísticas

- **Arquivos Modificados**: 8
- **Arquivos Criados**: 6
- **Linhas de Código Adicionadas**: ~350
- **Endpoints Novos**: 2
- **Migrations**: 1

### 🚀 Deploy

#### Checklist para Produção

- [ ] Criar pasta `uploads/logos/` no servidor
- [ ] Configurar permissões da pasta (write)
- [ ] Verificar variáveis de ambiente
- [ ] Executar migration do Prisma
- [ ] Testar upload em produção
- [ ] Configurar backup da pasta de uploads
- [ ] Considerar usar CDN/S3 para arquivos

#### Variáveis de Ambiente

Nenhuma nova variável necessária. O sistema usa as existentes:
- `DATABASE_URL` - Para migration
- `PORT` - Para servir arquivos estáticos

### 🐛 Correção de Bug - Arquivos Estáticos

#### Problema Identificado
Os logos não estavam sendo exibidos porque o backend retornava 404 ao tentar acessar `/uploads/logos/filename.jpeg`.

#### Causa Raiz
O caminho configurado em `useStaticAssets` estava incorreto. Em modo de desenvolvimento, `__dirname` aponta para `dist/src`, então o caminho `join(__dirname, '..', 'uploads')` resultava em `dist/uploads`, que não existe.

#### Solução
Alterado o caminho para subir 2 níveis: `join(__dirname, '..', '..', 'uploads')`, que resulta em `backend/uploads` (correto).

#### Código Corrigido
```typescript
// backend/src/main.ts
const uploadsPath = join(__dirname, '..', '..', 'uploads');
console.log('📁 Servindo arquivos estáticos de:', uploadsPath);
app.useStaticAssets(uploadsPath, {
  prefix: '/uploads/',
});
```

#### Verificação
```bash
# Teste manual
curl http://localhost:4000/uploads/logos/1ea3c876-a9f2-42ec-b3ea-f9948ce34508.jpeg -Method Head
# Resultado: StatusCode 200 OK ✅
```

#### Logs de Debug Adicionados
- Console mostra o caminho completo dos arquivos estáticos
- Frontend loga quando logo carrega com sucesso
- Frontend loga erro quando logo falha ao carregar

### 🔄 Próximos Passos

1. **Otimização de Imagens**
   - Implementar redimensionamento automático
   - Adicionar compressão de imagens
   - Gerar thumbnails

2. **Cloud Storage**
   - Migrar para AWS S3 ou similar
   - Implementar CDN para melhor performance

3. **Melhorias de UX**
   - Crop de imagem antes do upload
   - Filtros e ajustes de imagem
   - Galeria de logos pré-definidos

4. **Auditoria**
   - Log de uploads/remoções
   - Histórico de logos anteriores
   - Rastreamento de mudanças

5. **Remover Logs de Debug**
   - Remover console.log do frontend após confirmar funcionamento
   - Manter apenas logs essenciais no backend
