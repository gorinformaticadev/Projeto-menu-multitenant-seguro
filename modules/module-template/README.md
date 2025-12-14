# Module Template

## 📝 Descrição
Template base para criação de novos módulos. Copie esta pasta e modifique conforme necessário para criar seu próprio módulo.

## 📦 Versão
**1.0.0**

## 👤 Autor
Equipe Dev

## 🎯 Como Usar Este Template

### 1. Copiar o Template
```bash
cp -r modules/module-template modules/seu-modulo
cd modules/seu-modulo
```

### 2. Modificar `module.config.ts`
```typescript
export const moduleConfig = {
  name: 'Seu Módulo',           // Nome exibido
  slug: 'seu-modulo',            // Identificador único
  version: '1.0.0',              // Versão
  enabled: false,                // Inicia desabilitado
  permissionsStrict: true,       // Manter true
  sandboxed: true,               // Manter true
  author: 'Seu Nome',
  description: 'Descrição do seu módulo',
  category: 'Categoria',
  allowEval: false,              // Manter false
  allowWindowAccess: false,      // Manter false
  requiresAuth: true             // Manter true
} as const;
```

### 3. Modificar `module.pages.ts`
```typescript
export const modulePages = [
  {
    id: 'seu-modulo.index',
    path: '/seu-modulo',
    component: () => import('./frontend/pages/index'),
    protected: true,
    permissions: ['seu-modulo.view']
  },
  // Adicione mais páginas conforme necessário
];
```

### 4. Modificar `module.bootstrap.ts`
```typescript
export function registerModule() {
  return {
    pages: modulePages,
    routes: [],
    menus: [
      {
        id: 'seu-modulo',
        label: 'Seu Módulo',
        icon: 'Package',
        path: '/seu-modulo',
        permissions: ['seu-modulo.view']
      }
    ],
    permissions: [
      {
        name: 'seu-modulo.view',
        description: 'Visualizar Seu Módulo',
        category: 'Seu Módulo'
      }
    ]
  };
}
```

### 5. Criar Páginas Frontend
Modifique os arquivos em `frontend/pages/`:
- `index.js` - Página principal
- `settings.js` - Configurações (opcional)

### 6. Testar Localmente
```bash
# Criar ZIP do módulo
cd modules
zip -r seu-modulo.zip seu-modulo/

# Fazer upload via interface
# Acessar /settings/modules
```

## 📄 Estrutura de Arquivos
```
module-template/
├── module.config.ts      # ✏️ MODIFICAR
├── module.bootstrap.ts   # ✏️ MODIFICAR
├── module.pages.ts       # ✏️ MODIFICAR
├── README.md             # ✏️ MODIFICAR
└── frontend/
    └── pages/
        ├── index.js      # ✏️ MODIFICAR
        └── settings.js   # ✏️ MODIFICAR (opcional)
```

## ✅ Checklist de Criação

- [ ] Copiar pasta do template
- [ ] Renomear pasta para slug do módulo
- [ ] Modificar `module.config.ts`
  - [ ] Alterar `name`
  - [ ] Alterar `slug`
  - [ ] Alterar `author`
  - [ ] Alterar `description`
  - [ ] Alterar `category`
- [ ] Modificar `module.pages.ts`
  - [ ] Atualizar IDs das páginas
  - [ ] Atualizar paths
  - [ ] Atualizar permissões
- [ ] Modificar `module.bootstrap.ts`
  - [ ] Atualizar menus
  - [ ] Atualizar permissões
- [ ] Criar páginas frontend
  - [ ] Implementar `index.js`
  - [ ] Implementar `settings.js` (se necessário)
- [ ] Atualizar `README.md`
- [ ] Testar localmente
- [ ] Criar ZIP
- [ ] Fazer upload

## 🔐 Regras de Segurança

### ✅ SEMPRE
- `sandboxed: true`
- `permissionsStrict: true`
- `allowEval: false`
- `allowWindowAccess: false`
- `requiresAuth: true`

### ❌ NUNCA
- Usar `eval()`
- Usar `Function()`
- Acessar `window` diretamente
- Importar do core diretamente
- Desabilitar sandbox

## 📚 Recursos Adicionais

- [Guia Completo de Desenvolvimento](../docs/module-development.md)
- [API de Módulos](../docs/module-api.md)
- [Exemplos de Módulos](../module-exemplo/)
- [Boas Práticas](../docs/best-practices.md)

## 💡 Dicas

1. **Nomeação:** Use kebab-case para slugs (ex: `meu-modulo`)
2. **Permissões:** Prefixe com o slug do módulo (ex: `meu-modulo.view`)
3. **Paths:** Comece com `/` e use o slug (ex: `/meu-modulo`)
4. **Versão:** Use Semantic Versioning (MAJOR.MINOR.PATCH)
5. **Testes:** Teste antes de fazer upload

## 🐛 Troubleshooting

### Módulo não aparece na lista
- Verifique se o ZIP está correto
- Verifique se os arquivos obrigatórios existem
- Veja os logs de validação

### Erro de validação
- Verifique se não há `eval()` no código
- Verifique se `sandboxed: true`
- Verifique se todos os campos obrigatórios estão presentes

### Módulo não ativa
- Verifique se foi validado primeiro
- Verifique se não há erros no console
- Verifique as permissões do usuário

---

**Tipo:** Template  
**Status:** 📝 Para Copiar  
**Última Atualização:** 2025-12-14
