-- ═══════════════════════════════════════════════════════════════════════════
-- SEED: Dados iniciais do módulo demo-completo
-- Versão: 1.0.0
-- Data: 2025-12-15
-- ═══════════════════════════════════════════════════════════════════════════

-- IMPORTANTE: Este seed assume que já existe pelo menos 1 tenant e 1 usuário SUPER_ADMIN

-- Obter primeiro tenant para testes
DO $$
DECLARE
    v_tenant_id UUID;
    v_admin_id UUID;
    v_cat1_id UUID;
    v_cat2_id UUID;
    v_cat3_id UUID;
    v_tag1_id UUID;
    v_tag2_id UUID;
    v_tag3_id UUID;
    v_tag4_id UUID;
    v_demo1_id UUID;
    v_demo2_id UUID;
    v_demo3_id UUID;
BEGIN
    -- Buscar primeiro tenant
    SELECT id INTO v_tenant_id FROM tenants WHERE ativo = true LIMIT 1;
    
    -- Buscar primeiro SUPER_ADMIN
    SELECT id INTO v_admin_id FROM users WHERE role = 'SUPER_ADMIN' LIMIT 1;
    
    IF v_tenant_id IS NULL THEN
        RAISE NOTICE 'Nenhum tenant encontrado. Pulando seed de demo-completo.';
        RETURN;
    END IF;
    
    RAISE NOTICE '📦 Iniciando seed do módulo demo-completo...';
    RAISE NOTICE 'Tenant ID: %', v_tenant_id;
    RAISE NOTICE 'Admin ID: %', v_admin_id;
    
    -- ═══════════════════════════════════════════════════════════════════════
    -- 1. CATEGORIAS
    -- ═══════════════════════════════════════════════════════════════════════
    
    RAISE NOTICE '📂 Criando categorias...';
    
    -- Categoria 1: Tutoriais
    INSERT INTO demo_categories (id, tenant_id, name, slug, description, color, icon, order_index, is_active)
    VALUES (
        gen_random_uuid(),
        v_tenant_id,
        'Tutoriais',
        'tutoriais',
        'Demonstrações em formato de tutorial passo a passo',
        '#3B82F6',
        'book-open',
        1,
        true
    ) RETURNING id INTO v_cat1_id;
    
    -- Categoria 2: Exemplos de Código
    INSERT INTO demo_categories (id, tenant_id, name, slug, description, color, icon, order_index, is_active)
    VALUES (
        gen_random_uuid(),
        v_tenant_id,
        'Exemplos de Código',
        'exemplos-codigo',
        'Snippets e exemplos de implementação',
        '#10B981',
        'code',
        2,
        true
    ) RETURNING id INTO v_cat2_id;
    
    -- Categoria 3: Casos de Uso
    INSERT INTO demo_categories (id, tenant_id, name, slug, description, color, icon, order_index, is_active)
    VALUES (
        gen_random_uuid(),
        v_tenant_id,
        'Casos de Uso',
        'casos-de-uso',
        'Demonstrações de casos reais de aplicação',
        '#F59E0B',
        'lightbulb',
        3,
        true
    ) RETURNING id INTO v_cat3_id;
    
    RAISE NOTICE '  ✓ 3 categorias criadas';
    
    -- ═══════════════════════════════════════════════════════════════════════
    -- 2. TAGS
    -- ═══════════════════════════════════════════════════════════════════════
    
    RAISE NOTICE '🏷️  Criando tags...';
    
    INSERT INTO demo_tags (id, tenant_id, name, slug, color, usage_count)
    VALUES 
        (gen_random_uuid(), v_tenant_id, 'Iniciante', 'iniciante', '#22C55E', 0),
        (gen_random_uuid(), v_tenant_id, 'Intermediário', 'intermediario', '#F97316', 0),
        (gen_random_uuid(), v_tenant_id, 'Avançado', 'avancado', '#EF4444', 0),
        (gen_random_uuid(), v_tenant_id, 'Popular', 'popular', '#8B5CF6', 0),
        (gen_random_uuid(), v_tenant_id, 'Novo', 'novo', '#06B6D4', 0),
        (gen_random_uuid(), v_tenant_id, 'Destaque', 'destaque', '#FBBF24', 0),
        (gen_random_uuid(), v_tenant_id, 'API', 'api', '#6366F1', 0),
        (gen_random_uuid(), v_tenant_id, 'Frontend', 'frontend', '#EC4899', 0),
        (gen_random_uuid(), v_tenant_id, 'Backend', 'backend', '#14B8A6', 0),
        (gen_random_uuid(), v_tenant_id, 'Full-Stack', 'full-stack', '#8B5CF6', 0)
    RETURNING id INTO v_tag1_id, v_tag2_id, v_tag3_id, v_tag4_id;
    
    RAISE NOTICE '  ✓ 10 tags criadas';
    
    -- ═══════════════════════════════════════════════════════════════════════
    -- 3. DEMONSTRAÇÕES
    -- ═══════════════════════════════════════════════════════════════════════
    
    RAISE NOTICE '📝 Criando demonstrações...';
    
    -- Demo 1: Sistema Modular CORE
    INSERT INTO demos (id, tenant_id, title, description, content, status, priority, views_count, likes_count, created_by)
    VALUES (
        gen_random_uuid(),
        v_tenant_id,
        'Introdução ao Sistema Modular CORE',
        'Aprenda os conceitos fundamentais do CORE IDEAL e como criar módulos extensíveis',
        E'# Introdução ao Sistema Modular CORE\n\nO CORE IDEAL é uma plataforma 100% modular que funciona como base para sistemas extensíveis.\n\n## Conceitos Principais\n\n### 1. Event-Driven Architecture\nTodo o sistema é baseado em eventos...\n\n### 2. Dependency Injection\nO CoreContext é injetado em todos os módulos...\n\n### 3. Plugin System\nMódulos podem ser adicionados ou removidos sem alterar o CORE...',
        'published',
        10,
        125,
        42,
        v_admin_id
    ) RETURNING id INTO v_demo1_id;
    
    -- Demo 2: Criando Seu Primeiro Módulo
    INSERT INTO demos (id, tenant_id, title, description, content, status, priority, views_count, likes_count, created_by)
    VALUES (
        gen_random_uuid(),
        v_tenant_id,
        'Como Criar Seu Primeiro Módulo',
        'Tutorial passo a passo para criar um módulo completo do zero',
        E'# Como Criar Seu Primeiro Módulo\n\nNeste tutorial, vamos criar um módulo completo do zero.\n\n## Estrutura de Arquivos\n\n```\nmeu-modulo/\n├── module.json\n├── module.config.json\n├── index.ts\n├── migrates/\n│   └── 001_create_tables.sql\n├── seeds/\n│   └── seed.sql\n└── src/\n    ├── controllers/\n    ├── services/\n    └── components/\n```\n\n## Passo 1: Criar module.json...',
        'published',
        9,
        89,
        31,
        v_admin_id
    ) RETURNING id INTO v_demo2_id;
    
    -- Demo 3: Integrando com Event Bus
    INSERT INTO demos (id, tenant_id, title, description, content, status, priority, views_count, likes_count, created_by)
    VALUES (
        gen_random_uuid(),
        v_tenant_id,
        'Integrando com Event Bus',
        'Aprenda a usar o Event Bus para comunicação entre módulos',
        E'# Integrando com Event Bus\n\nO Event Bus é o coração da comunicação na plataforma.\n\n## Eventos Disponíveis\n\n- `core:boot` - Sistema inicializando\n- `core:ready` - Sistema pronto\n- `routes:register` - Registrar rotas\n- `menu:register` - Registrar menus\n- `dashboard:register` - Registrar widgets\n\n## Exemplo de Uso\n\n```typescript\ncontext.events.on(\'menu:register\', () => {\n  context.menu.add({\n    id: \'meu-item\',\n    label: \'Meu Item\',\n    href: \'/meu-item\'\n  });\n});\n```',
        'published',
        8,
        67,
        28,
        v_admin_id
    ) RETURNING id INTO v_demo3_id;
    
    -- Demo 4: Multi-Tenancy
    INSERT INTO demos (id, tenant_id, title, description, content, status, priority, views_count, likes_count, created_by)
    VALUES (
        gen_random_uuid(),
        v_tenant_id,
        'Implementando Multi-Tenancy',
        'Como garantir isolamento total de dados entre tenants',
        E'# Implementando Multi-Tenancy\n\nO sistema já resolve automaticamente o tenant em cada requisição.\n\n## Filtragem Automática\n\nTodas as queries devem filtrar por tenant:\n\n```typescript\nconst demos = await context.db.raw(\n  \'SELECT * FROM demos WHERE tenant_id = $1\',\n  [context.tenant?.id]\n);\n```\n\n## Best Practices\n\n1. SEMPRE filtrar por tenant_id\n2. Usar o context.tenant\n3. Validar permissões',
        'draft',
        7,
        45,
        15,
        v_admin_id
    );
    
    -- Demo 5: Sistema de Permissões
    INSERT INTO demos (id, tenant_id, title, description, content, status, priority, views_count, likes_count, created_by)
    VALUES (
        gen_random_uuid(),
        v_tenant_id,
        'Sistema de Permissões ACL',
        'Entenda como funciona o controle de acesso baseado em permissões',
        E'# Sistema de Permissões ACL\n\n## Registrando Permissões\n\n```typescript\ncontext.acl.registerPermission(\n  \'meumodulo.view\',\n  \'Visualizar módulo\'\n);\n```\n\n## Verificando Permissões\n\n```typescript\nif (!context.acl.userHasPermission(user, \'meumodulo.view\')) {\n  return res.status(403).json({ error: \'Forbidden\' });\n}\n```',
        'published',
        6,
        102,
        38,
        v_admin_id
    );
    
    RAISE NOTICE '  ✓ 5 demonstrações criadas';
    
    -- ═══════════════════════════════════════════════════════════════════════
    -- 4. RELACIONAMENTOS
    -- ═══════════════════════════════════════════════════════════════════════
    
    RAISE NOTICE '🔗 Criando relacionamentos...';
    
    -- Associar demos com categorias
    INSERT INTO demo_category_relations (demo_id, category_id)
    SELECT v_demo1_id, v_cat1_id
    UNION ALL
    SELECT v_demo2_id, v_cat1_id
    UNION ALL
    SELECT v_demo2_id, v_cat2_id
    UNION ALL
    SELECT v_demo3_id, v_cat2_id;
    
    -- Associar demos com tags (buscar IDs das tags criadas)
    INSERT INTO demo_tag_relations (demo_id, tag_id)
    SELECT v_demo1_id, id FROM demo_tags WHERE slug IN ('iniciante', 'popular', 'novo') AND tenant_id = v_tenant_id
    UNION ALL
    SELECT v_demo2_id, id FROM demo_tags WHERE slug IN ('iniciante', 'tutorial') AND tenant_id = v_tenant_id
    UNION ALL
    SELECT v_demo3_id, id FROM demo_tags WHERE slug IN ('intermediario', 'api') AND tenant_id = v_tenant_id;
    
    -- Atualizar contadores de uso das tags
    UPDATE demo_tags
    SET usage_count = (
        SELECT COUNT(*) 
        FROM demo_tag_relations 
        WHERE tag_id = demo_tags.id
    )
    WHERE tenant_id = v_tenant_id;
    
    RAISE NOTICE '  ✓ Relacionamentos criados';
    
    -- ═══════════════════════════════════════════════════════════════════════
    -- 5. COMENTÁRIOS DE EXEMPLO
    -- ═══════════════════════════════════════════════════════════════════════
    
    RAISE NOTICE '💬 Criando comentários de exemplo...';
    
    INSERT INTO demo_comments (demo_id, user_id, content)
    SELECT v_demo1_id, v_admin_id, 'Excelente introdução! Muito clara e objetiva.'
    WHERE v_admin_id IS NOT NULL
    UNION ALL
    SELECT v_demo2_id, v_admin_id, 'Tutorial perfeito para iniciantes. Recomendo!'
    WHERE v_admin_id IS NOT NULL;
    
    RAISE NOTICE '  ✓ Comentários criados';
    
    -- ═══════════════════════════════════════════════════════════════════════
    -- 6. ATIVIDADES/AUDIT LOG
    -- ═══════════════════════════════════════════════════════════════════════
    
    RAISE NOTICE '📋 Registrando atividades iniciais...';
    
    INSERT INTO demo_activities (demo_id, user_id, action, changes)
    SELECT v_demo1_id, v_admin_id, 'created', '{"status": "published"}'::jsonb
    WHERE v_admin_id IS NOT NULL
    UNION ALL
    SELECT v_demo2_id, v_admin_id, 'created', '{"status": "published"}'::jsonb
    WHERE v_admin_id IS NOT NULL
    UNION ALL
    SELECT v_demo3_id, v_admin_id, 'created', '{"status": "published"}'::jsonb
    WHERE v_admin_id IS NOT NULL;
    
    RAISE NOTICE '  ✓ Atividades registradas';
    
    -- ═══════════════════════════════════════════════════════════════════════
    -- RESUMO
    -- ═══════════════════════════════════════════════════════════════════════
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Seed do módulo demo-completo concluído com sucesso!';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    RAISE NOTICE '📊 Resumo:';
    RAISE NOTICE '   • 3 categorias criadas';
    RAISE NOTICE '   • 10 tags criadas';
    RAISE NOTICE '   • 5 demonstrações criadas';
    RAISE NOTICE '   • Relacionamentos estabelecidos';
    RAISE NOTICE '   • Comentários de exemplo adicionados';
    RAISE NOTICE '   • Atividades registradas';
    RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
    
END $$;
