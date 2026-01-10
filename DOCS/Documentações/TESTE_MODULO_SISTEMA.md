# 🧪 Como Testar o Módulo "Sistema" no Frontend

## ✅ Pré-requisitos Verificados

Antes de testar no navegador, confirme que tudo está OK executando:

```bash
node scripts/verify-integration.js
```

**Saída esperada**: Todos os 5 itens com ✅

## 🚀 Passos para Teste

### 1. Iniciar o Backend

```bash
cd backend
npm run start:dev
```

Aguarde até ver:
```
[Nest] Application successfully started
```

### 2. Iniciar o Frontend

**Novo terminal:**
```bash
cd frontend
npm run dev
```

Aguarde até ver:
```
ready - started server on 0.0.0.0:3000
```

### 3. Abrir o Navegador com DevTools

1. Abra `http://localhost:3000`
2. **Pressione F12** para abrir o Console do navegador
3. **Faça login** com:
   - Email: `admin@empresa1.com`
   - Senha: `admin123`

### 4. Verificar Logs no Console

Após o login, você deve ver no console:

```
📦 Carregando módulos...
🔄 [ModuleRegistry] Iniciando carregamento de módulos...
📡 [ModuleRegistry] Resposta da API: { modules: [...] }
✅ [ModuleRegistry] Módulos carregados da API: {
  total: 1,
  modulos: [{
    slug: 'sistema',
    name: 'Sistema',
    menus: 1
  }]
}
✅ Módulos carregados
```

Depois, quando o Sidebar renderizar:

```
📋 [Sidebar] Itens agrupados recebidos: {
  ungrouped: 1,
  groups: ['administration', 'sistema'],
  groupOrder: ['administration', 'sistema'],
  detalhes: {...}
}
🔍 [ModuleRegistry] Processando menus dos módulos: 1
  📝 Módulo sistema: 1 menus
     - Menu: Suporte, children: 3
  ✅ Adicionado grupo 'sistema' com 3 itens
✅ [ModuleRegistry] Grupos finais: ['administration', 'sistema']
```

### 5. Verificar o Menu Lateral

No sidebar, você deve ver:

```
📊 Dashboard
⚙️ Administração ▼
  ├── 🏢 Empresas
  ├── 👥 Usuários
  └── ⚙️ Configurações
📦 Sistema ▼           ← NOVO!
  ├── 📊 Dashboard
  ├── 🔔 Notificações
  └── ⚙️ Ajustes
```

### 6. Testar Navegação

Clique nos itens do módulo "Sistema":

1. **Dashboard** → `/modules/sistema/dashboard`
   - Deve mostrar a página do dashboard do módulo
   
2. **Notificações** → `/modules/sistema/notificacao`
   - Deve mostrar página de notificações (placeholder)
   
3. **Ajustes** → `/modules/sistema/ajustes`
   - Deve mostrar página de ajustes (placeholder)

## 🔍 Troubleshooting

### Problema: Nenhum módulo carrega

**Verificar no console**:
```javascript
moduleRegistry.debug()
```

**Se mostrar `Loaded: false`**:
```bash
# Terminal: Executar novamente
node scripts/sync-modules.js
node scripts/enable-module-for-all-tenants.js sistema
```

### Problema: API não retorna menus

**Verificar no terminal**:
```bash
node scripts/test-modules-api.js
```

**Se mostrar `"menus": []`**:
```bash
# Executar sync novamente
node scripts/sync-modules.js
```

### Problema: Grupo "sistema" não aparece no Sidebar

**No console do navegador**:
```javascript
// Verificar grupos disponíveis
const grouped = moduleRegistry.getGroupedSidebarItems('ADMIN')
console.log('Grupos:', Object.keys(grouped.groups))
console.log('Detalhes:', grouped)
```

**Se não mostrar 'sistema'**:
- Limpar cache do navegador (Ctrl+Shift+Delete)
- Fazer logout e login novamente
- Verificar se `moduleRegistry.loadModules()` foi chamado

### Problema: Sidebar não atualiza

1. **Forçar atualização**:
   - No console: `window.location.reload()`
   
