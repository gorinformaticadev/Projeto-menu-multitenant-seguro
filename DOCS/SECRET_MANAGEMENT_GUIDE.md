# Guia de Secret Management

## 📋 Visão Geral

Este projeto implementa um sistema flexível de gerenciamento de secrets que suporta múltiplos provedores, permitindo uma transição gradual de ambientes locais para cloud.

## 🏗️ Arquitetura

### Componentes Principais

1. **SecretManagerService** - Serviço principal do NestJS
2. **SecretManagerFactory** - Factory para selecionar provedor apropriado
3. **Providers** - Implementações para diferentes plataformas:
   - LocalSecretManager (desenvolvimento)
   - AWSSecretManager (produção AWS)
   - AzureKeyVaultManager (futuro)
   - HashiCorpVaultManager (futuro)

## 🚀 Configuração

### Ambiente Local (Desenvolvimento)

Para desenvolvimento, o sistema usa variáveis de ambiente locais:

```bash
# .env
JWT_SECRET=sua-chave-jwt-segura
ENCRYPTION_KEY=sua-chave-de-criptografia
DATABASE_URL=postgresql://...
```

### Ambiente AWS (Produção)

Configure as credenciais da AWS:

```bash
# Variáveis de ambiente
AWS_ACCESS_KEY_ID=seu-access-key
AWS_SECRET_ACCESS_KEY=sua-secret-key
AWS_REGION=us-east-1
SECRET_PROVIDER=aws
```

Ou use IAM Roles se estiver em EC2/ECS.

### Outros Provedores (Futuros)

```bash
# Azure Key Vault
SECRET_PROVIDER=azure
AZURE_CLIENT_ID=seu-client-id
AZURE_CLIENT_SECRET=sua-client-secret
AZURE_TENANT_ID=seu-tenant-id

# HashiCorp Vault
SECRET_PROVIDER=vault
VAULT_ADDR=https://seu-vault-endpoint
VAULT_TOKEN=seu-token
```

## 💻 Uso no Código

### Injeção de Dependência

```typescript
import { SecretManagerService } from './common/services/secret-manager.nest.service';

@Controller()
export class MyController {
  constructor(private secretManager: SecretManagerService) {}

  async getDatabasePassword() {
    const secret = await this.secretManager.getSecret('DATABASE_PASSWORD');
    return secret?.value;
  }
}
```

### Carregamento Automático

O sistema carrega automaticamente secrets críticos na inicialização:

```typescript
// Secrets carregados automaticamente:
// - JWT_SECRET
// - ENCRYPTION_KEY
// - DATABASE_URL
// - SMTP_PASSWORD
// - SENTRY_DSN
```

## 🛠️ Comandos CLI

### Scripts Disponíveis

```bash
# Verificar secrets atuais
npm run secrets:list

# Definir secret de desenvolvimento
npm run secrets:set JWT_SECRET "nova-chave-segura"

# Deletar secret
npm run secrets:delete JWT_SECRET

# Backup de secrets (apenas local)
npm run secrets:backup
```

### PowerShell Scripts

```powershell
# Listar todos os secrets
.\scripts\list-secrets.ps1

# Configurar secrets para desenvolvimento
.\scripts\setup-dev-secrets.ps1

# Validar configuração de secrets
.\scripts\validate-secrets.ps1
```

## 🔧 Desenvolvimento

### Adicionando Novos Secrets

1. **No código:**
```typescript
// Adicione ao array de secrets críticos em SecretManagerService
const secretsToLoad = [
  'JWT_SECRET',
  'ENCRYPTION_KEY',
  'NOVO_SECRET_IMPORTANTE' // ← Adicione aqui
];
```

2. **Na factory:**
```typescript
// Em SecretManagerFactory.createSecretManager()
// Adicione lógica para o novo provedor se necessário
```

### Testando Providers

```bash
# Testar secret manager local
npm run test:secrets-local

# Testar AWS Secrets Manager (requer credenciais)
npm run test:secrets-aws
```

## 📊 Monitoramento

### Logs de Segurança

O sistema gera logs para operações críticas:

```
[INFO]  Secret Manager inicializado (AWS Secrets Manager)
[INFO]  Secret carregado: JWT_SECRET
[WARN]  Secret não encontrado: SMTP_PASSWORD
[ERROR] Erro ao carregar secret DATABASE_URL: AccessDenied
```

### Métricas

- Tempo de inicialização do secret manager
- Taxa de sucesso/falha no carregamento de secrets
- Tempo de resposta por operação

## 🔒 Boas Práticas

### 1. Segredos Críticos
- Sempre valide a presença de secrets críticos na inicialização
- Use valores padrão seguros para ambientes de desenvolvimento
- Nunca commite secrets reais no repositório

### 2. Rotacionamento
- Implemente políticas de rotação automática
- Monitore expiração de secrets
- Tenha plano de contingência para falhas

### 3. Acesso
- Limite acesso ao mínimo necessário
- Use IAM Roles quando possível
- Audite acessos regularmente

## 🆘 Troubleshooting

### Problemas Comuns

**Secret não encontrado:**
```bash
# Verifique se o secret existe no provedor
npm run secrets:list

# Verifique permissões do IAM/User
aws secretsmanager list-secrets
```

**Falha na inicialização:**
```bash
# Verifique credenciais AWS
aws sts get-caller-identity

# Verifique conectividade
ping secretsmanager.us-east-1.amazonaws.com
```

**Erros de permissão:**
```
# IAM Policy mínima necessária:
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:ListSecrets"
      ],
      "Resource": "*"
    }
  ]
}
```

## 📈 Roadmap

### Versão 1.0 (Atual)
- ✅ Secret Manager Local
- ✅ AWS Secrets Manager
- ✅ Carregamento automático
- ✅ Validação de secrets

### Versão 1.1 (Planejada)
- 🔄 Azure Key Vault support
- 🔄 HashiCorp Vault support
- 🔄 Google Secret Manager support
- 🔄 Auto-rotacionamento de secrets

### Versão 1.2 (Futuro)
- 🔜 UI de administração de secrets
- 🔜 Integração com CI/CD
- 🔜 Monitoramento avançado
- 🔜 Backup/Restore automatizado

---

*Última atualização: Janeiro 2024*