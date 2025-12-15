# Correção de Violação das Rules of Hooks - Páginas Empresas e Usuários

## Contexto do Problema

As páginas de Empresas (`/empresas/page.tsx`) e Usuários (`/usuarios/page.tsx`) estão apresentando erro crítico de violação das **Rules of Hooks** do React, causando falha na renderização das páginas.

### Erro Identificado

```
Warning: React has detected a change in the order of Hooks called by UsuariosPage. 
This will lead to bugs and errors if not fixed.
```

O erro indica que entre renderizações consecutivas, a ordem ou quantidade de Hooks está mudando, especificamente:
- **Hook 22**: undefined → useCallback (novo Hook sendo adicionado condicionalmente)

### Causa Raiz

Ambas as páginas utilizam **`React.useCallback` inline dentro do JSX**, o que viola a regra fundamental do React de que Hooks devem ser chamados sempre na mesma ordem em toda renderização. Quando Hooks são chamados dentro de callbacks inline em elementos JSX, sua ordem pode variar dependendo de condições de renderização.

**Locais problemáticos identificados:**

#### Em `usuarios/page.tsx`:
- Linha 282-284: `useCallback` inline no onChange do select
- Linha 442-444: `useCallback` inline no onChange do input de nome
- Linha 454-456: `useCallback` inline no onChange do input de email
- Linha 465-467: `useCallback` inline no onChange do select de role
- Linha 481-483: `useCallback` inline no onChange do PasswordInput

#### Em `empresas/page.tsx`:
Padrão similar com múltiplos `useCallback` inline em elementos de formulário

## Objetivo da Correção

Refatorar ambas as páginas para garantir conformidade com as **Rules of Hooks** do React, eliminando chamadas condicionais ou variáveis de Hooks e garantindo ordem consistente em todas as renderizações.

## Princípios das Rules of Hooks

### Regra 1: Apenas chame Hooks no nível superior
- NUNCA chame Hooks dentro de loops, condições ou funções aninhadas
- Hooks devem ser chamados sempre na mesma ordem em cada renderização

### Regra 2: Apenas chame Hooks em funções React
- Chame Hooks apenas de componentes funcionais React
- Chame Hooks de Custom Hooks

## Estratégia de Correção

### 1. Mover Todos os useCallback para o Nível Superior

Todos os `React.useCallback` que estão inline no JSX devem ser movidos para o topo do componente, antes do retorno do JSX.

**Padrão Incorreto (atual):**
```
onChange={React.useCallback((e) => {
  setFormData(prev => ({ ...prev, name: e.target.value }));
}, [])}
```

**Padrão Correto:**
```
// No topo do componente, após outros Hooks
const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  setFormData(prev => ({ ...prev, name: e.target.value }));
}, []);

// No JSX
onChange={handleNameChange}
```

### 2. Consolidar Handlers Similares

Para campos de formulário similares, criar handlers genéricos reutilizáveis quando apropriado.

**Exemplo de handler genérico:**
```
const handleFormFieldChange = useCallback((field: keyof typeof formData) => 
  (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [field]: e.target.value }));
  }, []);
```

**Uso no JSX:**
```
onChange={handleFormFieldChange('name')}
onChange={handleFormFieldChange('email')}
```

### 3. Ordem de Declaração dos Hooks

Manter ordem consistente e previsível:

```
1. useState - Estados básicos
2. useState - Estados de loading/dialogs
3. useState - Estados de formulário
4. useAuth/useToast - Context Hooks
5. useEffect - Efeitos de inicialização
6. useEffect - Efeitos dependentes
7. useCallback - Handlers de eventos
8. useCallback - Handlers de formulário
9. useMemo - Valores computados (se necessário)
```

## Correções Específicas por Página

### Página de Usuários (`usuarios/page.tsx`)

#### Handlers a serem criados no nível superior:

1. **handleTenantSelectChange** - Para seleção de tenant (linha 282)
2. **handleNameInputChange** - Para input de nome (linha 442)
3. **handleEmailInputChange** - Para input de email (linha 454)
4. **handleRoleSelectChange** - Para select de role (linha 465)
5. **handlePasswordChange** - Para PasswordInput (linha 481)

#### Estrutura corrigida:

