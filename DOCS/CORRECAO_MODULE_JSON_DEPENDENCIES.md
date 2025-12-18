# Correção: module.json - Formato de Dependencies

## 📋 Problema Identificado

**Erro ao fazer upload do módulo "sistema":**
```
Erro no upload
Dependência 1 deve ser string não vazia
```

## 🔍 Causa Raiz

O arquivo `module.json` estava usando um formato incorreto para o campo `dependencies`:

**❌ Formato INCORRETO (estava assim):**
```json
{
  "dependencies": [
    {
      "type": "core",
      "name": "core",
      "version": ">=1.0.0"
    }
  ]
}
```

**✅ Formato CORRETO (deve ser assim):**
```json
{
  "dependencies": null
}
```

Ou, se houver dependências de outros módulos:
```json
{
  "dependencies": ["modulo-base", "modulo-comum"]
}
```

## 📖 Especificação do Campo Dependencies

Conforme definido em `backend/src/core/validators/module-json.validator.ts`:

### Tipo Aceito
```typescript
dependencies?: string[] | null
```

### Regras de Validação

1. **Tipo**: Deve ser `array de strings` ou `null`
2. **Formato das strings**: Cada string deve ser um slug válido (apenas letras, números, hífen e underscore)
3. **Não vazio**: Strings não podem ser vazias ou apenas espaços
4. **Exemplo válido**: `["financeiro", "estoque", "vendas"]`

### Exemplos

#### Módulo sem dependências (recomendado para módulos base)
```json
{
  "name": "sistema",
  "displayName": "Sistema",
  "version": "1.0.0",
  "dependencies": null
}
```

#### Módulo com dependências de outros módulos
```json
{
  "name": "financeiro",
  "displayName": "Financeiro",
  "version": "1.0.0",
  "dependencies": ["sistema", "contabilidade"]
}
```

## ✅ Correção Aplicada

**Arquivo**: `modules/sistema/module.json`

**Mudança**:
```diff
- "dependencies": [
-   {
-     "type": "core",
-     "name": "core",
-     "version": ">=1.0.0"
-   }
- ],
+ "dependencies": null,
```

**Motivo**: O módulo "sistema" é um módulo base e não depende de outros módulos instaláveis. A dependência do "core" é implícita (todos os módulos dependem do core do sistema).

## 🎯 Como Usar Dependencies Corretamente

### Quando usar `null`
- Módulos base que não dependem de outros módulos
- Módulos standalone
- Primeira camada de módulos

### Quando usar array de strings
- Módulos que estendem funcionalidades de outros módulos
- Módulos que precisam de funcionalidades de outros módulos instalados

### Exemplo de Cadeia de Dependências

```
┌─────────────┐
│   sistema   │  dependencies: null
└──────┬──────┘
       │
       ├──► ┌─────────────┐
       │    │ financeiro  │  dependencies: ["sistema"]
       │    └──────┬──────┘
       │           │
       │           └──► ┌──────────────┐
       │                │  faturamento │  dependencies: ["financeiro", "sistema"]
       │                └──────────────┘
       │
       └──► ┌─────────────┐
            │  vendas     │  dependencies: ["sistema"]
            └─────────────┘
```

## 🔒 Validações Aplicadas

O validador `ModuleJsonValidator` verifica:

1. ✅ `dependencies` é `array` ou `null`
2. ✅ Se for array, cada item é uma `string`
3. ✅ Cada string não está vazia (`.trim() !== ''`)
4. ✅ Cada string contém apenas caracteres seguros: `[a-zA-Z0-9_-]`

## 📝 Template Correto de module.json

```json
{
  "name": "nome-do-modulo",
  "displayName": "Nome para Exibição",
  "version": "1.0.0",
  "description": "Descrição opcional do módulo",
  "author": "Nome do Autor",
  "category": "categoria-opcional",
  "enabled": true,
  "dependencies": null,
  "defaultConfig": {
    "configuracao1": "valor1",
    "configuracao2": true
  },
  "menus": [
    {
      "label": "Menu Principal",
      "icon": "Settings",
      "route": "/modulo/rota",
      "order": 10
    }
  ]
}
```

## 🧪 Como Testar

1. Crie um ZIP do módulo após a correção
2. Faça upload via interface: `/configuracoes/sistema/modulos`
3. O upload deve ser bem-sucedido
4. O módulo deve aparecer com status `installed`

## 📚 Referências

- **Validador**: `backend/src/core/validators/module-json.validator.ts`
- **Interface**: `ModuleJson` (linhas 6-18)
- **Validação de Dependencies**: Linhas 104-121 e 168-180
- **Documentação**: `DOCS/REGRAS_CRIACAO_MODULOS.md`

---

**Data da Correção**: 18 de dezembro de 2024
**Módulo Corrigido**: `modules/sistema/module.json`
**Status**: ✅ Corrigido e testável
