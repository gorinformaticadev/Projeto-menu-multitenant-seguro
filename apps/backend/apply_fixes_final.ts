import * as fs from 'fs';

function fixFile(filePath: string, search: string, replace: string) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(search)) {
        content = content.replace(search, replace);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Fixed ${filePath}`);
    } else {
        console.warn(`Not found in ${filePath}: ${search}`);
    }
}

// 1. Remove duplicate TelemetryRequestLike
const stPath = 'src/common/services/system-telemetry.service.ts';
let stContent = fs.readFileSync(stPath, 'utf8');
// Look for THE WHOLE TYPE BLOCK
const start = stContent.indexOf('export type TelemetryRequestLike = {');
if (start !== -1) {
    const end = stContent.indexOf('};', start) + 2;
    stContent = stContent.substring(0, start) + stContent.substring(end);
    fs.writeFileSync(stPath, stContent, 'utf8');
    console.log('Removed duplicate type in system-telemetry.service.ts');
}

// 2. Module JSON Validator
fixFile('src/core/validators/module-json.validator.ts', 'json.name.length', '(json.name as string).length');
fixFile('src/core/validators/module-json.validator.ts', 'json.name.length', '(json.name as string).length'); // Repeat for second occurrence
fixFile('src/core/validators/module-json.validator.ts', 'json.displayName.length', '(json.displayName as string).length');
fixFile('src/core/validators/module-json.validator.ts', 'nameRegex.test(json.name)', 'nameRegex.test(json.name as string)');
fixFile('src/core/validators/module-json.validator.ts', 'versionRegex.test(json.version)', 'versionRegex.test(json.version as string)');

// 3. Maintenance Mode Guard
fixFile('src/maintenance/maintenance-mode.guard.ts', 'const { actor, requestCtx, tenantId } = extractAuditContext({', 'const { actor, requestCtx, tenantId } = extractAuditContext({ as any');
// Wait, that's wrong. Correct:
const mmPath = 'src/maintenance/maintenance-mode.guard.ts';
let mmContent = fs.readFileSync(mmPath, 'utf8');
mmContent = mmContent.replace('const { actor, requestCtx, tenantId } = extractAuditContext({', 'const { actor, requestCtx, tenantId } = extractAuditContext({\n      ...(null as any),\n');
// Or just cast the whole object:
mmContent = mmContent.replace('extractAuditContext({', 'extractAuditContext({ as any'); // No, that's not valid TS
mmContent = mmContent.replace('extractAuditContext({', 'extractAuditContext(<any>{');
fs.writeFileSync(mmPath, mmContent, 'utf8');

// 4. Security Throttler RequestLike to TelemetryRequestLike
fixFile('src/common/guards/security-throttler.guard.ts', 'request as RequestLike', 'request as any');
