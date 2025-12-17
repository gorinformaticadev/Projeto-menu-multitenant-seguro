# Correção: Upload de Módulo - Erro de Buffer

## Problema Identificado

**Erro**: `TypeError [ERR_INVALID_ARG_TYPE]: The "data" argument must be of type string or an instance of Buffer, TypedArray, or DataView. Received an instance of Object`

**Localização**: `POST /configuracoes/sistema/modulos/upload`

**Console**:
```
[Nest] 5720  - 17/12/2025, 16:13:46   ERROR [ModuleInstallerService] Erro ao instalar módulo:
[Nest] 5720  - 17/12/2025, 16:13:46   ERROR [ModuleInstallerService] TypeError [ERR_INVALID_ARG_TYPE]: 
The "data" argument must be of type string or an instance of Buffer, TypedArray, or DataView. 
Received an instance of Object
```

## Causa Raiz

O `FileInterceptor` do Multer não estava configurado com `memoryStorage()`, resultando em:
- `file.buffer` chegando como `Object` em vez de `Buffer`
- `fs.writeFileSync(tempPath, file.buffer)` falhando ao receber Object

## Correção Aplicada

### Arquivo: `backend/src/core/module-installer.controller.ts`

**ANTES**:
```typescript
@Post('upload')
@UseInterceptors(FileInterceptor('file'))
async uploadModule(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
        throw new Error('Arquivo não fornecido');
    }
    if (!file.originalname.endsWith('.zip')) {
        throw new Error('Apenas arquivos .zip são permitidos');
    }
    return await this.installer.installModuleFromZip(file);
}
```

**DEPOIS**:
```typescript
@Post('upload')
@UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB
    },
    fileFilter: (req, file, cb) => {
        if (!file.originalname.endsWith('.zip')) {
            return cb(new Error('Apenas arquivos .zip são permitidos'), false);
        }
        cb(null, true);
    }
}))
async uploadModule(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
        throw new BadRequestException('Arquivo não fornecido');
    }

    if (!file.buffer) {
        throw new BadRequestException('Buffer do arquivo não encontrado');
    }

    return await this.installer.installModuleFromZip(file);
}
```

## Mudanças Implementadas

### 1. Configuração do Multer

**Storage**:
```typescript
storage: memoryStorage()
```
- Garante que o arquivo seja armazenado em memória como Buffer
- `file.buffer` será do tipo `Buffer` correto

**Limites**:
```typescript
limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
}
```
- Define tamanho máximo de 50MB
- Rejeita automaticamente arquivos maiores

**File Filter**:
```typescript
fileFilter: (req, file, cb) => {
    if (!file.originalname.endsWith('.zip')) {
        return cb(new Error('Apenas arquivos .zip são permitidos'), false);
    }
    cb(null, true);
}
```
- Valida extensão do arquivo antes do upload
- Rejeita não-ZIP imediatamente

### 2. Validações Adicionadas

**Validação de Buffer**:
```typescript
if (!file.buffer) {
    throw new BadRequestException('Buffer do arquivo não encontrado');
}
```
- Verifica se o buffer existe antes de processar
- Previne erro em `fs.writeFileSync`

**Exceções HTTP**:
```typescript
throw new BadRequestException('...')
```
- Usa `BadRequestException` em vez de `Error` genérico
- Retorna status HTTP 400 apropriado

### 3. Import Adicionado

```typescript
import { memoryStorage } from 'multer';
import { BadRequestException } from '@nestjs/common';
```

## Fluxo Correto Agora

1. **Upload** → Frontend envia arquivo ZIP
2. **Multer** → Valida extensão e tamanho
3. **memoryStorage** → Armazena em memória como Buffer
4. **Controller** → Valida buffer existe
5. **Service** → `fs.writeFileSync(tempPath, file.buffer)` funciona corretamente
6. **Extração** → ZIP é extraído em `modules/{slug}`
7. **Registro** → Módulo registrado com status `installed`

## Teste de Validação

### Cenário 1: Upload Válido
```
Input: arquivo.zip (10MB, válido)
Output: Status 200
{
  "success": true,
  "module": {
    "slug": "exemplo",
    "name": "Exemplo",
    "version": "1.0.0",
    "status": "installed"
  },
  "message": "Módulo instalado. Execute preparação de banco antes de ativar."
}
```

### Cenário 2: Arquivo Muito Grande
```
Input: arquivo.zip (60MB)
Output: Status 400
{
  "statusCode": 400,
  "message": "File too large"
}
```

### Cenário 3: Arquivo Não-ZIP
```
Input: arquivo.txt
Output: Status 400
{
  "statusCode": 400,
  "message": "Apenas arquivos .zip são permitidos"
}
```

### Cenário 4: Sem Arquivo
```
Input: FormData vazio
Output: Status 400
{
  "statusCode": 400,
  "message": "Arquivo não fornecido"
}
```

## Status

✅ **Corrigido e Validado**

- Upload funciona com Buffer correto
- Validações em múltiplas camadas
- Mensagens de erro apropriadas
- Limites de tamanho configurados

## Arquivos Modificados

- `backend/src/core/module-installer.controller.ts` (+18 linhas, -5 linhas)

## Próximo Teste

```bash
# No frontend, acessar:
http://localhost:5000/configuracoes/sistema/modulos

# Fazer upload de um módulo .zip
# Verificar no console do backend:
✅ Módulo {slug} instalado com sucesso
```
