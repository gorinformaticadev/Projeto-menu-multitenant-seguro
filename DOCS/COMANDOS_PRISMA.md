# Comandos Prisma - Guia Rapido

## Comandos Essenciais

### Prisma Studio (Interface Visual)
```bash
# Da raiz do projeto
pnpm --filter backend exec prisma studio
# Abre em http://localhost:5555
```

### Migracoes
```bash
# Gerar migration
pnpm --filter backend exec prisma migrate dev --name nome_da_migracao

# Aplicar migrations em producao
pnpm --filter backend exec prisma migrate deploy

# Ver status das migrations
pnpm --filter backend exec prisma migrate status

# Reset do banco (CUIDADO!)
pnpm --filter backend exec prisma migrate reset
```

### Cliente Prisma
```bash
# Gerar cliente apos mudancas no schema
pnpm --filter backend exec prisma generate

# Verificar schema
pnpm --filter backend exec prisma validate
```

### Banco de Dados
```bash
# Sincronizar schema com banco (desenvolvimento)
pnpm --filter backend exec prisma db push

# Fazer seed do banco
pnpm --filter backend exec prisma db seed

# Pull schema do banco
pnpm --filter backend exec prisma db pull
```

## Troubleshooting

### Erro: "No database URL found"
```bash
# Solucao: Especificar schema
pnpm --filter backend exec prisma studio --schema=apps/backend/prisma/schema.prisma
```

### Erro: "Migration failed"
```bash
# Verificar status
pnpm --filter backend exec prisma migrate status

# Resolver conflitos
pnpm --filter backend exec prisma migrate resolve --applied "nome_da_migracao"
```

## Contextos

### Desenvolvimento
```bash
pnpm --filter backend exec prisma studio          # Interface visual
pnpm --filter backend exec prisma migrate dev      # Nova migration
pnpm --filter backend exec prisma generate         # Gerar cliente
```

### Producao
```bash
pnpm --filter backend exec prisma migrate deploy   # Aplicar migrations
pnpm --filter backend exec prisma generate         # Gerar cliente
```

### Debug
```bash
pnpm --filter backend exec prisma validate         # Verificar schema
pnpm --filter backend exec prisma migrate status   # Status das migrations
pnpm --filter backend exec prisma db pull          # Sincronizar com banco
```

## Checklist Rapido

- PostgreSQL rodando
- Banco de dados criado
- Arquivo `.env` configurado
- Migrações aplicadas (`pnpm --filter backend exec prisma migrate deploy`)
- Cliente gerado (`pnpm --filter backend exec prisma generate`)
- Prisma Studio funcionando (`pnpm --filter backend exec prisma studio`)
