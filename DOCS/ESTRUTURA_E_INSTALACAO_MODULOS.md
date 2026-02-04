# Guia Técnico: Estrutura e Instalação de Módulos

Este documento detalha o padrão exato exigido para a criação de módulos compatíveis com o instalador do sistema, explicando como os arquivos são processados, movidos e organizados durante a instalação.

## 1. Regra de Ouro (A Mais Importante)
O sistema **divide** o módulo em dois locais distintos durante a instalação. Para que tudo funcione (especialmente banco de dados), você deve seguir esta estrutura rigorosamente:

> **⚠️ ATENÇÃO:** As pastas `migrations` e `seeds` OBRIGATORIAMENTE devem estar DENTRO da pasta `backend`. Se estiverem na raiz, elas serão ignoradas e o módulo não criará as tabelas.

---

## 2. Estrutura do Módulo Fonte ("Modulo Original")
Esta é a estrutura que você deve montar na sua pasta de desenvolvimento ou no arquivo `.zip` para upload.

```text
meu-modulo/
├── module.json                (Obrigatório na raiz: Configurações e Menus)
├── frontend/                  (Tudo que é visual/React)
│   ├── pages/                 (SUAS ROTAS)
│   │   ├── dashboard/
│   │   │   └── page.tsx       (Rota: /modules/meu-modulo/dashboard)
│   │   └── page.tsx           (Rota raiz: /modules/meu-modulo)
│   ├── components/            (Seus componentes reutilizáveis)
│   ├── hooks/                 (Seus hooks personalizados)
│   └── utils/
└── backend/                   (Tudo que é lógica/NestJS/Banco)
    ├── migrations/            (SQL para criar tabelas - OBRIGATÓRIO AQUI)
    │   └── 001_initial.sql
    ├── seeds/                 (SQL para popular dados iniciais - OBRIGATÓRIO AQUI)
    ├── controllers/
    │   └── meu-modulo.controller.ts
    ├── services/
    ├── dto/
    └── meu-modulo.module.ts   (Entry Point - OBRIGATÓRIO NA RAIZ DO BACKEND)
```

---

## 3. O Que Acontece na Instalação?
O instalador lê o arquivo e aplica as seguintes regras de transformação:

### A. Frontend (O "Achatamento")
O sistema pega o conteúdo de `frontend/pages/` e joga **diretamente** na raiz da pasta do módulo no Frontend do sistema. Isso permite que o Next.js App Router funcione automaticamente sem criar rotas aninhadas desnecessárias como `/modules/meu-modulo/pages/dashboard`.

*   **Fonte**: `frontend/pages/dashboard/page.tsx`
*   **Destino**: `apps/frontend/src/app/modules/meu-modulo/dashboard/page.tsx`

As outras pastas (`components`, `hooks`) são copiadas normalmente como subpastas.

### B. Backend (Cópia Direta)
O sistema remove o prefixo `backend/` e copia todo o conteúdo para a pasta de módulos do servidor.

*   **Fonte**: `backend/controllers/teste.ts`
*   **Destino**: `apps/backend/src/modules/meu-modulo/controllers/teste.ts`

*   **Fonte**: `backend/meu-modulo.module.ts`
*   **Destino**: `apps/backend/src/modules/meu-modulo/meu-modulo.module.ts`

---

## 4. Tabela de Mapeamento (De -> Para)

| Tipo de Arquivo | Local no "Modulo Original" | Local Final no Sistema |
| :--- | :--- | :--- |
| **Configuração** | `/module.json` | `apps/backend/src/modules/[slug]/module.json` |
| **Rota (Página)** | `/frontend/pages/minha-rota/page.tsx` | `apps/frontend/src/app/modules/[slug]/minha-rota/page.tsx` |
| **Componente** | `/frontend/components/Botao.tsx` | `apps/frontend/src/app/modules/[slug]/components/Botao.tsx` |
| **Backend Entry** | `/backend/[slug].module.ts` | `apps/backend/src/modules/[slug]/[slug].module.ts` |
| **Controller** | `/backend/controllers/api.ts` | `apps/backend/src/modules/[slug]/controllers/api.ts` |
| **Migrations** | `/backend/migrations/01.sql` | `apps/backend/src/modules/[slug]/migrations/01.sql` |

---

## 5. Perguntas Frequentes (FAQ)

**1. Posso colocar meu controller na raiz do backend?**
Sim. Se você colocar em `/backend/meu.controller.ts`, ele irá para `.../modules/[slug]/meu.controller.ts`. O importante é atualizar o `import` dentro do seu arquivo `.module.ts`.

**2. Por que minha migration não rodou?**
Provavelmente ela estava em `/migrations` (raiz do módulo) em vez de `/backend/migrations`. O instalador só copia o que está dentro de `backend` ou `frontend`.

**3. O nome da pasta importa?**
Sim. O nome da pasta principal dentro de `apps/src/modules` (o `slug`) é definido pelo campo `"name"` dentro do seu `module.json`. Certifique-se de que ele seja único e seguro (sem espaços, sem caracteres especiais).
