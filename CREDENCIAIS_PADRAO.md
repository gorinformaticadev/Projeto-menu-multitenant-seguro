# 🔑 Credenciais Padrão do Sistema

## 📋 Credenciais de Desenvolvimento

Todas as contas criadas pelo seed usam a mesma senha padrão para facilitar o desenvolvimento e testes.

### 🔐 Senha Padrão
```
eRR&KnFyuo&UI6d*
```

Esta senha atende a todos os requisitos de segurança do sistema:
- ✅ Contém letras minúsculas
- ✅ Contém letras maiúsculas  
- ✅ Contém números
- ✅ Contém caracteres especiais
- ✅ Tem mais de 8 caracteres

## 👥 Contas Disponíveis

### 🔴 SUPER_ADMIN
- **Email**: `admin@system.com`
- **Senha**: `eRR&KnFyuo&UI6d*`
- **Permissões**: 
  - Acesso total ao sistema
  - Gerenciamento de tenants/empresas
  - Configurações globais de segurança
  - Criação de usuários em qualquer tenant

### 🟡 ADMIN (Tenant)
- **Email**: `admin@empresa1.com`
- **Senha**: `eRR&KnFyuo&UI6d*`
- **Permissões**:
  - Acesso apenas aos dados do seu tenant
  - Gerenciamento de usuários do seu tenant
  - Configurações do tenant

### 🟢 USER (Usuário Comum)
- **Email**: `user@empresa1.com`
- **Senha**: `eRR&KnFyuo&UI6d*`
- **Permissões**:
  - Acesso apenas aos dados do seu tenant
  - Funcionalidades básicas do sistema

## 🚀 Como Usar

### 1. Acesse o Sistema
```
http://localhost:5000
```

### 2. Faça Login
Use qualquer uma das credenciais acima para testar diferentes níveis de acesso.

### 3. Teste as Funcionalidades
- **SUPER_ADMIN**: Acesse `/empresas` para gerenciar tenants
- **ADMIN/USER**: Acesse `/dashboard` para ver dados do tenant

## ⚠️ Importante para Produção

**NUNCA use essas credenciais em produção!**

Em produção:
1. Altere todas as senhas padrão
2. Use senhas únicas e seguras
3. Configure variáveis de ambiente:
   ```bash
   ADMIN_DEFAULT_PASSWORD=sua_senha_super_segura
   USER_DEFAULT_PASSWORD=outra_senha_super_segura
   ```

## 🔄 Resetar Credenciais

Para resetar o banco e recriar as credenciais padrão:

```bash
# Com Docker
docker-compose -f docker-compose.dev.yml exec backend npx prisma migrate reset --force

# Sem Docker
cd backend
npx prisma migrate reset --force
```

O comando acima irá:
1. Resetar o banco de dados
2. Aplicar todas as migrations
3. Executar o seed com as credenciais padrão

## 📝 Personalização

Para usar senhas diferentes no desenvolvimento, edite o arquivo `backend/prisma/seed.ts`:

```typescript
// Altere esta linha:
const defaultPassword = 'eRR&KnFyuo&UI6d*';

// Para:
const defaultPassword = 'sua_nova_senha_padrao';
```

Depois execute:
```bash
npx prisma migrate reset --force
```

---

**GOR Informática** - Facilitando o desenvolvimento com credenciais padronizadas