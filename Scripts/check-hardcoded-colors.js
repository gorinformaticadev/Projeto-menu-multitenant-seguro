#!/usr/bin/env node
/**
 * check-hardcoded-colors.js
 * 
 * Script de governança de temas.
 * Detecta uso de cores hardcoded em componentes novos.
 * 
 * Uso:
 *   node scripts/check-hardcoded-colors.js
 *   node scripts/check-hardcoded-colors.js --fail-on-error
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'apps', 'frontend', 'src');

// Arquivos/pastas que podem ter hardcode por razão documentada
const ALLOWED_EXCEPTIONS = [
  'app/globals.css',
  'app/login/page.tsx',
  'app/esqueci-senha/page.tsx',
  'app/redefinir-senha/page.tsx',
  'components/TwoFactorLogin.tsx',
  'components/TwoFactorSetup.tsx',
  'theme/',
  'node_modules/',
  '.next/',
  // Gráficos com paleta própria – documentar aqui se adicionar
];

// Padrões proibidos
const FORBIDDEN_PATTERNS = [
  {
    name: 'Hex color',
    pattern: /#[0-9a-fA-F]{3,8}\b/g,
    severity: 'error',
  },
  {
    name: 'Tailwind bg hardcoded',
    pattern: /\bbg-(slate|gray|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
    severity: 'error',
  },
  {
    name: 'Tailwind text hardcoded',
    pattern: /\btext-(slate|gray|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
    severity: 'error',
  },
  {
    name: 'Tailwind border hardcoded',
    pattern: /\bborder-(slate|gray|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
    severity: 'error',
  },
  {
    name: 'Tailwind ring hardcoded',
    pattern: /\bring-(slate|gray|zinc|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
    severity: 'error',
  },
  {
    name: 'Inline rgb/hsl color',
    pattern: /(?:rgb|hsl)\([^)]+\)/g,
    severity: 'warn',
  },
  {
    name: 'Inline style color',
    pattern: /style=\{\{[^}]*?(?:color|background|borderColor|fill|stroke)\s*:\s*['"`][^'"`]+['"`]/g,
    severity: 'error',
  },
];

function isAllowed(relPath) {
  return ALLOWED_EXCEPTIONS.some((exception) =>
    relPath.replace(/\\/g, '/').includes(exception)
  );
}

function getAllFiles(dir, exts = ['.tsx', '.ts', '.css']) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      results.push(...getAllFiles(fullPath, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

let errorCount = 0;
let warnCount = 0;
const failOnError = process.argv.includes('--fail-on-error');

const files = getAllFiles(SRC_DIR);
for (const file of files) {
  const relPath = path.relative(SRC_DIR, file);
  if (isAllowed(relPath)) continue;

  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');

  for (const { name, pattern, severity } of FORBIDDEN_PATTERNS) {
    pattern.lastIndex = 0;
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const matches = [...line.matchAll(pattern)];
      for (const match of matches) {
        const lineNum = lineIndex + 1;
        const symbol = severity === 'error' ? '❌' : '⚠️';
        const label = severity === 'error' ? 'ERRO' : 'AVISO';
        console.log(`${symbol} [${label}] ${relPath}:${lineNum} — ${name}: "${match[0]}"`);
        if (severity === 'error') errorCount++;
        else warnCount++;
      }
    }
  }
}

console.log('');
console.log(`Resumo: ${errorCount} erro(s), ${warnCount} aviso(s)`);

if (failOnError && errorCount > 0) {
  console.log('\n❌ Pipeline bloqueado: corrija os erros acima antes de continuar.');
  process.exit(1);
} else if (errorCount > 0) {
  console.log('\n⚠️  Hardcodes encontrados. Use --fail-on-error para bloquear o pipeline.');
  process.exit(0);
} else {
  console.log('\n✅ Nenhum hardcode de cor encontrado fora das exceções autorizadas!');
  process.exit(0);
}
