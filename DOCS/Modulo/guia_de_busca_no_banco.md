# Guia Completo de Implementação de Busca no Banco de Dados

Este documento mostra como implementar uma busca funcional no sistema, baseado na implementação atual que está funcionando nas páginas de clientes e produtos.

## 📋 Visão Geral

A busca funciona com os seguintes componentes:
- **Frontend**: Interface de busca com debounce automático
- **Controller**: Endpoint simplificado que recebe apenas o parâmetro search
- **Service**: Lógica de consulta SQL otimizada com validação de caracteres
- **Banco**: Query SQL com placeholders corretos e limites de performance

## 🎯 PADRÃO OFICIAL DE BUSCA (Baseado em Clientes/Produtos)

### 1. Princípio Fundamental

**Clientes deve se comportar exatamente como Produtos, só muda:**
- ✔️ Tabela
- ✔️ Campos retornados  
- ✔️ Permissões
- ✔️ Mesma rota base
- ✔️ Mesmo padrão de search
- ✔️ Mesmo comportamento no frontend

## 🔧 Implementação Backend (NestJS)

### 1. Controller - Padrão Simplificado

```typescript
@Controller('api/ordem_servico/clientes')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ClientesController {
    constructor(private readonly clientesService: ClientesService) {}

    @Get()
    @RequireClientsPermission('view')
    async findAll(
        @Query('search') search: string,
        @Req() req: ExpressRequest & { user: any }
    ) {
        const tenantId = req.user?.tenantId;
        return this.clientesService.findAll(tenantId, search);
    }
}
```

### 2. Service - Padrão Definitivo

```typescript
@Injectable()
export class ClientesService {
    constructor(private prisma: PrismaService) {}

    async findAll(tenantId: string, search?: string) {
        const safeSearch = typeof search === 'string' ? search.trim() : '';
        
        // 🔒 Evita busca curta
        if (safeSearch.length > 0 && safeSearch.length < 2) {
            return [];
        }

        if (safeSearch.length >= 2) {
            return this.prisma.$queryRawUnsafe<any[]>(
                `
                SELECT
                    id,
                    name,
                    phone_primary,
                    image_url
                FROM mod_ordem_servico_clients
                WHERE tenant_id = $1
                    AND deleted_at IS NULL
                    AND (
                        LOWER(name) LIKE LOWER($2)
                        OR phone_primary LIKE $2
                    )
                ORDER BY name ASC
                LIMIT 20
                `,
                tenantId,
                `%${safeSearch}%`
            );
        }

        // 📋 Listagem padrão (sem busca)
        return this.prisma.$queryRawUnsafe<any[]>(
            `
            SELECT
                id,
                name,
                phone_primary,
                image_url
            FROM mod_ordem_servico_clients
            WHERE tenant_id = $1
                AND deleted_at IS NULL
            ORDER BY name ASC
            LIMIT 50
            `,
            tenantId
        );
    }
}
```

### 3. Diferenças por Domínio

| Domínio | Campos de Busca | Campos Retornados | Limite |
|---------|----------------|-------------------|---------|
| **Produtos** | `name`, `code` | `id`, `name`, `price`, `is_service`, `image_url` | 20 |
| **Clientes** | `name`, `phone_primary` | `id`, `name`, `phone_primary`, `image_url` | 20 |

## 🎯 Implementação Frontend (React/TypeScript)

### 1. Estados Necessários

```typescript
const [searchTerm, setSearchTerm] = useState('');
const [clients, setClients] = useState<Cliente[]>([]);
const [searchingClients, setSearchingClients] = useState(false);
```

### 2. Busca Automática com Debounce

```typescript
// 🔍 PADRÃO OFICIAL DE BUSCA - CLIENTES (com debounce)
useEffect(() => {
    const timer = setTimeout(() => {
        fetchClients();
    }, 300);

    return () => clearTimeout(timer);
}, [searchTerm]);

const fetchClients = async () => {
    const safeSearch = typeof searchTerm === 'string' ? searchTerm.trim() : '';
    
    // 🔒 Evita busca curta
    if (safeSearch.length > 0 && safeSearch.length < 2) {
        setClients([]);
        return;
    }

    // ✅ Só busca se tiver 2+ caracteres
    if (safeSearch.length >= 2) {
        try {
            setSearchingClients(true);
            const response = await api.get(`/api/ordem_servico/clientes?search=${safeSearch}`);
            setClients(response.data);
        } catch (error) {
            console.error('Erro ao buscar clientes:', error);
            setClients([]);
        } finally {
            setSearchingClients(false);
        }
    } else {
        // 📋 Campo vazio = sem lista
        setClients([]);
    }
};
```

### 3. Interface de Busca

