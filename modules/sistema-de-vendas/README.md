# Sistema de Vendas

## Descrição
Módulo para gerenciar vendas e clientes

## Autor
Equipe Dev

## Versão
1.0.0

## Instalação
Este módulo foi criado automaticamente usando o template do sistema de módulos robusto.

## Configuração
- Arquivo de configuração: `module.config.ts`
- Páginas: `module.pages.ts`
- Bootstrap: `module.bootstrap.ts`

## Páginas Disponíveis
- **Página Principal**: `/sistema-de-vendas`
- **Configurações**: `/sistema-de-vendas/settings`

## Como Usar
1. O módulo já está habilitado (`enabled: true`)
2. Acesse: `http://localhost:3000/modules/sistema-de-vendas`
3. Personalize as páginas em `frontend/pages/`
4. Modifique a configuração conforme necessário

## Estrutura
```
sistema-de-vendas/
├── module.config.ts      # Configuração do módulo
├── module.pages.ts       # Registro de páginas
├── module.bootstrap.ts   # Bootstrap e inicialização
└── frontend/
    └── pages/
        ├── index.js      # Página principal
        └── settings.js   # Página de configurações
```

## Segurança
- ✅ Sandbox habilitado
- ✅ Permissões estritas
- ✅ Validações de entrada
- ✅ Sanitização de dados

## Desenvolvimento
Para modificar este módulo:
1. Edite os arquivos em `frontend/pages/`
2. Atualize `module.config.ts` se necessário
3. Adicione novas páginas em `module.pages.ts`
4. Teste acessando as rotas do módulo

Criado automaticamente pelo Sistema de Módulos Robusto.
