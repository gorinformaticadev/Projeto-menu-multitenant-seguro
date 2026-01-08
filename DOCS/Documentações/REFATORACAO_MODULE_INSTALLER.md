# 🔄 Refatoração Completa - Module Installer

## ✅ Arquivos Criados

### 1. `module-json.validator.ts`
- ✅ Validação completa do module.json
- ✅ Campos obrigatórios: name, displayName, version
- ✅ Validação de tipos
- ✅ Formato semântico de versão (X.Y.Z)
- ✅ Nome seguro para filesystem
- ✅ Previne nomes perigosos (.env, node_modules, etc)

### 2. `module-structure.validator.ts`
- ✅ Detecção automática de formato de ZIP (raiz limpa vs pasta raiz)
- ✅ Validação de Zip Slip
- ✅ Análise de estrutura antes da extração
- ✅ Detecção de backend/ e frontend/
- ✅ Previne múltiplas pastas raiz
- ✅ Validação de módulo não existente

## 🎯 Método Refatorado: `installModuleFromZip`

### Fluxo Novo (Profissional e Seguro)

```typescript
async installModuleFromZip(file: Express.Multer.File) {
    try {
        // 1️⃣ PREPARAR BUFFER
        const bufferToWrite = this.prepareFileBuffer(file);

        // 2️⃣ ANALISAR ESTRUTURA DO ZIP (SEM EXTRAIR)
        const structure = ModuleStructureValidator.analyzeZipStructure(bufferToWrite);

        // 3️⃣ VALIDAR MODULE.JSON
        const moduleJson = JSON.parse(structure.moduleJsonContent);
        const validatedModule = ModuleJsonValidator.validate(moduleJson);

        // 4️⃣ VALIDAR NOME SEGURO
        ModuleJsonValidator.validateSafeName(validatedModule.name);

        // 5️⃣ VALIDAR QUE NÃO EXISTE
        ModuleStructureValidator.validateModuleNotExists(
            validatedModule.name,
            this.modulesPath
        );

        // 6️⃣ EXTRAIR ZIP DE FORMA SEGURA
        const finalModulePath = path.join(this.modulesPath, validatedModule.name);
        await this.extractModuleSafely(bufferToWrite, structure, finalModulePath);

        // 7️⃣ REGISTRAR NO BANCO
        const module = await this.registerModuleInDatabase(
            validatedModule,
            structure,
            finalModulePath
        );

        // 8️⃣ REGISTRAR MENUS (SE HOUVER)
        if (validatedModule.menus && validatedModule.menus.length > 0) {
            await this.registerModuleMenus(module.id, validatedModule.menus);
        }

        // 9️⃣ NOTIFICAR SUCESSO
        await this.notifyModuleInstalled(validatedModule);

        return {
            success: true,
            module: {
                name: validatedModule.name,
                displayName: validatedModule.displayName,
                version: validatedModule.version,
                status: 'installed'
            },
            message: 'Módulo instalado. Execute preparação de banco antes de ativar.'
        };

    } catch (error) {
        this.logger.error('Erro ao instalar módulo:', error);
        throw error;
    }
}
```

## 🔧 Métodos Auxiliares Novos

### `prepareFileBuffer()`
```typescript
private prepareFileBuffer(file: Express.Multer.File): Buffer {
    if (Buffer.isBuffer(file.buffer)) {
        return file.buffer;
    }

    // Se file.buffer é Object serializado (bug conhecido)
    if (file.buffer && typeof file.buffer === 'object') {
        const bufferArray = Object.values(file.buffer);
        return Buffer.from(bufferArray as number[]);
    }

    throw new BadRequestException('Buffer de arquivo inválido');
}
```

### `extractModuleSafely()`
```typescript
private async extractModuleSafely(
    zipBuffer: Buffer,
    structure: ModuleStructureResult,
    destinationPath: string
): Promise<void> {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    // Criar diretório de destino
    fs.mkdirSync(destinationPath, { recursive: true });

    for (const entry of entries) {
        if (entry.isDirectory) {
            continue;
        }

        // Remover basePath se houver
        let relativePath = entry.entryName;
        if (structure.basePath) {
            if (!relativePath.startsWith(structure.basePath + '/')) {
                continue; // Ignorar arquivos fora da pasta raiz
            }
            relativePath = relativePath.substring(structure.basePath.length + 1);
        }

        // Validar path seguro
        ModuleStructureValidator.validateSafePath(relativePath);

        // Caminho final
        const targetPath = path.join(destinationPath, relativePath);

        // Criar diretórios intermediários
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // Extrair arquivo
        const data = entry.getData();
        fs.writeFileSync(targetPath, data);
    }

    this.logger.log(`✅ Módulo extraído para: ${destinationPath}`);
}
```

### `registerModuleInDatabase()`
```typescript
private async registerModuleInDatabase(
    moduleJson: ModuleJson,
    structure: ModuleStructureResult,
    modulePath: string
) {
    return await this.prisma.module.create({
        data: {
            slug: moduleJson.name,
            name: moduleJson.displayName,
            version: moduleJson.version,
            description: moduleJson.description || '',
            status: ModuleStatus.installed,
            hasBackend: structure.hasBackend,
            hasFrontend: structure.hasFrontend,
            installedAt: new Date()
        }
    });
}
```