```typescript
<div className="relative">
    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
    <Input
        id="search-client"
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

### 4. Renderização dos Resultados

```typescript
{clients.map(cliente => (
    <div key={cliente.id} className="p-3 hover:bg-muted/50 cursor-pointer">
        <div className="flex items-center gap-3">
            <img src={cliente.image_url || '/avatar.png'} className="h-10 w-10 rounded-full" />
            <div>
                <strong>{cliente.name}</strong>
                <span className="text-sm text-muted-foreground">{cliente.phone_primary}</span>
            </div>
        </div>
    </div>
))}
```

## 🔍 Comportamento Implementado

### Frontend
✅ **1 letra**: Array vazio `[]` (sem busca)  
✅ **2+ letras**: Busca automática com debounce de 300ms  
✅ **Campo vazio**: Array vazio `[]` (sem lista)  
✅ **Loading**: Indicador visual durante busca  
✅ **Debounce**: Evita requisições excessivas  

### Backend
✅ **Busca < 2 caracteres**: Retorna `[]`  
✅ **Busca >= 2 caracteres**: Query com LIMIT 20  
✅ **Sem busca**: Lista padrão com LIMIT 50  
✅ **Case-insensitive**: `LOWER()` para nomes  
✅ **Múltiplos campos**: OR entre campos de busca  

## 🚨 Problemas Comuns e Soluções

### 1. Erro 500 - Placeholders SQL Incorretos

**❌ ERRADO:**
```typescript
query += ` AND name ILIKE ${params.length + 1}`;  // Sem $
```

**✅ CORRETO:**
```typescript
query += ` AND name ILIKE $${params.length + 1}`;  // Com $
// OU usando string concatenation:
query += ` AND name ILIKE $` + (params.length + 1);
```

### 2. Lista Automática Indesejada

**❌ PROBLEMA:**
```typescript
useEffect(() => {
    fetchAllClients(); // Lista automática ao carregar
}, []);
```

**✅ SOLUÇÃO:**
```typescript
// Remover useEffect automático
// Buscar apenas quando usuário digitar 2+ caracteres
if (safeSearch.length >= 2) {
    // busca
} else {
    setClients([]); // sem lista
}
```

### 3. Performance - Busca Pesada

**❌ PROBLEMA:**
```sql
SELECT * FROM clients WHERE name LIKE '%a%'; -- Muito amplo
```

**✅ SOLUÇÃO:**
```sql
-- Validação no service
if (safeSearch.length < 2) return [];

-- Query com LIMIT
SELECT id, name, phone_primary, image_url, is_active, email 
FROM clients 
WHERE ... 
LIMIT 20;
```

## 📊 Estrutura das Tabelas

### Clientes
```sql
CREATE TABLE mod_ordem_servico_clients (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    phone_primary VARCHAR NOT NULL,
    image_url VARCHAR,
    deleted_at TIMESTAMP NULL,
    -- outros campos...
);
```

### Produtos
```sql
CREATE TABLE mod_ordem_servico_products (
    id UUID PRIMARY KEY,
    tenant_id VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    code VARCHAR NOT NULL,
    price DECIMAL(10,2),
    image_url VARCHAR,
    deleted_at TIMESTAMP NULL,
    -- outros campos...
);
```

## 🔍 Exemplos de Query Geradas

### Busca de Cliente
```sql
-- Busca por "joão"
SELECT id, name, phone_primary, image_url, is_active, email
FROM mod_ordem_servico_clients
WHERE tenant_id = $1
    AND deleted_at IS NULL
    AND (LOWER(name) LIKE LOWER($2) OR phone_primary LIKE $2)
ORDER BY name ASC
LIMIT 20

-- Parâmetros: ['tenant123', '%joão%']
```

### Lista Padrão
```sql
-- Sem busca (campo vazio)
SELECT id, name, phone_primary, image_url, is_active, email
FROM mod_ordem_servico_clients
WHERE tenant_id = $1
    AND deleted_at IS NULL
ORDER BY name ASC
LIMIT 50

-- Parâmetros: ['tenant123']
```

## 📝 Checklist de Implementação

### Backend:
- [ ] Controller com `@Query('search') search: string`
- [ ] Service com validação `safeSearch.length < 2`
- [ ] Query SQL com placeholders corretos (`$1`, `$2`)
- [ ] LIMIT 20 para busca, LIMIT 50 para lista padrão
- [ ] Campos específicos no SELECT (não `*`)
- [ ] Case-insensitive com `LOWER()`

### Frontend:
- [ ] useEffect com debounce de 300ms
- [ ] Validação de 2+ caracteres
- [ ] Loading indicator
- [ ] Array vazio para busca curta
- [ ] Placeholder explicativo

### Teste Manual:
- [ ] `search=a` → `[]` (array vazio)
- [ ] `search=jo` → `[{id, name, phone_primary}]` (resultados)
- [ ] Campo vazio → `[]` (sem lista)
- [ ] Loading funciona
- [ ] Debounce evita spam

## 🎯 Regra de Ouro

**Todo domínio que tiver campo de busca deve copiar este padrão.**

Se fizer isso, você evita:
- ❌ Erro 500
- ❌ Busca pesada  
- ❌ Código inconsistente
- ❌ UX ruim

---

**✅ Esta implementação está testada e funcionando nas páginas de clientes e produtos!**