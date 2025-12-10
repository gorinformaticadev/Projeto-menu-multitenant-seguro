# 🔍 Debug - Exibição de Logos

## Como Verificar se os Logos Estão Funcionando

### 1. Abrir Console do Navegador

1. Acesse http://localhost:5000
2. Faça login como SUPER_ADMIN (`admin@system.com` / `admin123`)
3. Vá para a página "Empresas"
4. Pressione `F12` para abrir o DevTools
5. Vá para a aba "Console"

### 2. Verificar Logs

Você deve ver logs como:
```
Tenants carregados: [{...}, {...}]
API_URL: http://localhost:4000
Logo carregado: Nome da Empresa - filename.jpg
```

Se ver erros como:
```
Erro ao carregar logo: Nome da Empresa - http://localhost:4000/uploads/logos/filename.jpg
```

Isso indica que a imagem não está sendo servida corretamente.

### 3. Testar URL Diretamente

Copie a URL do logo que aparece no erro e cole diretamente no navegador:
```
http://localhost:4000/uploads/logos/1ea3c876-a9f2-42ec-b3ea-f9948ce34508.jpeg
```

**Se a imagem carregar**: O problema está no frontend
**Se a imagem NÃO carregar**: O problema está no backend

### 4. Verificar Network

1. No DevTools, vá para a aba "Network"
2. Filtre por "Img"
3. Recarregue a página
4. Veja se as requisições para `/uploads/logos/` aparecem
5. Verifique o status:
   - ✅ **200 OK**: Imagem carregou com sucesso
   - ❌ **404 Not Found**: Arquivo não existe
   - ❌ **403 Forbidden**: Sem permissão
   - ❌ **CORS Error**: Problema de CORS

### 5. Verificar Elemento HTML

1. No DevTools, vá para a aba "Elements"
2. Encontre o card da empresa
3. Procure pela tag `<img>`
4. Verifique:
   - O atributo `src` está correto?
   - A classe `logo-image` está presente?
   - Há algum estilo inline que esconde a imagem?

### 6. Logs Adicionados

O código agora tem logs de debug:

```typescript
// Ao carregar tenants
console.log('Tenants carregados:', response.data);
console.log('API_URL:', API_URL);

// Ao carregar logo com sucesso
console.log(`Logo carregado: ${tenant.nomeFantasia} - ${tenant.logoUrl}`);

// Ao falhar ao carregar logo
console.error(`Erro ao carregar logo: ${tenant.nomeFantasia} - ${API_URL}/uploads/logos/${tenant.logoUrl}`);
```

## Problemas Comuns e Soluções

### Problema 1: Logo não aparece, mas não há erro
**Causa**: Logo pode estar muito pequeno ou transparente
**Solução**: 
- Verifique o tamanho da imagem
- Tente com uma imagem diferente
- Verifique se a imagem não é totalmente transparente

### Problema 2: Erro 404 ao carregar logo
**Causa**: Arquivo não existe na pasta
**Solução**:
```bash
# Verificar se o arquivo existe
ls backend/uploads/logos/
```

### Problema 3: Erro de CORS
**Causa**: Backend não está permitindo requisições do frontend
**Solução**: Já configurado no `backend/src/main.ts`

### Problema 4: Logo aparece quebrado
**Causa**: Arquivo corrompido ou formato inválido
**Solução**: Fazer novo upload

### Problema 5: Fallback não aparece
**Causa**: Erro no código de fallback
**Solução**: Código já corrigido com `onError` handler

## Teste Manual Rápido

### Backend
```bash
# Testar se o backend está servindo arquivos
curl http://localhost:4000/uploads/logos/1ea3c876-a9f2-42ec-b3ea-f9948ce34508.jpeg -I

# Deve retornar:
# HTTP/1.1 200 OK
# Content-Type: image/jpeg
```

### Frontend
1. Abra http://localhost:5000/empresas
2. Inspecione um card de empresa
3. Veja se a tag `<img>` está presente
4. Veja se o `src` está correto

## Estrutura Esperada

```html
<div class="rounded-xl p-3 shadow-sm bg-gradient-to-br from-primary to-primary/80 relative overflow-hidden flex items-center justify-center w-12 h-12">
  <img 
    src="http://localhost:4000/uploads/logos/filename.jpeg" 
    alt="Nome da Empresa"
    class="max-h-8 max-w-8 object-contain logo-image"
  />
  <svg class="h-6 w-6 text-white fallback-icon hidden absolute">...</svg>
</div>
```

## Checklist de Verificação

- [ ] Backend está rodando (http://localhost:4000)
- [ ] Frontend está rodando (http://localhost:5000)
- [ ] Pasta `backend/uploads/logos/` existe
- [ ] Há arquivos na pasta de logos
- [ ] Console não mostra erros de CORS
- [ ] Network mostra requisições 200 OK para logos
- [ ] Variável `API_URL` está correta no console
- [ ] Tenants têm `logoUrl` preenchido

## Próximos Passos

Se após verificar tudo acima o logo ainda não aparecer:

1. Remova os logs de debug (console.log)
2. Tente fazer um novo upload
3. Verifique permissões da pasta no servidor
4. Verifique se há algum proxy/firewall bloqueando

## ✅ PROBLEMA RESOLVIDO!

### Causa do Problema
O caminho para servir arquivos estáticos estava incorreto. Em modo de desenvolvimento, o `__dirname` aponta para `dist/src`, então era necessário subir 2 níveis para chegar na pasta `uploads`.

### Solução Aplicada
Alterado em `backend/src/main.ts`:
```typescript
// ANTES (errado)
app.useStaticAssets(join(__dirname, '..', 'uploads'), {
  prefix: '/uploads/',
});

// DEPOIS (correto)
const uploadsPath = join(__dirname, '..', '..', 'uploads');
console.log('📁 Servindo arquivos estáticos de:', uploadsPath);
app.useStaticAssets(uploadsPath, {
  prefix: '/uploads/',
});
```

### Teste de Verificação
```bash
curl http://localhost:4000/uploads/logos/1ea3c876-a9f2-42ec-b3ea-f9948ce34508.jpeg -Method Head
# Retorna: StatusCode: 200 ✅
```

## Informações do Sistema

- **Backend**: http://localhost:4000 (ProcessId: 19) ✅
- **Frontend**: http://localhost:5000 (ProcessId: 20) ✅
- **Pasta de Logos**: `D:\GitHub2025-01\Projeto inciio\backend\uploads`
- **Logos Existentes**: 
  - `1ea3c876-a9f2-42ec-b3ea-f9948ce34508.jpeg` ✅
  - `a1a56c20-f3e6-48ad-a8d0-f3ccebc921e8.jpeg` ✅
- **Status**: Logos carregando corretamente! 🎉
