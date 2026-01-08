# Correção: Endpoint de Atualização de Banco de Dados

## 📋 Problema Identificado

**Erro ao clicar no botão "Atualizar Banco":**
```
Erro ao atualizar banco de dados
Cannot POST /configuracoes/sistema/modulos/sistema/update-database
```

## 🔍 Causa Raiz

Incompatibilidade entre a rota definida no backend e a chamada feita pelo frontend:

- **Backend** (correto): `/configuracoes/sistema/modulos/:slug/update-db`
- **Frontend** (incorreto): `/configuracoes/sistema/modulos/:slug/update-database`

## ✅ Correção Aplicada

### Arquivo Corrigido
`frontend/src/app/configuracoes/sistema/modulos/components/ModuleManagement.tsx`

### Mudança na Linha 230
```diff
- const response = await api.post(`/configuracoes/sistema/modulos/${moduleName}/update-database`);
+ const response = await api.post(`/configuracoes/sistema/modulos/${moduleName}/update-db`);
```

### Comentário Atualizado (Linha 229)
```diff
- // Endpoint correto: /configuracoes/sistema/modulos/:slug/update-database
+ // Endpoint correto: /configuracoes/sistema/modulos/:slug/update-db
```

## 📖 Endpoints Corretos do Sistema de Módulos

Conforme definido em `backend/src/core/module-installer.controller.ts`:

| Ação | Método | Endpoint | Linha |
|------|--------|----------|-------|
| **Listar módulos** | GET | `/configuracoes/sistema/modulos` | 35 |
| **Upload de módulo** | POST | `/configuracoes/sistema/modulos/upload` | 44 |
| **Ativar módulo** | POST | `/configuracoes/sistema/modulos/:slug/activate` | 137 |
| **Desativar módulo** | POST | `/configuracoes/sistema/modulos/:slug/deactivate` | 146 |
| **Atualizar banco** | POST | `/configuracoes/sistema/modulos/:slug/update-db` | 155 ✅ |
| **Status do módulo** | GET | `/configuracoes/sistema/modulos/:slug/status` | 164 |
| **Desinstalar módulo** | DELETE | `/configuracoes/sistema/modulos/:slug/uninstall` | 173 |

## 🎯 Fluxo Correto de Instalação

### 1. Upload do Módulo
```http
POST /configuracoes/sistema/modulos/upload
Content-Type: multipart/form-data

file: [arquivo.zip]
```
**Resultado**: Status `installed`

### 2. Atualizar Banco de Dados ✅
```http
POST /configuracoes/sistema/modulos/sistema/update-db
```
**Resultado**: Executa migrations e seeds, status muda para `db_ready`

### 3. Ativar Módulo
```http
POST /configuracoes/sistema/modulos/sistema/activate
```
**Resultado**: Status `active`

## 🧪 Como Testar

1. Acesse `/configuracoes/sistema/modulos`
2. Faça upload do módulo (deve mostrar status `installed`)
3. Clique em "Atualizar Banco"
4. Deve executar com sucesso e mostrar:
   ```
   Banco de dados atualizado!
   Migrações e seed executados com sucesso
   ```
5. Status do módulo deve mudar para `db_ready`
6. Botão "Ativar" deve ficar disponível

## 🔒 Validações do Endpoint

O endpoint `update-db` (linha 155-158 do controller) realiza:

1. ✅ Verifica se módulo existe
2. ✅ Valida status === `installed`
3. ✅ Executa migrations em ordem alfabética
4. ✅ Executa seeds em ordem alfabética
5. ✅ Registra cada execução em `ModuleMigration`
6. ✅ Atualiza status para `db_ready`
7. ✅ Cria notificação de sucesso

## 📚 Referências

- **Controller**: `backend/src/core/module-installer.controller.ts` (linha 155)
- **Service**: `backend/src/core/module-installer.service.ts` (método `updateModuleDatabase`)
- **Frontend**: `frontend/src/app/configuracoes/sistema/modulos/components/ModuleManagement.tsx` (linha 225-249)
- **Documentação do Ciclo de Vida**: `DOCS/IMPLEMENTACAO_CICLO_VIDA_MODULOS.md`

---

**Data da Correção**: 18 de dezembro de 2024
**Arquivo Modificado**: `ModuleManagement.tsx`
**Status**: ✅ Corrigido e testável
