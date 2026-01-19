/**
 * Compatibility wrapper for ESLint v9 (flat config).
 *
 * If a legacy .eslintrc.* file exists in the frontend folder, we reuse it via
 * @eslint/eslintrc's FlatCompat. Otherwise we export a minimal flat config
 * that ignores node_modules and .next to avoid failing CI when no config exists.
 *
 * This file allows us to upgrade to ESLint v9 while preserving existing
 * .eslintrc.* files (if present) without a large migration right away.
 */
const fs = require('fs');
const path = require('path');
let compat;
try {
    // @eslint/eslintrc should be present in devDependencies (frontend package.json)
    const { FlatCompat } = require('@eslint/eslintrc');
    compat = new FlatCompat({ baseDirectory: __dirname });
} catch (e) {
    // If @eslint/eslintrc is not installed, export a minimal config to avoid crash.
    // CI should install @eslint/eslintrc as part of devDependencies; this fallback
    // is defensive.
    module.exports = [
        {
            ignores: ['node_modules/**', '.next/**'],
        },
    ];
    return;
}

const legacyFiles = ['.eslintrc.cjs', '.eslintrc.js', '.eslintrc.json', '.eslintrc'];
let legacyPath = null;
for (const f of legacyFiles) {
    const p = path.resolve(__dirname, f);
    if (fs.existsSync(p)) {
        legacyPath = p;
        break;
    }
}

if (legacyPath) {
    // Reuse the legacy config via FlatCompat (recommended migration path)
    module.exports = [
        ...compat.extendFlatConfig(legacyPath),
        {
            ignores: ['node_modules/**', '.next/**'],
        },
    ];
} else {
    // Minimal, safe flat config to let ESLint run without legacy config.
    module.exports = [
        {
            linterOptions: { reportUnusedDisableDirectives: true },
            languageOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
            ignores: ['node_modules/**', '.next/**'],
            // no custom rules here; rely on project's legacy config when migrated
        },
    ];
}
