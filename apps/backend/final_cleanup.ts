import * as fs from 'fs';

function fix(filePath: string, search: RegExp | string, replace: string) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(search, replace);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Patched ${filePath}`);
}

// 1. Telemetry Duplicate
const stPath = 'src/common/services/system-telemetry.service.ts';
fix(stPath, /type TelemetryRequestLike,\s+type TelemetryRequestLike,/g, 'type TelemetryRequestLike,');

// 2. Maintenance Mode Guard MESS
const mmPath = 'src/maintenance/maintenance-mode.guard.ts';
// I'll replace the WHOLE function call block to be safe
const mmContent = fs.readFileSync(mmPath, 'utf8');
const startMatch = /const \{ actor, requestCtx, tenantId \} = extractAuditContext\([\s\S]+?\}\);/;
const replacement = `const { actor, requestCtx, tenantId } = extractAuditContext({
      headers: request.headers,
      ip: request.ip,
      socket: request.socket,
      user: {
        id: userPayload?.id || userPayload?.sub,
        sub: userPayload?.sub || userPayload?.id,
        email: userPayload?.email,
        role,
        tenantId: userPayload?.tenantId,
      },
    } as any);`;
if (mmContent.match(startMatch)) {
    fs.writeFileSync(mmPath, mmContent.replace(startMatch, replacement), 'utf8');
    console.log('Fixed MaintenanceModeGuard extractAuditContext block');
} else {
    console.warn('Could not find extractAuditContext block in MaintenanceModeGuard');
}
