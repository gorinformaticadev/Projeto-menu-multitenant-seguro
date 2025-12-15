// Exemplos de Uso da API de Módulos
// ====================================

// 1. LISTAR TODOS OS MÓDULOS INSTALADOS
// GET /modules/installed
// Resposta:
[
    {
        "id": "uuid-1",
        "name": "module-exemplo",
        "displayName": "Módulo de Exemplo",
        "description": "Um módulo de exemplo",
        "version": "1.0.0",
        "isActive": true,
        "isInstalled": true,
        "config": null,
        "createdAt": "2025-12-01T10:00:00Z",
        "updatedAt": "2025-12-01T10:00:00Z"
    }
]

// 2. CONSULTAR QUAIS TENANTS USAM UM MÓDULO
// GET /modules/module-exemplo/tenants
// Resposta:
{
    "module": {
        "name": "module-exemplo",
            "displayName": "Módulo de Exemplo",
                "version": "1.0.0"
    },
    "summary": {
        "total": 3,           // Total de registros (ativos + inativos)
            "active": 1,          // Tenants com módulo ativo
                "inactive": 2,        // Tenants com módulo inativo
                    "canUninstall": false // false porque há 1 tenant ativo
    },
    "activeTenants": [
        {
            "tenantId": "tenant-uuid-1",
            "tenantName": "Empresa ABC Ltda",
            "tenantEmail": "contato@empresaabc.com",
            "tenantActive": true,
            "activatedAt": "2025-12-01T10:00:00Z",
            "config": null
        }
    ],
        "inactiveTenants": [
            {
                "tenantId": "tenant-uuid-2",
                "tenantName": "Empresa XYZ S.A.",
                "tenantEmail": "contato@empresaxyz.com",
                "tenantActive": true,
                "deactivatedAt": "2025-12-10T15:30:00Z",
                "config": null
            },
            {
                "tenantId": "tenant-uuid-3",
                "tenantName": "Empresa 123 ME",
                "tenantEmail": "contato@empresa123.com",
                "tenantActive": false,
                "deactivatedAt": "2025-12-05T08:00:00Z",
                "config": null
            }
        ]
}

// 3. TENTAR DESINSTALAR MÓDULO (COM TENANTS ATIVOS)
// DELETE /modules/module-exemplo/uninstall
// Resposta: 400 Bad Request
{
    "statusCode": 400,
        "message": "Não é possível remover o módulo 'module-exemplo' pois está ativo em 1 tenant(s): Empresa ABC Ltda. Desative o módulo em todos os tenants antes de desinstalá-lo.",
            "error": "Bad Request"
}

// 4. DESATIVAR MÓDULO EM UM TENANT
// PUT /tenants/tenant-uuid-1/modules/module-exemplo
{
    "isActive": false
}
// Resposta:
{
    "id": "tenant-module-uuid",
        "tenantId": "tenant-uuid-1",
            "moduleName": "module-exemplo",
                "isActive": false,
                    "deactivatedAt": "2025-12-14T18:00:00Z",
                        "updatedAt": "2025-12-14T18:00:00Z"
}

// 5. CONSULTAR NOVAMENTE (APÓS DESATIVAR)
// GET /modules/module-exemplo/tenants
// Resposta:
{
    "module": {
        "name": "module-exemplo",
            "displayName": "Módulo de Exemplo",
                "version": "1.0.0"
    },
    "summary": {
        "total": 3,
            "active": 0,          // Agora não há tenants ativos
                "inactive": 3,
                    "canUninstall": true  // ✅ Agora pode desinstalar!
    },
    "activeTenants": [],    // Lista vazia
        "inactiveTenants": [
            // ... todos os 3 tenants estão inativos
        ]
}

// 6. DESINSTALAR MÓDULO (AGORA VAI FUNCIONAR)
// DELETE /modules/module-exemplo/uninstall
// Resposta: 200 OK
{
    "success": true,
        "message": "Módulo 'module-exemplo' removido com sucesso"
}

// ====================================
// FLUXO COMPLETO DE DESINSTALAÇÃO
// ====================================

/*
PASSO 1: Verificar se o módulo pode ser desinstalado
----------------------------------------------------- */
GET / modules / module - exemplo / tenants

// Se summary.canUninstall === false:
//   - Veja a lista de activeTenants
//   - Desative o módulo em cada um deles

/*
PASSO 2: Desativar módulo em cada tenant ativo
----------------------------------------------------- */
// Para cada tenant em activeTenants:
PUT / tenants / { tenantId } / modules / module - exemplo
{
    "isActive": false
}

/*
PASSO 3: Confirmar que não há mais tenants ativos
----------------------------------------------------- */
GET / modules / module - exemplo / tenants
// Verificar: summary.canUninstall === true

/*
PASSO 4: Desinstalar o módulo
----------------------------------------------------- */
DELETE / modules / module - exemplo / uninstall

// ====================================
// LOGS DO SERVIDOR
// ====================================

// Quando há tentativa de desinstalar com tenants ativos:
/*
[ModuleInstallerService] Iniciando remoção do módulo: module-exemplo
[ModuleInstallerService] WARN Tentativa de remover módulo 'module-exemplo' bloqueada. Módulo ativo em 1 tenant(s): Empresa ABC Ltda
[ModuleInstallerService] ERROR Erro ao remover módulo: Não é possível remover o módulo 'module-exemplo' pois está ativo em 1 tenant(s): Empresa ABC Ltda. Desative o módulo em todos os tenants antes de desinstalá-lo.
*/

// Quando a desinstalação é bem-sucedida:
/*
[ModuleInstallerService] Iniciando remoção do módulo: module-exemplo
[ModuleInstallerService] Módulo module-exemplo removido com sucesso
*/
