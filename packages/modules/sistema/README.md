# 📦 Módulo de Sistema (@modules/sistema)

Este é o módulo principal ("Core") do Sistema Multitenant. Ele fornece funcionalidades essenciais de infraestrutura, monitoramento e configurações globais.

## 🏗 Estrutura do Pacote

Este módulo segue a arquitetura de **Monorepo Híbrido**, onde o código é mantido isolado em um pacote NPM privado, mas consome e injeta componentes na aplicação principal.

```text
packages/modules/sistema/
├── package.json          # Definição do pacote NPM (@modules/sistema)
├── tsconfig.json         # Configuração de TypeScript (com alias para @/frontend)
├── index.ts              # Ponto de entrada principal (Exports)
├── frontend/             # Código executado no Browser (Next.js)
│   ├── index.tsx         # Definição do módulo (FrontendModuleDefinition)
│   ├── components/       # Componentes React (Widgets, Pages)
│   │   └── SistemaWidget.tsx
│   └── pages/            # Páginas lazy-loaded (ex: /sistema/updates)
└── backend/              # Código executado no Servidor (NestJS)
    └── module.ts         # Definição do módulo Backend (NestJS Module)
```

## 🚀 Como Funciona a Integração

### 1. Registro no Frontend
O arquivo `frontend/index.tsx` exporta uma constante `SistemaModule` que segue a interface `FrontendModuleDefinition`.

```typescript
export const SistemaModule: FrontendModuleDefinition = {
    id: 'sistema',
    widgets: [ ... ] // Widgets injetados no dashboard
};
```

Esta definição é importada e registrada no `ModuleLoader.tsx` da aplicação principal:

```typescript
import { SistemaModule } from '@modules/sistema';
moduleRegistry.register(SistemaModule);
```

### 2. Widgets Dinâmicos
O `SistemaWidget` é um componente React padrão que é renderizado dentro do Dashboard. Diferente do sistema antigo (que gerava cards genéricos baseados em JSON), este sistema renderiza **o componente real**, permitindo:
- Interatividade total (botões, formulários)
- Hooks (useState, useEffect)
- Estilização customizada (Tailwind)

## 🛠 Como Estender este Módulo

### Adicionar um Novo Widget
1. Crie o componente em `frontend/components/MeuWidget.tsx`.
2. Importe-o em `frontend/index.tsx`.
3. Adicione ao array `widgets` na definição `SistemaModule`.

### Adicionar uma Nova Rota
(Em desenvolvimento - Suporte a rotas dinâmicas vindo na próxima versão da arquitetura).

## 📦 Comandos Úteis

Como este é um pacote do workspace, você deve rodar os comandos da raiz do monorepo:

- **Instalar dependências:** `npm install`
- **Adicionar lib ao módulo:** `npm install <lib> -w @modules/sistema`

---
*GOR Informática - Arquitetura Modular v2.0*
