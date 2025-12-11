# 🗄️ Comandos Prisma - Guia Rápido

## 📋 Comandos Essenciais

### 🎨 Prisma Studio (Interface Visual)
```bash
# Da pasta backend
cd backend
npx prisma studio

# Da raiz do projeto
npx prisma studio --schema=backend/prisma/schema.prisma
```

### 🔄 Migrações
```bash
# Gerar migração
cd backend
npx prisma migrate dev --name nome_da_migracao

# Aplicar migrações em produção
npx prisma migrate deploy

# Reset do banco (CUIDADO!)
npx prisma migrate reset
```

### 🔧 Cliente Prisma
```bash
# Gerar cliente após mudanças no schema
cd backend
npx prisma generate

# Verificar schema
npx prisma validate
```

### 📊 Banco de Dados
```bash
# Sincronizar schema com banco (desenvolvimento)
cd backend
npx prisma db push

# Fazer seed do banco
npx prisma db seed
```

## 🎯 Comandos Específicos do Projeto

### Sistema de Updates
```bash
# Aplicar migração do sistema de updates
cd backend
npx prisma migrate deploy

# Gerar cliente com novas tabelas
npx prisma generate

# Abrir Prisma Studio para ver as tabelas
npx prisma studio
```

### Verificar Configuração
```bash
# Verificar conexão com banco
cd backend
npx prisma db pull

# Verificar status das migrações
npx prisma migrate status
```

## 🔍 Troubleshooting

### Erro: "No database URL found"
```bash
# Solução 1: Ir para pasta backend
cd backend
npx prisma studio

# Solução 2: Especificar schema
npx prisma studio --schema=backend/prisma/schema.prisma

# Solução 3: Definir URL manualmente
DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/multitenant_db" npx prisma studio
```

### Erro: "Database does not exist"
```bash
# Criar banco de dados
createdb multitenant_db

# Ou via SQL
psql -U postgres -c "CREATE DATABASE multitenant_db;"
```

### Erro: "Migration failed"
```bash
# Verificar status
cd backend
npx prisma migrate status

# Resolver conflitos
npx prisma migrate resolve --applied "nome_da_migracao"

# Reset se necessário (CUIDADO!)
npx prisma migrate reset
```

## 📁 Estrutura do Projeto

```
projeto/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Schema principal
│   │   └── migrations/            # Migrações
│   ├── .env                       # Variáveis de ambiente
│   └── package.json
└── frontend/
    └── package.json
```

## 🎯 Comandos por Contexto

### Desenvolvimento
```bash
cd backend
npx prisma studio              # Interface visual
npx prisma migrate dev         # Nova migração
npx prisma generate           # Gerar cliente
```

### Produção
```bash
cd backend
npx prisma migrate deploy     # Aplicar migrações
npx prisma generate          # Gerar cliente
```

### Debug
```bash
cd backend
npx prisma validate          # Verificar schema
npx prisma migrate status    # Status das migrações
npx prisma db pull          # Sincronizar com banco
```

## 🔧 Configuração Atual

### Banco de Dados:
- **Host**: localhost:5432
- **Database**: multitenant_db
- **User**: postgres
- **Schema**: public

### Tabelas Principais:
- `tenants` - Empresas/organizações
- `users` - Usuários do sistema
- `audit_logs` - Logs de auditoria
- `security_config` - Configurações de segurança
- `system_settings` - Configurações do sistema de updates
- `update_logs` - Histórico de atualizações

## 🚀 Acesso Rápido

### Abrir Prisma Studio:
```bash
cd backend && npx prisma studio
```

### Ver todas as tabelas:
1. Execute o comando acima
2. Acesse: http://localhost:5555
3. Navegue pelas tabelas no painel lateral

### Verificar Sistema de Updates:
1. Abra Prisma Studio
2. Vá para tabela `system_settings`
3. Vá para tabela `update_logs`
4. Verifique os dados inseridos

## ✅ Checklist Rápido

- [ ] PostgreSQL rodando
- [ ] Banco `multitenant_db` criado
- [ ] Arquivo `.env` configurado
- [ ] Migrações aplicadas (`npx prisma migrate deploy`)
- [ ] Cliente gerado (`npx prisma generate`)
- [ ] Prisma Studio funcionando (`npx prisma studio`)

## 🎉 Resultado

Após seguir os comandos, você terá:
- ✅ Prisma Studio funcionando
- ✅ Acesso visual ao banco de dados
- ✅ Tabelas do sistema de updates visíveis
- ✅ Dados de configuração acessíveis