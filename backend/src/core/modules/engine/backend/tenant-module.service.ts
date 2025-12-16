import { Injectable } from '@nestjs/common';

@Injectable()
export class TenantModuleService {
    // Methods used by controllers
    async isModuleActiveForTenant(moduleName: string, tenantId: string): Promise<boolean> {
        return true;
    }

    async activateModuleForTenant(moduleName: string, tenantId: string): Promise<void> {
        // Stub implementation
    }

    async deactivateModuleForTenant(moduleName: string, tenantId: string): Promise<void> {
        // Stub implementation
    }

    async getActiveModulesForTenant(tenantId: string): Promise<string[]> {
        return [];
    }

    // Keep original methods if referenced elsewhere
    async getModulesForTenant(tenantId: string) { return []; }
    async enableModule(tenantId: string, moduleSlug: string) { return true; }
    async disableModule(tenantId: string, moduleSlug: string) { return true; }
}
