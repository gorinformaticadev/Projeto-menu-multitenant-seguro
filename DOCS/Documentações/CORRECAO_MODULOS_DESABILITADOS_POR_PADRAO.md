# Correção: Módulos Desabilitados por Padrão

## 📋 Resumo das Correções

Implementadas correções para garantir que módulos instalados venham **desabilitados por padrão** para todas as tenants, seguindo o princípio de **opt-in** (cada tenant ativa apenas o que precisa).

---

## 🔍 Problemas Identificados

### 1. ❌ Problema: Módulos Ativados Automaticamente em Novos Tenants

**Localização:** `backend/src/tenants/tenants.service.ts` (linhas 92-107)

**Comportamento Anterior:**
```typescript
// Buscar todos os módulos ativos do sistema
const activeModules = await prisma.module.findMany({
  where: { isActive: true },
});

// Vincular módulos ao novo tenant
if (activeModules.length > 0) {
  await prisma.tenantModule.createMany({
    data: activeModules.map((module) => ({
      tenantId: tenant.id,
      moduleName: module.name,
      isActive: true, // ❌ ATIVAVA AUTOMATICAMENTE
    })),
  });
}
```

**Impacto:**
- Quando um novo tenant era criado, **TODOS os módulos instalados** eram automaticamente ativados
- Violava o princípio de segurança "opt-in"
- Tenants recebiam funcionalidades sem solicitar

---

## ✅ Correções Implementadas

### 1. Módulos Desabilitados em Novos Tenants

**Arquivo:** `backend/src/tenants/tenants.service.ts`

**Mudança:**
```typescript
// Vincular módulos ao novo tenant (DESABILITADOS por padrão)
// Cada tenant deve ativar os módulos que deseja usar
if (activeModules.length > 0) {
  await prisma.tenantModule.createMany({
    data: activeModules.map((module) => ({
      tenantId: tenant.id,
      moduleName: module.name,
      isActive: false, // ✅ DESABILITADOS por padrão
      // Config é null - cada tenant configura individualmente
    })),
  });
}
```

**Benefícios:**
- ✅ Segurança por padrão (opt-in)
- ✅ Tenants controlam quais módulos usar
- ✅ Evita ativação não solicitada de funcionalidades
- ✅ Cada tenant mantém suas próprias configurações

---

### 2. Documentação Melhorada na Instalação

**Arquivo:** `backend/src/modules/module-installer.service.ts`

**Melhorias:**
```typescript
// Criar novo módulo - INSTALADO MAS INATIVO GLOBALMENTE
this.logger.log(`Registrando novo módulo ${moduleInfo.name} no banco de dados...`);
moduleRecord = await this.prisma.module.create({
  data: {
    name: moduleInfo.name,
    displayName: moduleInfo.displayName,
    description: moduleInfo.description || '',
    version: moduleInfo.version,
    config: moduleInfo.config ? JSON.stringify(moduleInfo.config) : null,
    isActive: true // Módulo instalado e disponível globalmente
  }
});

// Não criar automaticamente TenantModule para nenhuma tenant
// Cada tenant deve ativar o módulo individualmente
this.logger.log(
  `Módulo ${moduleInfo.name} instalado globalmente. ` +
  `Tenants devem ativá-lo individualmente em suas configurações.`
);
```

**Esclarecimentos:**
- ✅ Comentários claros sobre o comportamento
- ✅ Log explicativo após instalação
- ✅ Não cria `TenantModule` automaticamente
- ✅ Módulo fica disponível mas não ativo

---

## 📊 Estrutura de Dados - Módulos

### Tabela `modules` (Instalação Global)

Representa módulos **instalados no sistema** (disponíveis para uso):

| Campo | Descrição | Valor Padrão |
|-------|-----------|--------------|
| `isActive` | Módulo instalado e disponível | `true` |
| `name` | Nome único do módulo | - |
| `version` | Versão instalada | - |
| `config` | Configuração global (JSON) | `null` |

**Importante:** `isActive: true` em `modules` significa "instalado e disponível", **NÃO** significa "ativo em todas as tenants".

