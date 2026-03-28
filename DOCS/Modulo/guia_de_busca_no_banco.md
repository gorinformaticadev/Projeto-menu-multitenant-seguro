# Guia de Busca no Banco de Dados

Padrao de referencia para implementar busca em modulos do sistema. Baseado no padrao do modulo `ordem_servico` (clientes e produtos).

## Visao Geral

- **Frontend**: Busca com debounce automatico
- **Controller**: Endpoint com parametro `search`
- **Service**: Query SQL com LIMIT e validacao de caracteres
- **Banco**: SQL com placeholders corretos

## Regra de Seguranca

Preferir `$queryRaw` com `Prisma.sql` tagged templates sobre `$queryRawUnsafe`:

```typescript
// Mais seguro (type-safe)
const results = await this.prisma.$queryRaw(
  Prisma.sql`SELECT * FROM tabela WHERE tenant_id = ${tenantId} AND name LIKE ${pattern}`
);

// Alternativa (funcional mas menos segura)
const results = await this.prisma.$queryRawUnsafe<any[]>(
  `SELECT * FROM tabela WHERE tenant_id = $1 AND name LIKE $2`,
  tenantId, `%${search}%`
);
```

## Implementacao Backend

### Controller

```typescript
@Controller('api/ordem_servico/clientes')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ClientesController {
  constructor(private readonly service: ClientesService) {}

  @Get()
  @RequireClientsPermission('view')
  async findAll(
    @Query('search') search: string,
    @Req() req: ExpressRequest & { user: any }
  ) {
    const tenantId = req.user?.tenantId;
    return this.service.findAll(tenantId, search);
  }
}
```

### Service

```typescript
@Injectable()
export class ClientesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, search?: string) {
    const safeSearch = typeof search === 'string' ? search.trim() : '';

    // Busca curta retorna vazio
    if (safeSearch.length > 0 && safeSearch.length < 2) {
      return [];
    }

    if (safeSearch.length >= 2) {
      return this.prisma.$queryRawUnsafe<any[]>(
        `SELECT id, name, phone_primary, image_url
         FROM mod_ordem_servico_clients
         WHERE tenant_id = $1
           AND deleted_at IS NULL
           AND (LOWER(name) LIKE LOWER($2) OR phone_primary LIKE $2)
         ORDER BY name ASC
         LIMIT 20`,
        tenantId, `%${safeSearch}%`
      );
    }

    // Listagem padrao (sem busca)
    return this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, name, phone_primary, image_url
       FROM mod_ordem_servico_clients
       WHERE tenant_id = $1 AND deleted_at IS NULL
       ORDER BY name ASC
       LIMIT 50`,
      tenantId
    );
  }
}
```

## Implementacao Frontend

### Estados

```typescript
const [searchTerm, setSearchTerm] = useState('');
const [clients, setClients] = useState<Cliente[]>([]);
const [searchingClients, setSearchingClients] = useState(false);
```

### Busca com Debounce (300ms)

```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    fetchClients();
  }, 300);
  return () => clearTimeout(timer);
}, [searchTerm]);

const fetchClients = async () => {
  const safeSearch = typeof searchTerm === 'string' ? searchTerm.trim() : '';

  if (safeSearch.length > 0 && safeSearch.length < 2) {
    setClients([]);
    return;
  }

  if (safeSearch.length >= 2) {
    setSearchingClients(true);
    try {
      const response = await api.get(`/api/ordem_servico/clientes?search=${safeSearch}`);
      setClients(response.data);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
      setClients([]);
    } finally {
      setSearchingClients(false);
    }
  } else {
    setClients([]);
  }
};
```

### Interface de Busca

```tsx
<div className="relative">
  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
  <Input
    placeholder="Digite 2+ letras para buscar..."
    className="pl-9"
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
  />
  {searchingClients && (
    <div className="absolute right-2.5 top-2.5">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  )}
</div>
```

## Comportamento

### Frontend
- 1 letra: array vazio (sem busca)
- 2+ letras: busca automatica com debounce 300ms
- Campo vazio: array vazio
- Loading indicator durante busca

### Backend
- Busca < 2 caracteres: retorna `[]`
- Busca >= 2 caracteres: query com LIMIT 20
- Sem busca: lista padrao com LIMIT 50
- Case-insensitive com `LOWER()`
- Multiplos campos com OR

## Tabelas de Exemplo

As tabelas abaixo sao criadas pelo modulo `ordem_servico` via migrations:

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

## Diferencas por Dominio

| Dominio | Campos de Busca | Campos Retornados | Limite |
|---------|----------------|-------------------|--------|
| Produtos | `name`, `code` | `id`, `name`, `price`, `is_service`, `image_url` | 20 |
| Clientes | `name`, `phone_primary` | `id`, `name`, `phone_primary`, `image_url` | 20 |

## Regra de Ouro

Todo modulo que tiver campo de busca deve copiar este padrao para evitar:
- Erro 500 (placeholders incorretos)
- Busca pesada (sem LIMIT)
- Codigo inconsistente
- UX ruim (sem debounce)
