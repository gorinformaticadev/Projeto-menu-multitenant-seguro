# 🎯 GUIA COMPLETO - Módulo de Demonstração

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Instalação](#instalação)
3. [Funcionalidades](#funcionalidades)
4. [Testes](#testes)
5. [Desenvolvimento](#desenvolvimento)

---

## 🎯 Visão Geral

O **módulo demo-completo** é uma referência completa que demonstra **TODAS** as capacidades do sistema modular CORE IDEAL.

### ✨ O que este módulo demonstra:

- ✅ **5 Permissões** customizadas
- ✅ **4 Itens de menu** (com roles e badges)
- ✅ **3 Widgets** de dashboard
- ✅ **4 Rotas API** (GET, POST, DELETE, pública)
- ✅ **1 Canal** de notificações
- ✅ **3 Event listeners** do sistema
- ✅ **Uso completo** do CoreContext
- ✅ **Shutdown gracioso**

---

## 📦 Instalação

### Automática (via ModuleLoader)

O módulo está em `modules/demo-completo/` e será carregado automaticamente:

```typescript
const loader = new ModuleLoader({
  modulesPath: './modules',
  coreVersion: '1.0.0',
});

await loader.loadAll(context);
```

### Verificar Carregamento

Após boot do sistema, você verá:

```
✅ Módulo registrado: demo-completo v1.0.0
✅ Carregado: demo-completo
   📋 5 permissões registradas
   🧭 4 itens de menu adicionados
   📊 3 widgets registrados
   🛣️ 4 rotas criadas
   📢 1 canal de notificação ativo
   👂 3 listeners de eventos configurados
```

---

## 🚀 Funcionalidades

### 1. Permissões

| Permissão | Descrição | Quem Tem |
|-----------|-----------|----------|
| `demo.view` | Visualizar demos | ADMIN, USER |
| `demo.create` | Criar demos | ADMIN |
| `demo.edit` | Editar demos | ADMIN |
| `demo.delete` | Excluir demos | ADMIN |
| `demo.admin` | Administração | SUPER_ADMIN |

### 2. Menu

```
Demonstrações (ordem: 20)
  ├─ Lista de Demos (ordem: 21)
  ├─ Nova Demo (ordem: 22, requer demo.create)
  └─ Admin Demo (ordem: 23, apenas SUPER_ADMIN)
```

### 3. Widgets de Dashboard

| Widget | Tamanho | Permissão | Features |
|--------|---------|-----------|----------|
| Estatísticas Demo | Médio | demo.view | Auto-refresh 30s |
| Atividades Recentes | Pequeno | demo.view | Closeable, Draggable |
| Painel Admin | Grande | demo.admin | Apenas SUPER_ADMIN |

### 4. API Endpoints

#### GET /api/demo

Lista todas as demos do tenant atual.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Demo 1",
      "description": "Descrição",
      "tenant_id": "uuid",
      "created_by": "uuid",
      "created_at": "2024-12-15T00:00:00Z"
    }
  ],
  "tenant": "Nome do Tenant",
  "requestId": "123-456-789"
}
```

**Permissão necessária:** `demo.view`

#### POST /api/demo

Cria uma nova demo.

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body:**
```json
{
  "title": "Minha Demo",
  "description": "Descrição da demo"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Minha Demo",
    "description": "Descrição da demo"
  },
  "message": "Demo criada com sucesso"
}
```

**Permissão necessária:** `demo.create`

**Features:**
- Usa transação de banco
- Salva no cache (5 min)
- Envia notificação ao criador

#### DELETE /api/demo/:id

Exclui uma demo.

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Demo excluída com sucesso"
}
```

**Permissão necessária:** `demo.delete`

**Features:**
- Limpa cache automaticamente
- Registra log da ação

#### GET /api/demo/public/stats

Rota pública (sem autenticação).

**Response:**
```json
{
  "success": true,
  "data": {
    "totalModules": 1,
    "version": "1.0.0",
    "status": "active",
    "uptime": 12345
  }
}
```

---

## 🧪 Testes

### Teste 1: Verificar Carregamento

```bash
# Verificar logs do sistema
# Deve mostrar: "✅ Módulo demo-completo inicializado"
```

### Teste 2: Testar Permissões

```bash
# Como ADMIN - deve ter acesso
curl http://localhost:4000/api/demo \
  -H "Authorization: Bearer {admin_token}"

# Como USER sem permissão - deve retornar 403
curl http://localhost:4000/api/demo \
  -H "Authorization: Bearer {user_token}"
```