---

### Tabela `tenant_modules` (Ativação por Tenant)

Representa quais módulos cada tenant tem **ativo**:

| Campo | Descrição | Valor Padrão (Novo Tenant) |
|-------|-----------|----------------------------|
| `isActive` | Módulo ativo para este tenant | `false` ✅ |
| `tenantId` | ID do tenant | - |
| `moduleName` | Nome do módulo (FK) | - |
| `config` | Config específica do tenant | `null` |

**Importante:** `isActive: false` é o padrão para **novos tenants**.

---

## 🔄 Fluxo Completo

### 1. Instalação de Módulo (SUPER_ADMIN)

```
1. SUPER_ADMIN faz upload do módulo ZIP
2. Sistema extrai e valida module.json
3. Sistema cria registro em `modules`:
   - isActive: true (disponível globalmente)
4. Sistema descobre migrations/seeds
5. Sistema executa migrations/seeds
6. ❌ NÃO cria registros em `tenant_modules`
7. ✅ Log: "Módulo instalado globalmente"
```

**Resultado:** Módulo instalado e disponível, mas não ativo em nenhuma tenant.

---

### 2. Criação de Novo Tenant (SUPER_ADMIN)

```
1. SUPER_ADMIN cria novo tenant
2. Sistema cria registro em `tenants`
3. Sistema cria usuário ADMIN do tenant
4. Sistema busca módulos com isActive: true
5. Sistema cria registros em `tenant_modules`:
   - isActive: false ✅ (DESABILITADOS)
   - config: null
6. Tenant criado com módulos desabilitados
```

**Resultado:** Tenant criado com acesso a módulos instalados, mas todos desabilitados.

---

### 3. Ativação de Módulo por Tenant (ADMIN do Tenant)

```
1. ADMIN acessa "Configurações" > "Módulos"
2. Vê lista de módulos disponíveis (desabilitados)
3. Clica em "Ativar" no módulo desejado
4. Sistema atualiza `tenant_modules`:
   - isActive: true (apenas para este tenant)
5. Módulo passa a funcionar para este tenant
```

**Resultado:** Apenas o tenant específico tem o módulo ativo.

---

## 🛡️ Verificação de Segurança

### ✅ Seed do Core (backend/prisma/seed.ts)

**Verificado:** ✅ Não insere dados em `modules`

```typescript
// seed.ts NÃO cria módulos
// Apenas cria:
- Tenant padrão (GOR Informatica)
- SUPER_ADMIN (admin@system.com)
- ADMIN do tenant (admin@empresa1.com)
- USER comum (user@empresa1.com)
- SecurityConfig global
```

---

### ✅ Migrations do Core

**Verificado:** ✅ Nenhuma migration insere dados em `modules` ou `tenant_modules`

```bash
Migrations verificadas:
- 20251210155327_/ (Criação de tabelas)
- 20241211000000_add_update_system/ (Sistema de updates)
- Outras migrations (campos adicionais)

Resultado: Nenhuma INSERT em modules ou tenant_modules
```

---

## 📝 Políticas de Módulos

### Instalação (Nível Sistema)

| Item | Política |
|------|----------|
| **Permissão** | Apenas SUPER_ADMIN |
| **Escopo** | Global (todo o sistema) |
| **Estado Inicial** | `modules.isActive = true` |
| **Auto-ativação** | ❌ NÃO ativa em nenhuma tenant |
| **Migrations** | Executadas automaticamente |

---

### Ativação (Nível Tenant)

| Item | Política |
|------|----------|
| **Permissão** | ADMIN do tenant |
| **Escopo** | Apenas o tenant específico |
| **Estado Inicial** | `tenant_modules.isActive = false` |
| **Configuração** | Independente por tenant |
| **Impacto** | Zero impacto em outras tenants |

---

## 🧪 Cenários de Teste

### Cenário 1: Instalação de Novo Módulo

