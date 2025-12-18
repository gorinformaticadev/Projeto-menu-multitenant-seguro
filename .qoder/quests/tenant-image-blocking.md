# Design: Correção de Bloqueio de Imagens de Tenant

## Contexto

O sistema apresenta erro ao carregar logos de tenants em diversos componentes (TopBar, Sidebar, página de Empresas, página de Login). As imagens estão fisicamente armazenadas no servidor (`backend/uploads/logos/`) mas são bloqueadas pelo navegador ao tentar carregá-las.

### Evidências do Problema

Logs do console do navegador:
- "Erro ao carregar logo do tenant no menu: ebb518b6-aaec-4762-af7c-b316a0739b4d_download__38_.jpg"
- "Erro ao carregar logo: GOR Informatica - http://localhost:4000/uploads/logos/ebb518b6-aaec-4762-af7c-b316a0739b4d_download__38_.jpg"

### Causa Raiz

A configuração de CORS para arquivos estáticos no backend está muito restritiva. O código atual em `backend/src/main.ts` (linhas 150-165) implementa:

1. Validação de origin contra lista permitida
2. Definição de headers CORS apenas quando origin está presente E permitida
3. Problema: requisições de imagens via tag `<img>` frequentemente não incluem header `origin`, resultando em bloqueio

## Objetivo

Permitir que imagens de logos de tenants sejam carregadas corretamente em todos os componentes do frontend, mantendo níveis adequados de segurança.

## Análise do Problema

### Componentes Afetados

| Componente | Arquivo | Linha | Uso |
|------------|---------|-------|-----|
| TopBar (master logo) | `frontend/src/components/TopBar.tsx` | 193 | Logo da empresa master |
| TopBar (tenant logo) | `frontend/src/components/TopBar.tsx` | 399 | Logo do tenant do usuário |
| Login | `frontend/src/app/login/page.tsx` | 140 | Logo na página de login |
| Empresas | `frontend/src/app/empresas/page.tsx` | 722 | Logo nos cards de empresas |

### Configuração Atual de CORS para Arquivos Estáticos

```typescript
app.useStaticAssets(uploadsPath, {
  prefix: '/uploads/',
  setHeaders: (res, path, stat) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    
    const allowedOrigins = [
      process.env.FRONTEND_URL || 'http://localhost:5000',
      'http://127.0.0.1:5000',
      'http://localhost:5000',
      'http://localhost:3000'
    ].filter(Boolean);

    const origin = res.req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    // ... outros headers
  },
});
```

### Problema Identificado

1. **Condição restritiva**: Header `Access-Control-Allow-Origin` só é definido se `origin` estiver presente E estiver na lista permitida
2. **Comportamento de navegadores**: Tags `<img>` nem sempre enviam header `origin`, especialmente em:
   - Navegação direta
   - Carregamento inicial da página
   - Cache do navegador
   - Alguns cenários de CORS
3. **Headers globais conflitantes**: O middleware global (linhas 117-134) define `Cross-Origin-Resource-Policy: cross-origin` mas isso não é suficiente sem `Access-Control-Allow-Origin`

## Solução Proposta

### Abordagem 1: CORS Permissivo para Arquivos Estáticos (Recomendada)

Modificar a configuração de CORS para arquivos estáticos para ser mais permissiva, já que:
- Logos são recursos públicos por natureza
- Não contêm informações sensíveis
- Servem apenas propósito visual
- Validação de acesso já existe no upload (apenas SUPER_ADMIN)

#### Mudanças Necessárias

**Arquivo**: `backend/src/main.ts`

**Modificação na função setHeaders**:

Substituir a lógica condicional de CORS por headers mais permissivos especificamente para arquivos de imagem em `/uploads/logos/`:

1. Verificar se o caminho é de logo (`path.includes('logos/')`)
2. Para logos: definir CORS permissivo
3. Para outros uploads (futuro): manter política restritiva

#### Configuração de Headers

| Header | Valor | Propósito |
|--------|-------|-----------|
| Access-Control-Allow-Origin | * (para logos) | Permite carregamento de qualquer origin |
| Cross-Origin-Resource-Policy | cross-origin | Permite embedding cross-origin |
| Cache-Control | public, max-age=86400 | Cache de 24 horas (otimização) |
| X-Content-Type-Options | nosniff | Previne MIME sniffing |

### Abordagem 2: CORS com Fallback (Alternativa)

Manter validação de origins, mas adicionar fallback para quando `origin` não estiver presente:

1. Se `origin` presente e permitido: usar origin específico
2. Se `origin` ausente OU não permitido: usar `*` para logos
3. Manter restrição para outros tipos de arquivo

## Estratégia de Implementação

### Fase 1: Correção Imediata

1. Modificar `setHeaders` em `useStaticAssets` para detectar requisições de logos
2. Aplicar política CORS permissiva para arquivos em `/logos/`
3. Manter política restritiva para outros arquivos estáticos
4. Adicionar logging para debug

