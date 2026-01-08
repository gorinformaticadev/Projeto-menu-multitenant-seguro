# 📤 Guia de Upload de Logo das Empresas

## Visão Geral

O sistema permite que o SUPER_ADMIN faça upload e gerencie logos para cada empresa cadastrada.

## Como Usar

### 1. Acessar Gerenciamento de Empresas

1. Faça login como SUPER_ADMIN
2. Acesse o menu **Empresas** na sidebar
3. Localize a empresa desejada

### 2. Fazer Upload de Logo

1. Clique no botão **Logo** no card da empresa
2. No dialog que abrir, clique em **Escolher arquivo**
3. Selecione uma imagem do seu computador
4. Visualize a pré-visualização do logo
5. Clique em **Fazer Upload**

### 3. Remover Logo

1. Clique no botão **Logo** no card da empresa
2. Se a empresa já tiver um logo, você verá a opção **Remover Logo**
3. Clique no botão vermelho **Remover Logo**
4. O logo será removido imediatamente

### 4. Substituir Logo

1. Clique no botão **Logo** no card da empresa
2. Escolha um novo arquivo
3. O sistema automaticamente removerá o logo antigo e salvará o novo

## Especificações Técnicas

### Formatos Aceitos
- JPG / JPEG
- PNG
- GIF
- WEBP

### Restrições
- **Tamanho máximo**: 5MB
- **Apenas imagens**: Outros tipos de arquivo serão rejeitados

### Armazenamento
- Os logos são salvos em: `backend/uploads/logos/`
- Cada arquivo recebe um nome único (UUID) para evitar conflitos
- Os arquivos são servidos estaticamente pela API

### URLs de Acesso
- **API**: `http://localhost:4000/uploads/logos/{filename}`
- **Frontend**: Exibido automaticamente nos cards das empresas
- **Variável de Ambiente**: Usa `NEXT_PUBLIC_API_URL` para construir a URL correta

## Segurança

- ✅ Apenas SUPER_ADMIN pode fazer upload/remover logos
- ✅ Validação de tipo de arquivo no backend
- ✅ Validação de tamanho no backend e frontend
- ✅ Proteção contra sobrescrita acidental
- ✅ Remoção automática de logos antigos

## Troubleshooting

### Logo não aparece após upload
- Verifique se o backend está rodando
- Confirme que a pasta `backend/uploads/logos/` existe
- Verifique as permissões da pasta
- Verifique se a variável `NEXT_PUBLIC_API_URL` está configurada corretamente
- Abra o console do navegador para ver erros de carregamento de imagem
- Teste acessar diretamente: `http://localhost:4000/uploads/logos/{filename}`

### Erro ao fazer upload
- Confirme que o arquivo é uma imagem válida
- Verifique se o tamanho é menor que 5MB
- Tente com outro formato de imagem

### Logo não é removido
- Verifique se você tem permissão de SUPER_ADMIN
- Confirme que a empresa realmente tem um logo

## Exemplos de Uso

### Upload via API (cURL)

```bash
# Fazer upload de logo
curl -X POST http://localhost:4000/tenants/{tenant-id}/upload-logo \
  -H "Authorization: Bearer {seu-token}" \
  -F "logo=@/caminho/para/logo.png"

# Remover logo
curl -X PATCH http://localhost:4000/tenants/{tenant-id}/remove-logo \
  -H "Authorization: Bearer {seu-token}"
```

### Upload via Frontend

O frontend já possui interface completa para gerenciar logos:
- Dialog com preview
- Validação de arquivo
- Feedback visual
- Tratamento de erros

## Boas Práticas

1. **Tamanho da imagem**: Use imagens otimizadas (recomendado: 200x200px)
2. **Formato**: PNG com fundo transparente funciona melhor
3. **Qualidade**: Mantenha boa qualidade mas evite arquivos muito grandes
4. **Proporção**: Logos quadrados ou com proporção próxima funcionam melhor

## Fallback de Imagem

O sistema possui fallback automático:
- Se o logo não carregar, exibe o ícone padrão (Building2)
- Tratamento de erro com `onError` no componente de imagem
- Não quebra a interface se a imagem estiver indisponível

## Próximas Melhorias

- [ ] Redimensionamento automático de imagens
- [ ] Compressão automática
- [ ] Suporte a múltiplas versões (thumbnail, original)
- [ ] Galeria de logos pré-definidos
- [ ] Editor de imagem integrado