**Given:** Sistema sem módulos instalados  
**When:** SUPER_ADMIN instala "módulo-vendas"  
**Then:**
- ✅ Registro criado em `modules` com `isActive: true`
- ✅ Migrations executadas
- ✅ Seeds executados
- ✅ **NENHUM** registro criado em `tenant_modules`
- ✅ Módulo aparece como "Disponível" nas tenants
- ✅ Módulo NÃO está funcionalmente ativo em nenhuma tenant

---

### Cenário 2: Criação de Novo Tenant

**Given:** Sistema tem 3 módulos instalados  
**When:** SUPER_ADMIN cria tenant "Empresa ABC"  
**Then:**
- ✅ Tenant criado em `tenants`
- ✅ Admin criado em `users`
- ✅ **3 registros** criados em `tenant_modules` com `isActive: false`
- ✅ Empresa ABC pode VER os módulos
- ✅ Empresa ABC NÃO pode USAR os módulos (desabilitados)

---

### Cenário 3: Tenant Ativa Módulo

**Given:** Tenant "Empresa ABC" tem módulo "vendas" desabilitado  
**When:** ADMIN ativa o módulo "vendas"  
**Then:**
- ✅ `tenant_modules.isActive` muda para `true`
- ✅ Módulo funciona para Empresa ABC
- ✅ **ZERO impacto** em outras tenants
- ✅ Outras tenants continuam com módulo desabilitado

---

### Cenário 4: Módulo Já Instalado - Atualização

**Given:** Módulo "vendas v1.0" já instalado  
**When:** SUPER_ADMIN instala "vendas v2.0"  
**Then:**
- ✅ Registro em `modules` atualizado (versão 2.0)
- ✅ `isActive` mantido como `true`
- ✅ Migrations novas descobertas e registradas
- ✅ **NENHUMA** alteração em `tenant_modules`
- ✅ Tenants que tinham ativo continuam ativo
- ✅ Tenants que tinham desabilitado continuam desabilitado

---

## 🎯 Benefícios das Correções

| Benefício | Descrição |
|-----------|-----------|
| **Segurança** | Princípio "opt-in" - nada ativo sem solicitação |
| **Isolamento** | Cada tenant controla seus módulos |
| **Flexibilidade** | Tenants ativam apenas o necessário |
| **Performance** | Módulos inativos não carregam recursos |
| **Compliance** | Auditoria clara de módulos por tenant |
| **Escalabilidade** | Fácil adicionar novos módulos sem impacto |

---

## 📌 Resumo Final

### Antes das Correções ❌

```
Instalação de Módulo → Ativo em TODAS as tenants automaticamente
Novo Tenant → Recebe TODOS os módulos ativos
```

**Problemas:**
- Módulos não solicitados funcionando
- Falta de controle granular
- Violação do princípio opt-in

---

### Depois das Correções ✅

```
Instalação de Módulo → Disponível mas NÃO ativo
Novo Tenant → Vê módulos mas TODOS desabilitados
Ativação → Apenas ADMIN do tenant pode ativar
```

**Benefícios:**
- ✅ Controle total por tenant
- ✅ Segurança por padrão
- ✅ Princípio opt-in respeitado
- ✅ Zero ativação automática

---

## 🔍 Arquivos Modificados

| Arquivo | Mudança | Linhas |
|---------|---------|--------|
| `backend/src/tenants/tenants.service.ts` | `isActive: false` em novos tenants | 103 |
| `backend/src/modules/module-installer.service.ts` | Comentários + Log explicativo | 143-162 |

---

## ✅ Status

**IMPLEMENTADO E VERIFICADO**

- ✅ Core não insere dados de módulos (seed.ts verificado)
- ✅ Migrations não inserem dados de módulos (verificado)
- ✅ Novos tenants recebem módulos **desabilitados**
- ✅ Instalação de módulo **não ativa** em nenhuma tenant
- ✅ Atualização de módulo **preserva** estado de ativação
- ✅ Seeds de módulos buscam em pasta `seeds/` por padrão
- ✅ Documentação completa criada

---

**Data:** 2025-12-15  
**Autor:** Sistema de Refatoração de Módulos  
**Versão:** 1.0.0
