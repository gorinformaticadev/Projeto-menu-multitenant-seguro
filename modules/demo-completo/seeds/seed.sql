-- SEED SIMPLIFICADO: Dados iniciais do módulo demo-completo
-- Removido bloco PL/pgSQL para compatibilidade com o parser simples

-- 1. CATEGORIAS
INSERT INTO demo_categories (id, tenant_id, name, slug, description, color, icon, order_index, is_active)
SELECT 
    gen_random_uuid(),
    t.id,
    'Tutoriais',
    'tutoriais',
    'Demonstrações em formato de tutorial passo a passo',
    '#3B82F6',
    'book-open',
    1,
    true
FROM tenants t WHERE t.ativo = true LIMIT 1;

INSERT INTO demo_categories (id, tenant_id, name, slug, description, color, icon, order_index, is_active)
SELECT 
    gen_random_uuid(),
    t.id,
    'Exemplos de Código',
    'exemplos-codigo',
    'Snippets e exemplos de implementação',
    '#10B981',
    'code',
    2,
    true
FROM tenants t WHERE t.ativo = true LIMIT 1;

-- 2. TAGS
INSERT INTO demo_tags (id, tenant_id, name, slug, color, usage_count)
SELECT gen_random_uuid(), t.id, 'Iniciante', 'iniciante', '#22C55E', 0 FROM tenants t WHERE t.ativo = true LIMIT 1;

INSERT INTO demo_tags (id, tenant_id, name, slug, color, usage_count)
SELECT gen_random_uuid(), t.id, 'Avançado', 'avancado', '#EF4444', 0 FROM tenants t WHERE t.ativo = true LIMIT 1;

-- 3. DEMOS
INSERT INTO demos (id, tenant_id, title, description, content, status, priority, views_count, likes_count, created_by)
SELECT
    gen_random_uuid(),
    t.id,
    'Demo Inicial',
    'Uma demonstração simples para testar o módulo',
    '# Olá Mundo\nEste é um dado de teste.',
    'published',
    1,
    0,
    0,
    u.id
FROM tenants t
CROSS JOIN users u
WHERE t.ativo = true AND u.role = 'SUPER_ADMIN'
LIMIT 1;