2. **Verificar se loadModules foi chamado**:
   - Procurar no console por "📦 Carregando módulos..."
   - Se não aparecer, o AuthContext pode não estar chamando

3. **Recarregar módulos manualmente**:
   ```javascript
   await moduleRegistry.loadModules()
   window.location.reload()
   ```

## 📊 Debug Avançado

### Ver estado completo do ModuleRegistry

```javascript
// No console do navegador
console.log('Estado do ModuleRegistry:')
console.log('- Loaded:', moduleRegistry.isLoaded)
console.log('- Módulos:', moduleRegistry.modules)
console.log('- Menus disponíveis:', moduleRegistry.getAllMenus())
console.log('- Grupos:', moduleRegistry.getGroupedSidebarItems('ADMIN'))
```

### Forçar recarga de módulos

```javascript
// No console do navegador
await moduleRegistry.reload()
console.log('Módulos recarregados!')
// Depois recarregar a página
window.location.reload()
```

### Verificar dados brutos da API

```javascript
// No console do navegador
const response = await fetch('http://localhost:4000/me/modules', {
  headers: {
    'Authorization': 'Bearer ' + document.cookie.split('accessToken=')[1]?.split(';')[0]
  }
})
const data = await response.json()
console.log('Dados da API:', data)
```

## ✅ Checklist de Sucesso

- [ ] Backend rodando (porta 4000)
- [ ] Frontend rodando (porta 3000)
- [ ] Login bem-sucedido
- [ ] Console mostra "📦 Carregando módulos..."
- [ ] Console mostra "✅ Módulos carregados"
- [ ] Sidebar mostra grupo "Sistema"
- [ ] Grupo "Sistema" tem 3 sub-itens
- [ ] Clicar em "Dashboard" abre `/modules/sistema/dashboard`
- [ ] Clicar em "Notificações" abre `/modules/sistema/notificacao`
- [ ] Clicar em "Ajustes" abre `/modules/sistema/ajustes`

## 🎯 Resultado Esperado

Quando tudo estiver funcionando, você verá:

### No Sidebar (expandido):
```
┌────────────────────────────┐
│ Dashboard                  │
│                            │
│ Administração          ▼   │
│   Empresas                 │
│   Usuários                 │
│   Configurações            │
│                            │
│ Sistema                ▼   │  ← NOVO!
│   Dashboard                │
│   Notificações             │
│   Ajustes                  │
└────────────────────────────┘
```

### No Console:
```
✅ Login bem-sucedido
📦 Carregando módulos...
🔄 [ModuleRegistry] Iniciando carregamento...
📡 [ModuleRegistry] Resposta da API: {...}
✅ [ModuleRegistry] Módulos carregados: 1
✅ Módulos carregados
📋 [Sidebar] Itens agrupados: {groups: ['administration', 'sistema']}
🔍 [ModuleRegistry] Processando menus: 1
  📝 Módulo sistema: 1 menus
  ✅ Adicionado grupo 'sistema' com 3 itens
```

## 📝 Notas Importantes

1. **Cache do navegador**: Se fizer mudanças no código, limpe o cache (Ctrl+Shift+R)
2. **Hot Reload**: Next.js recarrega automaticamente, mas às vezes é necessário refresh manual
3. **Logs**: Todos os logs começam com emoji para fácil identificação
4. **Timing**: O carregamento de módulos acontece após login, não na inicialização
5. **Persistência**: Dados ficam salvos no banco, não precisa rodar scripts toda vez

## 🆘 Se Nada Funcionar

Execute em sequência:

```bash
# 1. Sincronizar módulos
node scripts/sync-modules.js

# 2. Ativar para todos os tenants
node scripts/enable-module-for-all-tenants.js sistema

# 3. Verificar tudo
node scripts/verify-integration.js

# 4. Gerar rotas frontend
cd frontend
node scripts/generate-module-index.js
cd ..

# 5. Reiniciar tudo
# Ctrl+C no backend e frontend
# Depois:
cd backend && npm run start:dev
# Novo terminal:
cd frontend && npm run dev
```

Depois abra o navegador em modo privado (Ctrl+Shift+N) e teste novamente.
