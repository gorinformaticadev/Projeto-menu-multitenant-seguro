# Refatoração: Sistema de Módulos JSON-First

## 🎯 Problema Resolvido

O sistema anterior tentava **parsear TypeScript em runtime**, causando:
- ❌ Erros de parsing com regex
- ❌ Uso inseguro de `eval()`
- ❌ Fragilidade com diferentes formatos de código
- ❌ Complexidade desnecessária

## ✅ Nova Abordagem: JSON-First

### **Princípio:**
> **"O módulo define suas rotas em JSON. O core apenas lê e confia."**

### **Benefícios:**
- ✅ **Simples**: JSON.parse() nativo, sem regex
- ✅ **Seguro**: Sem eval(), sem execução de código
- ✅ **Rápido**: Parsing instantâneo
- ✅ **Confiável**: JSON é um padrão bem definido
- ✅ **Retrocompatível**: TypeScript funciona como fallback

## 📋 Estrutura do Módulo

### **Arquivos Obrigatórios:**

```
modules/boas-vindas/
├── module.config.json      ✅ Configuração (JSON prioritário)
├── module.pages.json       ✅ Páginas/Rotas (JSON prioritário)
├── module.config.ts        ⚠️  Fallback (opcional, legado)
├── module.pages.ts         ⚠️  Fallback (opcional, legado)
├── module.json             ⚠️  Metadados gerais (legado)
└── frontend/
    └── pages/
        └── tutorial.js     ✅ Implementação da página
```

### **Prioridade de Carregamento:**

```
1. module.config.json  →  2. module.config.ts  →  ❌ Erro
1. module.pages.json   →  2. module.pages.ts   →  ❌ Erro
```

## 📄 Formato dos Arquivos JSON

### **1. module.config.json**

```json
{
  "name": "Boas-Vindas",
  "slug": "boas-vindas",
  "version": "1.0.0",
  "enabled": true,
  "permissionsStrict": false,
  "sandboxed": true,
  "author": "Equipe de Desenvolvimento",
  "description": "Módulo de boas-vindas e tutorial do sistema",
  "category": "tutoriais"
}
```

**Campos Obrigatórios:**
- `name` (string): Nome exibido do módulo
- `slug` (string): Identificador único (kebab-case)
- `version` (string): Versão semântica
- `enabled` (boolean): Se o módulo está ativo
- `permissionsStrict` (boolean): Validação estrita de permissões
- `sandboxed` (boolean): Isolamento de segurança

**Campos Opcionais:**
- `author` (string): Autor do módulo
- `description` (string): Descrição do módulo
- `category` (string): Categoria (tutoriais, vendas, etc)

### **2. module.pages.json**

```json
[
  {
    "id": "boas-vindas.tutorial",
    "path": "/boas-vindas/tutorial",
    "component": "TutorialPage",
    "protected": false,
    "permissions": [],
    "title": "Tutorial",
    "description": "Tutorial de introdução ao sistema"
  }
]
```

**Estrutura de Página:**

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `id` | string | ✅ | Identificador único da página (formato: `modulo.pagina`) |
| `path` | string | ✅ | Caminho da rota (ex: `/boas-vindas/tutorial`) |
| `component` | string | ✅ | Nome do componente JS (ex: `TutorialPage`) |
| `protected` | boolean | ❌ | Se requer autenticação (default: false) |
| `permissions` | array | ❌ | Permissões necessárias (default: []) |
| `title` | string | ❌ | Título da página |
| `description` | string | ❌ | Descrição da página |

## 🔧 Lógica do Core Refatorada

### **Arquivo:** `frontend/src/app/api/modules/discover/route.ts`

```typescript
// 1. PRIORIZA JSON
if (existsSync(configJsonPath)) {
  const config = JSON.parse(await readFile(configJsonPath, 'utf-8'));
  return config;
}

// 2. FALLBACK PARA TYPESCRIPT
if (existsSync(configTsPath)) {
  return await loadModuleConfigFromTS(configTsPath); // Parsing complexo
}

// 3. ERRO SE NENHUM ENCONTRADO
throw new Error('Nenhum arquivo de configuração encontrado');
```

### **Fluxo de Descoberta:**

```
1. Listar diretórios em /modules/
2. Para cada módulo:
   a. Tentar carregar module.config.json
   b. Se não existir, tentar module.config.ts
   c. Verificar se enabled: true
   d. Tentar carregar module.pages.json
   e. Se não existir, tentar module.pages.ts
   f. Validar estrutura das páginas
   g. Retornar módulo válido
3. Retornar lista de módulos descobertos
```

## 🚀 Como Usar em Novos Módulos

### **Opção 1: JSON Puro (Recomendado)**

```bash
modules/meu-modulo/
├── module.config.json      # Configuração
├── module.pages.json       # Rotas
└── frontend/
    └── pages/
        └── index.js        # Implementação
```

