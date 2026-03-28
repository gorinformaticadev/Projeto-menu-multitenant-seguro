# Guia de Busca no Banco de Dados

Padrao de referencia para modulos que precisam de busca. O sistema core usa dois modelos: **Raw SQL para queries complexas** e **Prisma ORM para queries simples**.

## Padrao Real do Core

### Queries com Prisma.sql (Preferido)

O core usa `$queryRaw` com `Prisma.sql` tagged templates para queries complexas com JOINs, LIKE e filtros dinamicos. Exemplos reais:

```typescript
// core/cron/materialized-cron-execution.service.ts
const results = await this.prisma.$queryRaw<CronExecutionRow[]>(
  Prisma.sql`SELECT id, job_name, status, started_at
    FROM cron_materialized_executions
    WHERE tenant_id = ${tenantId}
      AND status = ${status}
    ORDER BY started_at DESC
    LIMIT 50`
);

// core/cron/execution-lease.service.ts
const leases = await this.prisma.$queryRaw<ExecutionLeaseRow[]>(
  Prisma.sql`SELECT * FROM execution_leases
    WHERE tenant_id = ${tenantId}
      AND expires_at < NOW()
    FOR UPDATE SKIP LOCKED`
);
```

### Queries com $queryRawUnsafe (Alternativa)

Usado em casos mais simples. Funcional mas menos seguro:

```typescript
// update/update.service.ts
const settings = await this.prisma.$queryRawUnsafe<any[]>(
  `SELECT * FROM "update_system_settings" LIMIT 1`
);

// backup/backup.service.ts
await this.prisma.$queryRawUnsafe('SELECT 1 FROM "_prisma_migrations" LIMIT 1');
```

### Regra de Seguranca

Preferir `Prisma.sql` quando ha parametros do usuario:
```typescript
// ✅ Preferido (type-safe, prepared statement)
await this.prisma.$queryRaw(
  Prisma.sql`SELECT * FROM tabela WHERE name LIKE ${pattern} LIMIT ${limit}`
);

// ⚠️ Funcional mas menos seguro
await this.prisma.$queryRawUnsafe(
  `SELECT * FROM tabela WHERE name LIKE $1 LIMIT $2`, pattern, limit
);
```

---

## Padrao para Modulos (Referencia)

Baseado no modulo `ordem_servico` (clientes/produtos). Este padrao serve como referencia para modulos que precisam de busca com LIKE.

### Backend — Controller

```typescript
@Controller('api/ordem_servico/clientes')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ClientesController {
  @Get()
  @RequireClientsPermission('view')
  async findAll(
    @Query('search') search: string,
    @Req() req: ExpressRequest & { user: any }
  ) {
    return this.service.findAll(req.user?.tenantId, search);
  }
}
```

### Backend — Service

```typescript
@Injectable()
export class ClientesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, search?: string) {
    const safeSearch = typeof search === 'string' ? search.trim() : '';

    if (safeSearch.length > 0 && safeSearch.length < 2) return [];

    if (safeSearch.length >= 2) {
      return this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name, phone_primary, image_url
         FROM mod_ordem_servico_clients
         WHERE tenant_id = $1
           AND deleted_at IS NULL
           AND (LOWER(name) LIKE LOWER($2) OR phone_primary LIKE $2)
         ORDER BY name ASC LIMIT 20`,
        tenantId, `%${safeSearch}%`
      );
    }

    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, name, phone_primary, image_url
       FROM mod_ordem_servico_clients
       WHERE tenant_id = $1 AND deleted_at IS NULL
       ORDER BY name ASC LIMIT 50`,
      tenantId
    );
  }
}
```

### Frontend — Busca com Debounce

```typescript
const [searchTerm, setSearchTerm] = useState('');
const [results, setResults] = useState<Cliente[]>([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  const timer = setTimeout(() => fetchResults(), 300);
  return () => clearTimeout(timer);
}, [searchTerm]);

const fetchResults = async () => {
  const safeSearch = searchTerm.trim();
  if (safeSearch.length > 0 && safeSearch.length < 2) {
    setResults([]);
    return;
  }
  if (safeSearch.length >= 2) {
    setLoading(true);
    try {
      const { data } = await api.get(`/api/ordem_servico/clientes?search=${safeSearch}`);
      setResults(data);
    } catch { setResults([]); }
    finally { setLoading(false); }
  } else {
    setResults([]);
  }
};
```

### Frontend — Interface

```tsx
<div className="relative">
  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
  <Input
    placeholder="Digite 2+ letras para buscar..."
    className="pl-9"
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
  />
  {loading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin" />}
</div>
```

---

## Comportamento

| Cenario | Frontend | Backend |
|---------|----------|---------|
| 1 letra | Array vazio | Array vazio |
| 2+ letras | Busca com debounce 300ms | Query com LIMIT 20 |
| Campo vazio | Array vazio | Lista padrao LIMIT 50 |
| Loading | Spinner visivel | — |

---

## Busca no Core (Client-Side)

O core do sistema usa busca client-side em varios componentes. Nao ha busca server-side generica no core.

| Componente | Campo | Filtra por |
|-----------|-------|-----------|
| `GlobalSearch.tsx` | `query` | Sidebar items por label (min 2 chars) |
| `NotificationCenter.tsx` | `searchTerm` | title + description (sem debounce) |
| `notifications/page.tsx` | `searchTerm` | title + body + action (sem debounce) |
| `logs/page.tsx` | `draftFilters` | action + date range (botao buscar) |

---

## Tabelas de Modulos

Tabelas de modulos sao criadas via migrations SQL do modulo. Exemplo:

```sql
CREATE TABLE mod_ordem_servico_clients (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    phone_primary VARCHAR NOT NULL,
    image_url VARCHAR,
    deleted_at TIMESTAMP NULL
);

CREATE TABLE mod_ordem_servico_products (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    code VARCHAR NOT NULL,
    price DECIMAL(10,2),
    image_url VARCHAR,
    deleted_at TIMESTAMP NULL
);
```

---

## Regra de Ouro

Todo modulo com busca deve:
- Validar minimo 2 caracteres antes de buscar
- Usar LIMIT em todas as queries
- Ter debounce 300ms no frontend
- Preferir `Prisma.sql` sobre `$queryRawUnsafe`
- Filtrar sempre por `tenant_id`
- Incluir `deleted_at IS NULL` se usar soft delete
