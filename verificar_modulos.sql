-- Script SQL para verificar se os módulos estão sendo registrados corretamente
-- Execute este script após fazer upload de um módulo

-- 1. Listar todos os módulos registrados
SELECT 
    id,
    name,
    "displayName",
    version,
    "isActive",
    "createdAt",
    "updatedAt"
FROM modules
ORDER BY "createdAt" DESC;

-- 2. Verificar módulo específico
SELECT 
    m.id,
    m.name,
    m."displayName",
    m.version,
    m.description,
    m."isActive",
    m.config,
    m."createdAt",
    m."updatedAt",
    COUNT(tm.id) as total_tenants,
    COUNT(CASE WHEN tm."isActive" = true THEN 1 END) as active_tenants
FROM modules m
LEFT JOIN tenant_modules tm ON tm."moduleName" = m.name
WHERE m.name = 'module-exemplo'  -- Substitua pelo nome do seu módulo
GROUP BY m.id;

-- 3. Verificar quais tenants estão usando o módulo
SELECT 
    t.id as tenant_id,
    t."nomeFantasia" as tenant_name,
    t.email as tenant_email,
    tm."isActive" as module_active,
    tm."activatedAt",
    tm."deactivatedAt"
FROM tenant_modules tm
JOIN tenants t ON t.id = tm."tenantId"
WHERE tm."moduleName" = 'module-exemplo'  -- Substitua pelo nome do seu módulo
ORDER BY tm."isActive" DESC, t."nomeFantasia";

-- 4. Verificar se há módulos descompactados mas não registrados
-- (Este seria um problema - não deveria retornar nada após a correção)
-- Nota: Esta query precisa ser executada manualmente verificando a pasta ../modules/

-- 5. Estatísticas gerais
SELECT 
    COUNT(*) as total_modules,
    COUNT(CASE WHEN "isActive" = true THEN 1 END) as active_modules,
    COUNT(CASE WHEN "isActive" = false THEN 1 END) as inactive_modules
FROM modules;

-- 6. Módulos mais usados
SELECT 
    m.name,
    m."displayName",
    COUNT(tm.id) as total_tenants,
    COUNT(CASE WHEN tm."isActive" = true THEN 1 END) as active_tenants
FROM modules m
LEFT JOIN tenant_modules tm ON tm."moduleName" = m.name
GROUP BY m.id, m.name, m."displayName"
ORDER BY active_tenants DESC, total_tenants DESC;

-- 7. Verificar último módulo instalado
SELECT 
    name,
    "displayName",
    version,
    "isActive",
    "createdAt"
FROM modules
ORDER BY "createdAt" DESC
LIMIT 1;

-- 8. Módulos que podem ser desinstalados (sem tenants ativos)
SELECT 
    m.name,
    m."displayName",
    m.version,
    COUNT(CASE WHEN tm."isActive" = true THEN 1 END) as active_tenants
FROM modules m
LEFT JOIN tenant_modules tm ON tm."moduleName" = m.name
GROUP BY m.id, m.name, m."displayName", m.version
HAVING COUNT(CASE WHEN tm."isActive" = true THEN 1 END) = 0
ORDER BY m.name;

-- 9. Módulos que NÃO podem ser desinstalados (com tenants ativos)
SELECT 
    m.name,
    m."displayName",
    m.version,
    COUNT(CASE WHEN tm."isActive" = true THEN 1 END) as active_tenants,
    STRING_AGG(CASE WHEN tm."isActive" = true THEN t."nomeFantasia" END, ', ') as tenant_names
FROM modules m
LEFT JOIN tenant_modules tm ON tm."moduleName" = m.name
LEFT JOIN tenants t ON t.id = tm."tenantId"
GROUP BY m.id, m.name, m."displayName", m.version
HAVING COUNT(CASE WHEN tm."isActive" = true THEN 1 END) > 0
ORDER BY active_tenants DESC;