```
// 1. Estados (useState)
const [tenants, setTenants] = useState<Tenant[]>([]);
const [selectedTenantId, setSelectedTenantId] = useState<string>("");
// ... outros estados

// 2. Hooks de contexto
const { toast } = useToast();
const { user } = useAuth();

// 3. Estados de formulário
const [formData, setFormData] = useState({ ... });

// 4. Efeitos
useEffect(() => { ... }, [user]);
useEffect(() => { ... }, [searchParams, user]);
useEffect(() => { ... }, [selectedTenantId]);

// 5. Callbacks - TODOS NO NÍVEL SUPERIOR
const handleTenantSelectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
  setSelectedTenantId(e.target.value);
}, []);

const handleNameInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  setFormData(prev => ({ ...prev, name: e.target.value }));
}, []);

const handleEmailInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
  setFormData(prev => ({ ...prev, email: e.target.value }));
}, []);

const handleRoleSelectChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
  setFormData(prev => ({ ...prev, role: e.target.value }));
}, []);

const handlePasswordChange = useCallback((value: string, isValid: boolean) => {
  setFormData(prev => ({ ...prev, password: value }));
}, []);

// 6. Funções assíncronas (não precisam ser useCallback)
async function loadTenants() { ... }
async function loadUsers() { ... }
async function handleSubmit(e: React.FormEvent) { ... }
// ...

// 7. Renderização
return ( ... )
```

### Página de Empresas (`empresas/page.tsx`)

Seguir o mesmo padrão da página de Usuários:

1. Identificar todos os `useCallback` inline
2. Mover para o nível superior do componente
3. Nomear apropriadamente cada handler
4. Garantir array de dependências correto
5. Manter ordem consistente de Hooks

## Validação da Correção

### Checklist de Conformidade

- [ ] Nenhum Hook é chamado dentro de loops
- [ ] Nenhum Hook é chamado dentro de condições
- [ ] Nenhum Hook é chamado dentro de callbacks ou event handlers
- [ ] Todos os Hooks estão no nível superior do componente
- [ ] A ordem dos Hooks é sempre a mesma em cada renderização
- [ ] Não há Hooks condicionais (baseados em if/else)
- [ ] Array de dependências está correto em cada useCallback/useEffect

### Teste de Renderização

Após a correção, o console do navegador NÃO deve apresentar:
- Warning sobre mudança na ordem dos Hooks
- Warning sobre atualização de componente durante renderização de outro
- Erros de renderização ou crashes

### Comportamento Esperado

Ambas as páginas devem:
- Carregar sem erros no console
- Renderizar corretamente em todas as condições
- Manter funcionalidade completa de CRUD
- Responder adequadamente a interações do usuário
- Preservar performance (useCallback previne re-renderizações desnecessárias)

## Benefícios da Correção

### Estabilidade
- Elimina crashes de renderização
- Garante comportamento previsível
- Previne bugs futuros relacionados a Hooks

### Manutenibilidade
- Código mais organizado e legível
- Handlers claramente nomeados e agrupados
- Facilita debugging e testes

### Performance
- useCallback no nível superior permite otimização adequada
- Previne re-criação desnecessária de funções
- Melhora performance geral do componente

## Observações Importantes

### Quando NÃO usar useCallback

Se um handler não é passado como prop para componentes filhos e não está em array de dependências de outros Hooks, o useCallback pode ser opcional. Funções normais são suficientes.

### Array de Dependências

- **[]** (vazio): Função nunca muda
- **[state]**: Função muda quando state muda
- Para handlers de formulário que apenas setam estado: normalmente **[]** é suficiente

### React StrictMode

Em desenvolvimento, o React pode renderizar componentes duas vezes. A correção deve funcionar corretamente mesmo com StrictMode ativo.

## Impacto

### Arquivos Afetados
- `frontend/src/app/usuarios/page.tsx`
- `frontend/src/app/empresas/page.tsx`

### Tipo de Mudança
- **Refatoração de Código**: Reorganização de Hooks sem mudança de funcionalidade
- **Correção de Bug Crítico**: Elimina violação das Rules of Hooks

### Compatibilidade
- Nenhuma mudança na API ou interface
- Nenhuma mudança no comportamento do usuário
- 100% compatível com código existente
