# Module Exemplo

## 📝 Descrição
Módulo de exemplo para demonstração do sistema modular robusto. Serve como referência para criação de novos módulos.

## 📦 Versão
**1.0.0**

## 👤 Autor
Sistema Core

## 📄 Páginas Fornecidas
- **Index** (`/module-exemplo`) - Página principal do módulo
- **Settings** (`/module-exemplo/settings`) - Configurações do módulo

## 🔐 Permissões Necessárias
- `module-exemplo.view` - Visualizar páginas do módulo
- `module-exemplo.settings` - Acessar configurações do módulo

## 🛡️ Configurações de Segurança
- **Sandboxed:** ✅ Sim
- **Permissions Strict:** ✅ Sim
- **Allow Eval:** ❌ Não
- **Allow Window Access:** ❌ Não
- **Requires Auth:** ✅ Sim

## 📥 Instalação

### Via Interface Web (Recomendado)
1. Acesse `/settings/modules` como SUPER_ADMIN
2. Faça upload do arquivo ZIP do módulo
3. Aguarde a validação automática
4. Clique em "Validar" se necessário
5. Clique em "Ativar" para habilitar o módulo

### Via Sistema de Arquivos
1. Copie a pasta do módulo para `/modules/`
2. O sistema detectará automaticamente
3. Valide e ative via interface

## 🏗️ Estrutura de Arquivos
```
module-exemplo/
├── module.config.ts      # Configuração do módulo
├── module.bootstrap.ts   # Bootstrap e registro
├── module.pages.ts       # Declaração de páginas
├── module.config.json    # Configuração adicional
├── module.json           # Metadados
├── README.md             # Este arquivo
└── frontend/
    ├── pages/
    │   ├── index.js      # Página principal
    │   └── settings.js   # Página de configurações
    └── components/       # Componentes reutilizáveis
```

## 🚀 Uso
Após ativado, o módulo estará disponível no menu lateral e suas páginas poderão ser acessadas pelos usuários com as permissões adequadas.

## 🔧 Desenvolvimento
Para modificar este módulo:
1. Edite os arquivos necessários
2. Teste localmente
3. Crie um novo ZIP
4. Faça upload da nova versão

## 📚 Documentação Adicional
- [Guia de Desenvolvimento de Módulos](../docs/module-development.md)
- [API de Módulos](../docs/module-api.md)
- [Boas Práticas](../docs/best-practices.md)

---

**Categoria:** Exemplo  
**Status:** ✅ Ativo  
**Última Atualização:** 2025-12-14
