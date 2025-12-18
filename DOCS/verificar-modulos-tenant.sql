-- Script para verificar módulos habilitados por tenant
-- Execute este script no PostgreSQL para verificar o estado dos módulos

-- 1. Ver todos os tenants
SELECT 
    id,
    "nomeFantasia",
    email,
    ativo
FROM tenants
ORDER BY "nomeFantasia";

-- 2. Ver todos os módulos do sistema
SELECT 
    id,
    slug,
    name,
    version,
    status,
    "hasBackend",
    "hasFrontend",
    "installedAt",
    "activatedAt"
FROM modules
ORDER BY name;

-- 3. Ver relação módulo-tenant (quais módulos estão habilitados para quais tenants)
SELECT 
    mt.id,
    t."nomeFantasia" as tenant_name,
    t.id as tenant_id,
    m.name as module_name,
    m.slug as module_slug,
    m.status as module_status,
    mt.enabled as tenant_module_enabled,
    mt."createdAt",
    mt."updatedAt"
FROM module_tenant mt
INNER JOIN tenants t ON mt."tenantId" = t.id
INNER JOIN modules m ON mt."moduleId" = m.id
ORDER BY t."nomeFantasia", m.name;

-- 4. Ver módulos habilitados para um tenant específico
-- (Substitua '18dde600-db8e-4e08-85f6-bcb21c0e834e' pelo ID do seu tenant)
SELECT 
    m.slug,
    m.name,
    m.version,
    m.status as system_status,
    mt.enabled as enabled_for_tenant,
    mt."updatedAt" as last_updated
FROM modules m
LEFT JOIN module_tenant mt ON m.id = mt."moduleId" 
    AND mt."tenantId" = '18dde600-db8e-4e08-85f6-bcb21c0e834e'
WHERE m.status = 'active'
ORDER BY m.name;

-- 5. Contar quantos tenants têm cada módulo habilitado
SELECT 
    m.slug,
    m.name,
    COUNT(CASE WHEN mt.enabled = true THEN 1 END) as tenants_with_module_enabled,
    COUNT(mt.id) as total_tenant_relations
FROM modules m
LEFT JOIN module_tenant mt ON m.id = mt."moduleId"
GROUP BY m.id, m.slug, m.name
ORDER BY m.name;

-- 6. Ver últimas alterações em module_tenant
SELECT 
    mt.id,
    t."nomeFantasia" as tenant,
    m.name as module,
    mt.enabled,
    mt."createdAt" as created,
    mt."updatedAt" as last_updated
FROM module_tenant mt
INNER JOIN tenants t ON mt."tenantId" = t.id
INNER JOIN modules m ON mt."moduleId" = m.id
ORDER BY mt."updatedAt" DESC
LIMIT 20;