### **Opção 2: TypeScript + Build**

```bash
# 1. Criar arquivos TypeScript
modules/meu-modulo/
├── module.config.ts
├── module.pages.ts

# 2. Build gera JSON
npm run build:modules

# 3. JSON é commitado junto
modules/meu-modulo/
├── module.config.ts
├── module.config.json      ← Gerado
├── module.pages.ts
└── module.pages.json       ← Gerado
```

## 📊 Comparação: Antes vs Depois

### **Antes (TypeScript Parsing):**

```typescript
// Regex complexo
const fieldRegex = new RegExp(`${fieldName}\\s*:\\s*(['"]?)([^'"\n,}]*?)\\1(?:[,\s}]|$)`, 'i');

// Eval inseguro
const pages = eval(`(${pagesMatch[1]})`);

// Muitos pontos de falha
```

**Problemas:**
- ❌ Regex pode falhar com formatos diferentes
- ❌ `eval()` é inseguro
- ❌ Difícil de debugar
- ❌ Lento (parsing complexo)

### **Depois (JSON-First):**

```typescript
// Simples e direto
const config = JSON.parse(await readFile(configJsonPath, 'utf-8'));

// Nativo, seguro, rápido
const pages = JSON.parse(await readFile(pagesJsonPath, 'utf-8'));
```

**Benefícios:**
- ✅ JSON.parse() nativo do JavaScript
- ✅ Seguro (não executa código)
- ✅ Fácil de debugar
- ✅ Instantâneo (< 1ms)

## 🎓 Boas Práticas

### **1. Mantenha JSON e TypeScript Sincronizados**

Se usar TypeScript, crie um script de build:

```json
// package.json
{
  "scripts": {
    "build:module:config": "node scripts/ts-to-json.js module.config.ts",
    "build:module:pages": "node scripts/ts-to-json.js module.pages.ts"
  }
}
```

### **2. Valide JSON Antes de Commitar**

```bash
# Verificar se JSON é válido
jq . modules/boas-vindas/module.config.json
jq . modules/boas-vindas/module.pages.json
```

### **3. Use Schema Validation (Futuro)**

```typescript
// Validar com JSON Schema
const isValid = ajv.validate(moduleConfigSchema, config);
```

## 🔒 Segurança

### **Melhorias de Segurança:**

1. **Sem eval()**: Não executa código arbitrário
2. **Validação de campos**: Verifica campos obrigatórios
3. **Type safety**: TypeScript valida estrutura
4. **Path validation**: Verifica paths maliciosos

### **Validações Implementadas:**

```typescript
// Campos obrigatórios
if (!config.name || !config.slug) {
  throw new Error('Campos obrigatórios não encontrados');
}

// Estrutura de páginas
if (!page.id || !page.path || !page.component) {
  throw new Error('Página inválida');
}

// Paths seguros
if (page.path.includes('..') || page.path.includes('//')) {
  throw new Error('Path inseguro detectado');
}
```

## 📈 Performance

### **Métricas (Estimadas):**

| Operação | Antes (TS) | Depois (JSON) | Melhoria |
|----------|------------|---------------|----------|
| Parse Config | ~5-10ms | ~0.5ms | **10-20x** |
| Parse Pages | ~5-10ms | ~0.5ms | **10-20x** |
| Validação | ~2ms | ~2ms | - |
| **Total** | ~12-22ms | ~3ms | **4-7x** |

## ✅ Checklist de Migração

Para migrar um módulo existente:

- [ ] Criar `module.config.json` com mesmos dados do `.ts`
- [ ] Criar `module.pages.json` com mesmas rotas do `.ts`
- [ ] Testar com `curl http://localhost:5000/api/modules/discover`
- [ ] Verificar que `isValid: true`
- [ ] Verificar que páginas aparecem no array
- [ ] Testar acesso à rota no navegador
- [ ] (Opcional) Manter `.ts` como backup
- [ ] Commitar ambos JSON e TS

## 🎯 Resultado Final

### **Antes da Refatoração:**
```json
{
  "isValid": false,
  "loadError": "Páginas do módulo não encontradas ou inválidas"
}
```

### **Depois da Refatoração:**
```json
{
  "config": {
    "name": "Boas-Vindas",
    "enabled": true
  },
  "bootstrap": {
    "pages": [
      {
        "path": "/boas-vindas/tutorial",
        "component": "TutorialPage"
      }
    ]
  },
  "isValid": true
}
```

## 🚀 Próximos Passos

1. ✅ Módulo boas-vindas funcionando com JSON
2. 📝 Criar script de conversão TS → JSON automático
3. 🔄 Migrar outros módulos para JSON
4. 📚 Documentar padrão JSON como oficial
5. 🗑️ Eventualmente deprecar suporte a TypeScript
