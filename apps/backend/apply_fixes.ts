import * as fs from 'fs';
import * as path from 'path';

function fixFile(filePath: string, fixes: { search: string, replace: string }[]) {
    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
    }
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    for (const fix of fixes) {
        if (content.includes(fix.search)) {
            content = content.split(fix.search).join(fix.replace);
            modified = true;
            console.log(`Applied fix to ${filePath}`);
        } else {
            console.warn(`Search string not found in ${filePath}: ${fix.search.substring(0, 50)}...`);
        }
    }
    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
    }
}

// 1. Prisma Service resolveModelDelegate
fixFile('src/core/prisma/prisma.service.ts', [
    {
        search: '    return delegate;',
        replace: '    return delegate as { findFirst: (args: Record<string, unknown>) => Promise<unknown> };'
    }
]);

// 2. Optional JWT Guard signature
fixFile('src/core/common/guards/optional-jwt-auth.guard.ts', [
    {
        search: 'handleRequest(err: unknown, user: unknown) {',
        replace: 'handleRequest<TUser = any>(err: any, user: any): TUser {'
    },
    {
       search: 'return undefined;',
       replace: 'return undefined as any;'
    }
]);

// 3. Module Database Executor unknown error message
fixFile('src/core/services/module-database-executor.service.ts', [
    {
        search: 'error.message',
        replace: 'this.getErrorMessage(error)'
    }
]);

// 4. Sanitization Pipes (all 3)
const pipes = [
    'src/core/common/pipes/sanitization.pipe.ts',
    'src/core/pipes/sanitization.pipe.ts',
    'src/core/sanitization.pipe.ts'
];
for (const pipe of pipes) {
    fixFile(pipe, [
        {
            search: 'return this.sanitizeObject(value);',
            replace: 'return this.sanitizeObject(value as Record<string, unknown>);'
        },
        {
            search: 'sanitized[key] = this.sanitizeObject(value);',
            replace: 'sanitized[key] = this.sanitizeObject(value as Record<string, unknown>);'
        }
    ]);
}

// 5. Audit Service log: any
fixFile('src/audit/audit.service.ts', [
    {
        search: 'private sanitizeAuditLogRow(log: Prisma.AuditLog | AuditLogWithUser)',
        replace: 'private sanitizeAuditLogRow(log: any)'
    }
]);

// 6. Email Services tls property
const emailServices = [
    'src/core/email.service.ts',
    'src/core/email/email.service.ts',
    'src/email/email.service.ts'
];
for (const email of emailServices) {
    fixFile(email, [
        {
            search: 'const transporterConfig = {',
            replace: 'const transporterConfig: any = {'
        }
    ]);
}

// 7. Security Throttler Guard (RequestLike to TelemetryRequestLike)
fixFile('src/common/guards/security-throttler.guard.ts', [
    {
        search: 'request as RequestLike',
        replace: 'request as any'
    }
]);

// 8. Module JSON Validator (json.name length)
fixFile('src/core/validators/module-json.validator.ts', [
    {
        search: 'if (json.name.length',
        replace: 'if ((json.name as string).length'
    },
    {
        search: 'if (json.displayName.length',
        replace: 'if ((json.displayName as string).length'
    }
]);