## ✅ Validações Implementadas

### Validação de Estrutura
- ✅ Detecta formato raiz limpa vs pasta raiz
- ✅ Valida existência de module.json
- ✅ Previne múltiplas pastas raiz
- ✅ Identifica backend/ e frontend/

### Validação de Conteúdo
- ✅ Campos obrigatórios presentes
- ✅ Tipos corretos
- ✅ Versão semântica (1.0.0)
- ✅ Nome seguro (apenas a-zA-Z0-9_-)
- ✅ Comprimento de campos

### Validação de Segurança
- ✅ Previne Zip Slip (../)
- ✅ Previne paths absolutos
- ✅ Bloqueia nomes perigosos
- ✅ Normaliza todos os caminhos
- ✅ Valida módulo não existe

## 🎯 Benefícios da Refatoração

### Segurança
- ✅ Zip Slip prevenido
- ✅ Path traversal bloqueado
- ✅ Validação antes de extração
- ✅ Nomes seguros garantidos

### Robustez
- ✅ Suporta 2 formatos de ZIP
- ✅ Detecção automática de estrutura
- ✅ Validação em camadas
- ✅ Erros claros e específicos

### Manutenibilidade
- ✅ Código limpo e separado
- ✅ Validators reutilizáveis
- ✅ Logs informativos
- ✅ Sem caminhos fixos

### Compatibilidade
- ✅ Frontend não precisa mudar
- ✅ Database schema mantido
- ✅ Endpoints iguais
- ✅ Contratos preservados

## 📋 Próximos Passos

### 1. Aplicar Refatoração
- Substituir método `installModuleFromZip` completo
- Adicionar novos métodos auxiliares
- Remover código antigo obsoleto

### 2. Testar Ambos os Formatos
```bash
# Formato 1: Raiz limpa
# sistema.zip
# ├── module.json
# └── backend/

# Formato 2: Pasta raiz
# sistema.zip
# └── sistema/
#     ├── module.json
#     └── backend/
```

### 3. Validar Segurança
- Testar com ZIP malicioso (../)
- Testar com nomes perigosos
- Testar sobrescrita

### 4. Documentar
- Atualizar guias de criação de módulos
- Exemplos de module.json
- Estruturas válidas de ZIP

## 🚀 Como Aplicar

1. Os validators já estão criados ✅
2. Aplicar o código refatorado no service
3. Compilar: `npm run build`
4. Reiniciar backend
5. Testar com ambos os formatos de ZIP

## 📊 Comparação: Antes vs Depois

### ANTES (Problemático)
```typescript
// ❌ Caminho fixo baseado no nome do arquivo
const extractPath = path.join(this.modulesPath, path.parse(file.originalname).name);

// ❌ Extração cega sem validação
await this.extractZip(tempPath, extractPath);

// ❌ Validação depois da extração
const validation = await this.security.validateModuleStructure(...);

// ❌ Slug vem do module.json (pode não existir no momento)
```

### DEPOIS (Profissional)
```typescript
// ✅ Analisa estrutura ANTES de extrair
const structure = ModuleStructureValidator.analyzeZipStructure(buffer);

// ✅ Valida module.json ANTES de extrair
const validatedModule = ModuleJsonValidator.validate(moduleJson);

// ✅ Caminho dinâmico baseado no nome do módulo
const finalPath = path.join(this.modulesPath, validatedModule.name);

// ✅ Extração segura com validação de cada arquivo
await this.extractModuleSafely(buffer, structure, finalPath);
```

## ✅ Checklist de Implementação

- [x] Criar ModuleJsonValidator
- [x] Criar ModuleStructureValidator
- [x] Atualizar imports do service
- [ ] Refatorar installModuleFromZip completo
- [ ] Adicionar prepareFileBuffer
- [ ] Adicionar extractModuleSafely
- [ ] Adicionar registerModuleInDatabase
- [ ] Compilar e testar
- [ ] Documentar novos padrões

## 🎓 Padrões Aprendidos

### 1. Validar ANTES de Extrair
```typescript
// ❌ ERRADO: Extrair primeiro, validar depois
extract(zip);
validate(files);

// ✅ CORRETO: Validar primeiro, extrair depois
validate(zipStructure);
extract(zip);
```

### 2. Nome Dinâmico de Pasta
```typescript
// ❌ ERRADO: Nome do arquivo ZIP
const folder = path.parse(filename).name;

// ✅ CORRETO: Nome do module.json
const folder = moduleJson.name;
```

### 3. Detecção de Formato
```typescript
// ✅ Suportar múltiplos formatos
if (hasFileInRoot('module.json')) {
    // Formato raiz limpa
} else {
    // Formato pasta raiz
}
```

Essa refatoração torna o sistema profissional, seguro e robusto conforme solicitado.
