# Módulo Boas-Vindas

## 📦 Visão Geral

Módulo de boas-vindas e tutorial do sistema, projetado para facilitar a integração de novos usuários através de um guia interativo e intuitivo.

## 🎯 Funcionalidades

### 1. Menu Lateral
- **Tutorial** - Item único no menu lateral que leva à página de boas-vindas

### 2. Página de Tutorial
- Cards interativos com tutoriais por categoria:
  - 📊 Dashboard
  - 🧩 Módulos
  - ⚙️ Configurações
  - 👥 Usuários
  - 🔒 Segurança
  - 💬 Suporte

- Seção de "Primeiros Passos" com guia numerado
- Botões de navegação rápida

## 📁 Estrutura de Arquivos

```
boas-vindas/
├── module.config.ts           # Configurações do módulo
├── module.pages.ts            # Definição de páginas
├── README.md                  # Este arquivo
│
├── frontend/
│   └── pages/
│       └── tutorial.js        # Página de tutorial
│
├── migrations/                # Migrations de banco de dados
│   └── .gitkeep              # Documentação do diretório
│
└── seeds/                     # Seeds de dados iniciais
    └── .gitkeep              # Documentação do diretório
```

## 🚀 Como Usar

### 1. Ativação do Módulo

O módulo já vem habilitado por padrão (`enabled: true` em `module.config.ts`).

### 2. Acesso ao Tutorial

Após fazer login:
1. Abra o menu lateral
2. Procure por "Tutorial"
3. Clique para acessar a página de boas-vindas

### 3. Navegação

A página de tutorial oferece:
- Cards clicáveis para explorar diferentes funcionalidades
- Guia de primeiros passos
- Botões de navegação rápida para Dashboard, Módulos e Perfil

## 🔧 Desenvolvimento

### Migrations

Coloque migrations SQL ou JavaScript em `migrations/`:
```
migrations/
├── 20241215000001_create_welcome_settings.sql
└── 20241215000002_add_tutorial_progress.sql
```

**Padrão de nomenclatura:**
- Formato: `YYYYMMDDHHMMSS_descricao.sql`
- Timestamp único para ordenação

### Seeds

Coloque seeds em `seeds/`:
```
seeds/
├── 01_welcome_messages.sql
└── 02_tutorial_steps.sql
```

**Padrão de nomenclatura:**
- Formato: `XX_descricao.sql` (XX = ordem de execução)
- Numeração sequencial (01, 02, 03...)

## 📝 Configuração

### module.config.ts

```typescript
{
  name: 'Boas-Vindas',
  slug: 'boas-vindas',
  version: '1.0.0',
  enabled: true,
  permissionsStrict: false,
  sandboxed: true
}
```

### module.pages.ts

```typescript
{
  id: 'boas-vindas.tutorial',
  path: '/boas-vindas/tutorial',
  component: 'TutorialPage',
  protected: false,
  permissions: []
}
```

## 🎨 Personalização

### Adicionar Novo Card de Tutorial

Edite `frontend/pages/tutorial.js`:

```javascript
const newTutorial = document.createElement('div');
newTutorial.className = 'bg-white rounded-lg shadow-md p-6...';
newTutorial.innerHTML = `
  <div class="flex items-center gap-3 mb-4">
    <div class="w-12 h-12 bg-COLOR-100 rounded-lg...">
      <span class="text-2xl">EMOJI</span>
    </div>
    <h3 class="text-lg font-semibold">TÍTULO</h3>
  </div>
  <p class="text-sm text-gray-600 mb-4">DESCRIÇÃO</p>
  <button class="text-sm text-COLOR-600...">Saiba mais →</button>
`;
tutorialsGrid.appendChild(newTutorial);
```

### Adicionar Passo na Seção "Primeiros Passos"

Edite a seção `stepsSection` em `frontend/pages/tutorial.js`.

## 🧪 Testes

### Verificar Estrutura
```bash
# Listar arquivos do módulo
ls -la modules/boas-vindas/
```

### Testar Carregamento
1. Inicie a aplicação: `npm run dev`
2. Faça login
3. Acesse: `http://localhost:3000/modules/boas-vindas/tutorial`
4. Verifique console para erros

### Validar Menu
1. Abra menu lateral
2. Procure item "Tutorial"
3. Clique e verifique navegação

## 📊 Integração com Module Registry

O módulo é automaticamente registrado no `module-loader.ts`:

```typescript
{
  id: 'boas-vindas',
  name: 'Boas-Vindas',
  version: '1.0.0',
  enabled: true,
  sidebar: [{
    id: 'tutorial',
    name: 'Tutorial',
    href: '/modules/boas-vindas/tutorial',
    icon: 'BookOpen',
    order: 1
  }]
}
```

## 🔒 Segurança

- **Sandbox:** Ativado (`sandboxed: true`)
- **Permissões:** Não restritas (`permissionsStrict: false`)
- **Proteção:** Rota pública (`protected: false`)

## 📦 Dependências

Nenhuma dependência externa além do sistema base.

## 🐛 Troubleshooting

### Módulo não aparece no menu
1. Verifique `module.config.ts` - `enabled: true`
2. Confirme registro em `module-loader.ts`
3. Execute: `window.__moduleExemploInit.check()`

### Erro ao carregar página
1. Verifique console para erros JavaScript
2. Confirme que `tutorial.js` existe
3. Valide nome da função: `window.BoasVindasTutorialPage`

### Migrations não executam
1. Verifique formato de nome dos arquivos
2. Confirme sintaxe SQL
3. Teste migration isoladamente

## 📈 Futuras Melhorias

- [ ] Adicionar progresso de tutorial por usuário
- [ ] Implementar tours guiados interativos
- [ ] Adicionar vídeos explicativos
- [ ] Criar quizzes de verificação
- [ ] Sistema de badges por conclusão
- [ ] Integração com sistema de notificações

## 📞 Suporte

Para dúvidas ou problemas:
1. Consulte a documentação geral em `modules/`
2. Verifique logs do console
3. Execute scripts de diagnóstico

---

**Versão:** 1.0.0  
**Status:** ✅ Operacional  
**Última Atualização:** 15/12/2024