### Fase 2: Validação

1. Testar carregamento de logos em todos os componentes:
   - TopBar (master logo)
   - TopBar (tenant logo)
   - Login
   - Empresas
2. Verificar console do navegador para ausência de erros CORS
3. Validar que headers corretos estão sendo enviados

### Fase 3: Otimização (Opcional)

1. Implementar CDN para servir logos (futuro)
2. Adicionar compressão de imagens
3. Implementar lazy loading onde apropriado

## Impacto de Segurança

### Riscos Avaliados

| Risco | Nível | Mitigação |
|-------|-------|-----------|
| Acesso não autorizado a logos | Baixo | Logos são recursos públicos visuais |
| Hotlinking de logos | Baixo | Aceito como tradeoff; pode ser mitigado com CDN no futuro |
| CORS too permissive | Baixo | Limitado apenas a arquivos em `/uploads/logos/` |

### Controles Mantidos

1. Upload de logos: continua restrito a SUPER_ADMIN
2. Validação de tipo de arquivo: mantida no upload
3. Validação de tamanho: mantida (5MB max)
4. Nomenclatura UUID: previne conflitos e adivinhação
5. Headers de segurança: `X-Content-Type-Options`, `X-Frame-Options` mantidos

## Considerações de Performance

### Cache

- Cache-Control aumentado para 24 horas (logos mudam raramente)
- Navegadores farão menos requisições ao servidor
- Invalidação de cache via mudança de filename (UUID)

### Bandwidth

- Logos são servidos diretamente pelo backend (desenvolvimento)
- Em produção: considerar CDN para otimização

## Alternativas Consideradas

### Alternativa 1: Mover logos para CDN
- **Vantagem**: Melhor performance, sem problemas de CORS
- **Desvantagem**: Complexidade adicional, custo
- **Decisão**: Não implementar agora, considerar para futuro

### Alternativa 2: Usar Data URLs
- **Vantagem**: Sem requisições HTTP adicionais
- **Desvantagem**: Aumenta payload do HTML, sem cache
- **Decisão**: Rejeitada

### Alternativa 3: Proxy via API
- **Vantagem**: Controle total de acesso
- **Desvantagem**: Overhead desnecessário, impacto em performance
- **Decisão**: Rejeitada, over-engineering

### Alternativa 4: Configurar Referer Policy
- **Vantagem**: Validação adicional
- **Desvantagem**: Não resolve problema de `origin` ausente
- **Decisão**: Rejeitada, não resolve causa raiz

## Validação da Solução

### Critérios de Sucesso

1. Logos carregam sem erros em todos os componentes
2. Console do navegador não mostra erros CORS relacionados a imagens
3. Headers de segurança mantidos para proteção adequada
4. Performance de carregamento mantida ou melhorada

### Cenários de Teste

| Cenário | Componente | Resultado Esperado |
|---------|------------|-------------------|
| Carregamento inicial | Login | Logo master aparece |
| Após autenticação | TopBar | Logo tenant do usuário aparece |
| Lista de empresas | Empresas | Logos de todos os tenants aparecem |
| Navegação entre páginas | Todos | Logos continuam carregando |
| Cache ativo | Todos | Logos carregam do cache |

## Monitoramento

### Logs a Adicionar

1. Log do caminho de arquivo servido (apenas em desenvolvimento)
2. Log de headers CORS aplicados (debug mode)
3. Log de erros de carregamento de arquivo

### Métricas a Observar

1. Taxa de erro 404 em `/uploads/logos/*`
2. Tempo de carregamento de imagens
3. Taxa de hit de cache

## Notas de Implementação

### Arquivos a Modificar

1. `backend/src/main.ts` - Configuração de static assets

### Arquivos a Não Modificar

- Frontend: Nenhuma mudança necessária
- Componentes React: Já implementam fallback adequadamente
- API de upload: Mantém validações de segurança

### Compatibilidade

- Navegadores: Todos os navegadores modernos
- Versões anteriores: Sem breaking changes
- Mobile: Funciona igualmente

## Rollback

Caso seja necessário reverter:

1. Restaurar configuração original de `setHeaders`
2. Sem mudanças no banco de dados ou arquivos
3. Sem impacto em uploads existentes
4. Rollback pode ser feito imediatamente

## Próximos Passos Recomendados

### Curto Prazo (Após Implementação)
1. Validar funcionamento em todos os navegadores
2. Verificar comportamento com logos de diferentes tamanhos
3. Testar com múltiplos tenants

### Médio Prazo
1. Considerar implementação de CDN para logos
2. Adicionar compressão automática de imagens no upload
3. Implementar lazy loading em listas longas

### Longo Prazo
1. Avaliar migração para storage cloud (S3, Azure Blob)
2. Implementar sistema de thumbnails
3. Adicionar suporte a múltiplos tamanhos de logo2. Implementar sistema de thumbnails
3. Adicionar suporte a múltiplos tamanhos de logo