### Teste 3: Criar Demo

```bash
curl -X POST http://localhost:4000/api/demo \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Demo de Teste",
    "description": "Testando criação via API"
  }'
```

### Teste 4: Listar Demos

```bash
curl http://localhost:4000/api/demo \
  -H "Authorization: Bearer {admin_token}"
```

### Teste 5: Excluir Demo

```bash
curl -X DELETE http://localhost:4000/api/demo/{demo_id} \
  -H "Authorization: Bearer {admin_token}"
```

### Teste 6: Rota Pública

```bash
# Sem autenticação - deve funcionar
curl http://localhost:4000/api/demo/public/stats
```

### Teste 7: Verificar Menu

1. Login como ADMIN
2. Verificar menu lateral
3. Deve aparecer "Demonstrações" com 4 subitens

### Teste 8: Verificar Dashboard

1. Login como ADMIN
2. Ir para dashboard
3. Verificar 3 widgets do módulo demo

### Teste 9: Verificar Notificações

```bash
# Criar uma demo e verificar notificação
# Logs devem mostrar: "📩 Notificação enviada: Demo Criada"
```

---

## 💻 Desenvolvimento

### Criar Módulo Baseado neste Template

```bash
# 1. Copiar módulo
cp -r modules/demo-completo modules/meu-modulo

# 2. Editar module.json
# Alterar: name, displayName, description

# 3. Editar index.ts
# Adaptar permissões, menus, rotas
```

### Estrutura Recomendada

```
meu-modulo/
├── module.json          # Metadados
├── index.ts             # Boot principal
├── README.md            # Documentação
├── migrations/          # SQL migrations
│   └── 001_create_tables.sql
├── seeds/               # Dados iniciais
│   └── seed.sql
└── frontend/            # Componentes (opcional)
    ├── components/
    └── pages/
```

### Checklist de Desenvolvimento

- [ ] Definir permissões necessárias
- [ ] Criar itens de menu
- [ ] Implementar rotas API
- [ ] Adicionar widgets (se necessário)
- [ ] Criar canal de notificações (se necessário)
- [ ] Escutar eventos relevantes
- [ ] Implementar shutdown gracioso
- [ ] Documentar tudo
- [ ] Testar com diferentes roles
- [ ] Validar multi-tenancy

---

## 📊 Monitoramento

### Logs a Observar

```
🚀 Iniciando módulo demo-completo...
📋 Registrando permissões...
🧭 Adicionando itens ao menu...
📊 Registrando widgets no dashboard...
🛣️ Registrando rotas...
📢 Registrando canal de notificação...
👂 Registrando listeners de eventos...
✅ Módulo demo-completo inicializado com sucesso!
```

### Eventos Disparados

- `module:registered` - Quando módulo é registrado
- `core:initialized` - Após inicialização do CORE
- `user:authenticated` - Login de usuário
- `tenant:resolved` - Tenant identificado
- `core:ready` - Sistema pronto

---

## 🔧 Troubleshooting

### Módulo não aparece no menu

- ✅ Verificar se está em `modules/`
- ✅ Verificar `module.json` válido
- ✅ Verificar permissões do usuário
- ✅ Checar logs de carregamento

### Rotas retornam 403

- ✅ Verificar token de autenticação
- ✅ Verificar permissões do usuário
- ✅ Checar tenant correto

### Widgets não aparecem

- ✅ Verificar permissões
- ✅ Verificar role do usuário
- ✅ Checar evento `dashboard:register`

### Notificações não funcionam

- ✅ Verificar canal registrado
- ✅ Checar handler do canal
- ✅ Verificar targets corretos

---

## 📚 Referências

- [Design do CORE](../.qoder/quests/modular-platform-core.md)
- [Implementação Completa](./CORE_IDEAL_IMPLEMENTACAO_COMPLETA.md)
- [README do CORE](../core/README.md)

---

## 🎯 Conclusão

Este módulo demonstra **100% das capacidades** do sistema modular CORE IDEAL:

- ✅ Modular e isolado
- ✅ Type-safe
- ✅ Multi-tenant
- ✅ Baseado em permissões
- ✅ Event-driven
- ✅ Totalmente documentado

Use-o como referência para criar seus próprios módulos!

**🚀 O CORE é estável. Os módulos são livres.**
