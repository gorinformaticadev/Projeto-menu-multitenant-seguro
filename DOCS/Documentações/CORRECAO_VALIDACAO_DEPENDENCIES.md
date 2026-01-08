# ✅ Correção - Validação de `dependencies` e `menus`

## ❌ Problema

**Erro**: `Campo "dependencies" deve ser array`

**Causa**: Validator rejeitava `dependencies` quando não era array, mas o `module.json` pode ter:
- `dependencies: null`
- `dependencies: undefined`
- `dependencies: {}` (objeto vazio)

## 🔍 Log do Erro

```
[Nest] 9204  - 17/12/2025, 17:10:05   ERROR [ModuleInstallerService] ❌ Erro ao instalar módulo:  
Campo "dependencies" deve ser array
    at ModuleJsonValidator.validateFieldTypes (module-json.validator.ts:105:19)
```

## ✅ Correção Aplicada

### Arquivo: `module-json.validator.ts`

#### Antes (ERRO)
```typescript
// dependencies: array (opcional)
if (moduleJson.dependencies !== undefined && !Array.isArray(moduleJson.dependencies)) {
    throw new BadRequestException('Campo "dependencies" deve ser array');
}

// menus: array (opcional)
if (moduleJson.menus !== undefined && !Array.isArray(moduleJson.menus)) {
    throw new BadRequestException('Campo "menus" deve ser array');
}
```

#### Depois (CORRETO)
```typescript
// dependencies: array (opcional)
if (moduleJson.dependencies !== undefined && 
    moduleJson.dependencies !== null && 
    !Array.isArray(moduleJson.dependencies)) {
    throw new BadRequestException('Campo "dependencies" deve ser array ou null');
}

// menus: array (opcional)
if (moduleJson.menus !== undefined && 
    moduleJson.menus !== null && 
    !Array.isArray(moduleJson.menus)) {
    throw new BadRequestException('Campo "menus" deve ser array ou null');
}
```

#### Validação de Valores Ajustada
```typescript
// dependencies: validar que são strings
if (moduleJson.dependencies && Array.isArray(moduleJson.dependencies)) {
    for (const dep of moduleJson.dependencies) {
        if (typeof dep !== 'string') {
            throw new BadRequestException('Dependências devem ser strings');
        }
    }
}
```

## 📊 Valores Agora Aceitos

### `dependencies`
- ✅ `undefined` (campo ausente)
- ✅ `null`
- ✅ `[]` (array vazio)
- ✅ `["modulo-a", "modulo-b"]` (array de strings)
- ❌ `{}` (objeto - rejeitado)
- ❌ `"string"` (string - rejeitado)
- ❌ `[1, 2, 3]` (array de números - rejeitado)

### `menus`
- ✅ `undefined` (campo ausente)
- ✅ `null`
- ✅ `[]` (array vazio)
- ✅ `[{...}]` (array de objetos)
- ❌ `{}` (objeto - rejeitado)
- ❌ `"string"` (string - rejeitado)

## 🎯 Comportamento Correto

### Exemplo 1: `dependencies: null`
```json
{
  "name": "sistema",
  "displayName": "Sistema",
  "version": "1.0.0",
  "dependencies": null
}
```
**Resultado**: ✅ **ACEITO**

### Exemplo 2: `dependencies` ausente
```json
{
  "name": "sistema",
  "displayName": "Sistema",
  "version": "1.0.0"
}
```
**Resultado**: ✅ **ACEITO**

### Exemplo 3: `dependencies: []`
```json
{
  "name": "sistema",
  "displayName": "Sistema",
  "version": "1.0.0",
  "dependencies": []
}
```
**Resultado**: ✅ **ACEITO**

### Exemplo 4: `dependencies: ["modulo-base"]`
```json
{
  "name": "sistema",
  "displayName": "Sistema",
  "version": "1.0.0",
  "dependencies": ["modulo-base"]
}
```
**Resultado**: ✅ **ACEITO**

### Exemplo 5: `dependencies: {}` (ERRO)
```json
{
  "name": "sistema",
  "displayName": "Sistema",
  "version": "1.0.0",
  "dependencies": {}
}
```
**Resultado**: ❌ **REJEITADO** - "Campo 'dependencies' deve ser array ou null"

## 🚀 Teste Novamente

### 1. Backend já foi recompilado
```bash
✅ npm run build - Sucesso
```

### 2. Reinicie o backend
```bash
# No terminal do backend
Ctrl+C

npm run start:dev
```

### 3. Faça upload do `sistema.zip`
1. Acesse `http://localhost:3000/configuracoes/sistema/modulos`
2. Selecione `sistema.zip`
3. Clique em "Upload"

### 4. Logs esperados

```
🚀 Iniciando instalação de módulo...
1. Preparando buffer do arquivo...
✅ Buffer preparado: 11835 bytes
2. Analisando estrutura do ZIP...
✅ Estrutura detectada - Base: sistema
3. Validando module.json...
✅ module.json válido - Módulo: sistema v1.0.0
4. Validando nome seguro para filesystem...
✅ Nome seguro validado: sistema
5. Verificando se módulo já existe...
✅ Módulo sistema não existe - OK para instalar
6. Extraindo módulo de forma segura...
✅ 17 arquivo(s) extraído(s) com segurança
✅ Módulo extraído para: D:\...\modules\sistema
7. Registrando módulo no banco de dados...
✅ Módulo registrado - ID: abc123
8. Registrando X menu(s)...
✅ Menus registrados
9. Criando notificação de sucesso...
✅ Notificação criada
✅ Módulo sistema instalado com sucesso!
```

## ✅ Resumo das Alterações

| Arquivo | Linhas Alteradas | Mudança |
|---------|------------------|---------|
| `module-json.validator.ts` | 105-110 | Aceita `null` em `dependencies` |
| `module-json.validator.ts` | 112-117 | Aceita `null` em `menus` |
| `module-json.validator.ts` | 145-152 | Valida apenas se for array |

## 🎓 Lição Aprendida

### Validação de Campos Opcionais

```typescript
// ❌ ERRADO: Rejeita null
if (field !== undefined && !Array.isArray(field)) {
    throw new Error('Deve ser array');
}

// ✅ CORRETO: Aceita null e undefined
if (field !== undefined && field !== null && !Array.isArray(field)) {
    throw new Error('Deve ser array ou null');
}

// ✅ CORRETO: Valida conteúdo apenas se for array
if (field && Array.isArray(field)) {
    // Validar elementos do array
}
```

A correção permite que módulos tenham `dependencies: null` ou ausente, compatível com módulos que não têm dependências.
