# Módulo de Exemplo

Este é um módulo de exemplo para demonstrar como criar e instalar módulos no sistema multitenant.

## Estrutura do Módulo

- `module.json` - Configuração principal do módulo
- `migrations/` - Scripts SQL para criação de tabelas
- `package.json` - Dependências NPM (opcional)
- `README.md` - Documentação do módulo

## Funcionalidades

- Criação de tabela `example_items`
- Isolamento por tenant
- Configurações personalizáveis
- Migrações automáticas

## Instalação

1. Compacte todos os arquivos em um ZIP
2. Faça upload através da interface de administração
3. O sistema executará automaticamente as migrações
4. Ative o módulo para os tenants desejados

## Configurações

O módulo suporta as seguintes configurações:

```json
{
  "enableNotifications": true,
  "maxItems": 100
}
```

## Permissões

- `view_example` - Visualizar itens de exemplo
- `manage_example` - Gerenciar itens de exemplo