# Funcionalidade de Recuperação de Senha

## Descrição
Sistema completo de recuperação de senha via email, permitindo que usuários redefinam suas senhas de forma segura através de tokens temporários enviados por email.

## Fluxo de Funcionamento

### 1. Solicitação de Recuperação
- Usuário acessa a página "Esqueci minha senha" através do link na tela de login
- Informa seu email cadastrado
- Sistema verifica se o email existe (mas sempre retorna sucesso por segurança)
- Gera token JWT temporário válido por 1 hora
- Salva o token no banco de dados
- Envia email com link de recuperação

### 2. Redefinição de Senha
- Usuário clica no link recebido por email
- É redirecionado para página de redefinição com token na URL
- Informa nova senha seguindo critérios de segurança
- Sistema valida token e atualiza senha
- Invalida todos os tokens de reset do usuário
- Usuário é redirecionado para login

## Arquivos Criados/Modificados

### Backend

#### Novos Arquivos:
- `backend/src/auth/dto/forgot-password.dto.ts` - DTO para solicitação de recuperação
- `backend/src/auth/dto/reset-password.dto.ts` - DTO para redefinição de senha
- `backend/src/auth/password-reset.service.ts` - Service com lógica de recuperação

#### Modificados:
- `backend/prisma/schema.prisma` - Adicionada tabela `PasswordResetToken`
- `backend/src/auth/auth.controller.ts` - Adicionados endpoints de recuperação
- `backend/src/auth/auth.module.ts` - Registrado novo service

#### Novos Endpoints:
- `POST /auth/forgot-password` - Solicitar recuperação de senha
- `POST /auth/reset-password` - Redefinir senha com token

### Frontend

#### Novos Arquivos:
- `frontend/src/app/esqueci-senha/page.tsx` - Página de solicitação de recuperação
- `frontend/src/app/redefinir-senha/page.tsx` - Página de redefinição de senha

#### Modificados:
- `frontend/src/app/login/page.tsx` - Adicionado link "Esqueci minha senha"
- `frontend/src/components/AppLayout.tsx` - Adicionadas rotas públicas

## Banco de Dados

### Nova Tabela: `password_reset_tokens`
```sql
CREATE TABLE "password_reset_tokens" (
  "id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);
```

## Recursos de Segurança

### 1. Validação de Token
- Tokens JWT com expiração de 1 hora
- Verificação dupla: JWT + banco de dados
- Tokens invalidados após uso
- Limpeza automática de tokens expirados

### 2. Proteção contra Ataques
- Rate limiting: 3 tentativas por hora para solicitação
- Rate limiting: 5 tentativas por hora para redefinição
- Resposta padronizada mesmo para emails inexistentes
- Invalidação de todos os tokens ao redefinir senha

### 3. Validação de Senha
- Mínimo 8 caracteres
- Pelo menos 1 letra maiúscula
- Pelo menos 1 letra minúscula
- Pelo menos 1 número
- Pelo menos 1 caractere especial (@$!%*?&)

## Interface do Usuário

### Página "Esqueci minha senha"
- Campo de email com validação
- Feedback visual de envio
- Instruções claras para o usuário
- Link para voltar ao login

### Página "Redefinir senha"
- Validação em tempo real da senha
- Indicadores visuais de critérios atendidos
- Confirmação de senha
- Mostrar/ocultar senha
- Feedback de sucesso

### Email de Recuperação
- Template HTML responsivo
- Link direto para redefinição
- Avisos de segurança
- Informações sobre expiração

## Configuração Necessária

### Variáveis de Ambiente
O sistema utiliza as configurações de email já existentes:
- `SMTP_HOST` - Servidor SMTP
- `SMTP_PORT` - Porta SMTP
- `SMTP_USER` - Usuário SMTP
- `SMTP_PASS` - Senha SMTP
- `FRONTEND_URL` - URL do frontend para links

### Banco de Dados
Execute a migração para criar a tabela:
```bash
npx prisma migrate dev --name add-password-reset-tokens
```

## Uso

### Para Usuários
1. Na tela de login, clique em "Esqueci minha senha"
2. Digite seu email e clique em "Enviar instruções"
3. Verifique seu email (incluindo spam)
4. Clique no link recebido
5. Digite sua nova senha
6. Faça login com a nova senha

### Para Administradores
- Monitore logs de recuperação de senha
- Configure adequadamente o sistema de email
- Considere implementar limpeza automática de tokens antigos

## Considerações de Segurança

### Recomendações
- Mantenha o sistema de email seguro
- Monitore tentativas excessivas de recuperação
- Considere implementar CAPTCHA em ambientes de alto risco
- Eduque usuários sobre phishing

### Limitações
- Depende do sistema de email estar funcionando
- Tokens são válidos por 1 hora (configurável)
- Usuários bloqueados não podem recuperar senha

## Manutenção

### Limpeza de Tokens
O service inclui método `cleanupExpiredTokens()` que pode ser executado periodicamente via cron job para remover tokens expirados e usados.

### Monitoramento
- Logs detalhados de todas as operações
- Auditoria de tentativas de recuperação
- Alertas para falhas no envio de email