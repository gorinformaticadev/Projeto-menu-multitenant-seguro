# Implementação de Configuração de Email Pré-configurada

## Visão Geral

Esta implementação adiciona a funcionalidade de configuração de email pré-configurada para usuários super_admin na tela de configurações do sistema. Os usuários podem selecionar de uma lista de provedores de email populares (Gmail, Hotmail/Outlook, Titan) e as configurações SMTP são automaticamente preenchidas.

## Componentes Implementados

### Backend

1. **Modelo de Dados (Prisma)**
   - Adicionado modelo `EmailConfiguration` no schema.prisma
   - Criada migration para tabela `email_configurations`

2. **Serviços**
   - `EmailConfigService`: Gerencia as configurações de email
   - Métodos principais:
     - `getPredefinedProviders()`: Retorna provedores pré-configurados
     - `getActiveConfig()`: Retorna configuração ativa
     - `createConfig()`: Cria nova configuração
     - `updateConfig()`: Atualiza configuração existente
     - `activateConfig()`: Ativa uma configuração
     - `deleteConfig()`: Remove configuração

3. **Controladores**
   - `EmailConfigController`: Endpoints da API
   - Rotas disponíveis:
     - `GET /email-config/providers`: Lista provedores pré-configurados
     - `GET /email-config`: Lista todas as configurações
     - `GET /email-config/active`: Retorna configuração ativa
     - `POST /email-config`: Cria nova configuração
     - `PUT /email-config/:id`: Atualiza configuração
     - `PUT /email-config/:id/activate`: Ativa configuração
     - `DELETE /email-config/:id`: Remove configuração

4. **Atualização do EmailService**
   - Modificado para usar configurações do banco de dados quando disponíveis
   - Mantém compatibilidade com configurações do .env como fallback

### Frontend

1. **Componente EmailConfigSection**
   - Interface para seleção de provedor de email
   - Formulário para configuração SMTP
   - Integração com API para salvar/recuperar configurações

2. **Atualização da página de Configurações de Segurança**
   - Adicionado componente EmailConfigSection à página existente
   - Mantida estrutura e estilo consistentes

## Provedores Pré-configurados

| Provedor | Servidor SMTP | Porta | Criptografia | Autenticação |
|----------|---------------|-------|--------------|--------------|
| Gmail | smtp.gmail.com | 587 | STARTTLS | OAuth 2.0 |
| Hotmail/Outlook | smtp-mail.outlook.com | 587 | STARTTLS | OAuth 2.0 |
| Titan | mail.titan.email | 587 | STARTTLS | PLAIN |

## Segurança

- Apenas usuários com role `SUPER_ADMIN` podem acessar as configurações
- Credenciais de email não são armazenadas no banco de dados
- Configurações são validadas antes de serem salvas
- Sistema mantém apenas uma configuração ativa por vez

## Integração com EmailService

O serviço de email foi atualizado para:

1. Verificar primeiro por configurações ativas no banco de dados
2. Usar configurações do .env como fallback quando não há configuração ativa
3. Manter compatibilidade com a implementação existente

## Como Testar

1. Acesse a aplicação como usuário SUPER_ADMIN
2. Navegue até Configurações > Segurança
3. Na seção de Configurações de Email:
   - Selecione um provedor da lista
   - Verifique se os campos foram preenchidos automaticamente
   - Preencha usuário e senha SMTP
   - Clique em "Salvar Configuração"
4. Verifique se a configuração ativa é exibida na interface

## Próximos Passos (Melhorias Futuras)

1. Adicionar validação de conexão SMTP após salvar configuração
2. Permitir adicionar provedores personalizados
3. Adicionar logs de auditoria para mudanças de configuração
4. Implementar criptografia para credenciais armazenadas (usuário/senha)

## Arquivos Modificados

### Backend
- `backend/prisma/schema.prisma`
- `backend/src/security-config/email-config.service.ts`
- `backend/src/security-config/email-config.controller.ts`
- `backend/src/security-config/security-config.module.ts`
- `backend/src/email/email.service.ts`
- `backend/src/email/email.module.ts`

### Frontend
- `frontend/src/components/EmailConfigSection.tsx`
- `frontend/src/app/configuracoes/seguranca/page.tsx`

### Banco de Dados
- `backend/prisma/migrations/20251211113947_add_email_configuration_model/migration.sql`