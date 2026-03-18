const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'apps', 'frontend', 'src');

// Arquivos excluídos da migração automática (têm hardcodes intencionais ou são exceções)
const SKIP = [
  'app/globals.css',
  'app/login/page.tsx',
  'app/esqueci-senha/page.tsx',
  'app/redefinir-senha/page.tsx',
  'components/TwoFactorLogin.tsx',
  'components/TwoFactorSetup.tsx',
  'theme/',
  // Gráficos Recharts com paleta própria - hardcodes intencionais para cores de chart
  'OperationalDashboard.tsx',
  'dashboard.utils.ts',
  // Área de impressão - template A4 tem estilo fixo por design
  'PrintTemplateA4.tsx',
];

// Mapeamentos semânticos ordenados por especificidade (mais específico primeiro)
const MAPPINGS = [
  // === BG ===
  // Cores de status (preservam semântica específica)
  [/\bbg-emerald-50\b/g,   'bg-skin-success/10'],
  [/\bbg-emerald-950\b/g,  'bg-skin-success/20'],
  [/\bbg-amber-50\b/g,     'bg-skin-warning/10'],
  [/\bbg-amber-950\b/g,    'bg-skin-warning/20'],
  [/\bbg-rose-50\b/g,      'bg-skin-danger/10'],
  [/\bbg-rose-950\b/g,     'bg-skin-danger/20'],
  [/\bbg-red-50\b/g,       'bg-skin-danger/10'],
  [/\bbg-red-950\b/g,      'bg-skin-danger/20'],
  [/\bbg-green-50\b/g,     'bg-skin-success/10'],
  [/\bbg-green-950\b/g,    'bg-skin-success/20'],
  [/\bbg-green-100\b/g,    'bg-skin-success/15'],
  [/\bbg-yellow-50\b/g,    'bg-skin-warning/10'],
  [/\bbg-yellow-950\b/g,   'bg-skin-warning/20'],
  [/\bbg-orange-50\b/g,    'bg-skin-warning/10'],
  [/\bbg-orange-950\b/g,   'bg-skin-warning/20'],
  [/\bbg-blue-50\b/g,      'bg-skin-info/10'],
  [/\bbg-blue-950\b/g,     'bg-skin-info/20'],
  [/\bbg-blue-100\b/g,     'bg-skin-info/15'],
  [/\bbg-blue-200\b/g,     'bg-skin-info/20'],
  [/\bbg-blue-900\b/g,     'bg-skin-info/30'],
  [/\bbg-blue-600\b/g,     'bg-skin-primary'],
  [/\bbg-blue-500\b/g,     'bg-skin-primary'],
  [/\bbg-blue-700\b/g,     'bg-skin-primary-hover'],
  [/\bbg-red-600\b/g,      'bg-skin-danger'],
  [/\bbg-red-700\b/g,      'bg-skin-danger'],

  // Neutros (superfícies)
  [/\bbg-white\b/g,        'bg-skin-surface'],
  [/\bbg-slate-50\b/g,     'bg-skin-background-elevated'],
  [/\bbg-slate-100\b/g,    'bg-skin-surface-hover'],
  [/\bbg-slate-200\b/g,    'bg-skin-surface-hover'],
  [/\bbg-slate-900\b/g,    'bg-skin-surface'],
  [/\bbg-slate-950\b/g,    'bg-skin-surface'],
  [/\bbg-gray-100\b/g,     'bg-skin-surface-hover'],
  [/\bbg-gray-200\b/g,     'bg-skin-surface-hover'],
  [/\bbg-gray-400\b/g,     'bg-skin-surface-hover'],

  // === TEXT ===
  // Status colors in text
  [/\btext-emerald-900\b/g, 'text-skin-success'],
  [/\btext-emerald-100\b/g, 'text-skin-success'],
  [/\btext-amber-900\b/g,   'text-skin-warning'],
  [/\btext-amber-100\b/g,   'text-skin-warning'],
  [/\btext-rose-900\b/g,    'text-skin-danger'],
  [/\btext-rose-100\b/g,    'text-skin-danger'],
  [/\btext-red-700\b/g,     'text-skin-danger'],
  [/\btext-red-800\b/g,     'text-skin-danger'],
  [/\btext-red-200\b/g,     'text-skin-danger'],
  [/\btext-blue-400\b/g,    'text-skin-info'],
  [/\btext-blue-700\b/g,    'text-skin-primary'],
  [/\btext-blue-800\b/g,    'text-skin-primary'],
  [/\btext-blue-200\b/g,    'text-skin-primary'],
  [/\btext-blue-300\b/g,    'text-skin-primary'],
  [/\btext-blue-100\b/g,    'text-skin-primary'],

  // Neutros
  [/\btext-white\b/g,       'text-skin-text-inverse'],
  [/\btext-slate-50\b/g,    'text-skin-text'],
  [/\btext-slate-100\b/g,   'text-skin-text'],
  [/\btext-slate-200\b/g,   'text-skin-text-muted'],
  [/\btext-slate-300\b/g,   'text-skin-text-muted'],
  [/\btext-slate-400\b/g,   'text-skin-text-muted'],
  [/\btext-slate-500\b/g,   'text-skin-text-muted'],
  [/\btext-slate-600\b/g,   'text-skin-text-muted'],
  [/\btext-slate-700\b/g,   'text-skin-text'],
  [/\btext-slate-800\b/g,   'text-skin-text'],
  [/\btext-slate-900\b/g,   'text-skin-text'],
  [/\btext-slate-950\b/g,   'text-skin-text'],
  [/\btext-gray-400\b/g,    'text-skin-text-muted'],
  [/\btext-gray-700\b/g,    'text-skin-text'],

  // === BORDER ===
  [/\bborder-slate-200\b/g,  'border-skin-border'],
  [/\bborder-slate-300\b/g,  'border-skin-border-strong'],
  [/\bborder-slate-400\b/g,  'border-skin-border-strong'],
  [/\bborder-slate-600\b/g,  'border-skin-border-strong'],
  [/\bborder-slate-700\b/g,  'border-skin-border-strong'],
  [/\bborder-slate-800\b/g,  'border-skin-border'],
  [/\bborder-blue-200\b/g,   'border-skin-info/30'],
  [/\bborder-blue-300\b/g,   'border-skin-info/50'],
  [/\bborder-blue-400\b/g,   'border-skin-primary/50'],
  [/\bborder-blue-800\b/g,   'border-skin-primary/30'],
  [/\bborder-blue-900\b/g,   'border-skin-primary/20'],
  [/\bborder-emerald-200\b/g, 'border-skin-success/30'],
  [/\bborder-emerald-900\b/g, 'border-skin-success/30'],
  [/\bborder-amber-200\b/g,   'border-skin-warning/30'],
  [/\bborder-amber-300\b/g,   'border-skin-warning/50'],
  [/\bborder-amber-800\b/g,   'border-skin-warning/30'],
  [/\bborder-sky-200\b/g,     'border-skin-info/30'],
  [/\bborder-sky-500\b/g,     'border-skin-info'],
  [/\bborder-rose-500\b/g,    'border-skin-danger'],
  [/\bborder-red-200\b/g,     'border-skin-danger/30'],
  [/\bborder-red-900\b/g,     'border-skin-danger/30'],
  [/\bborder-cyan-200\b/g,    'border-skin-info/30'],
  [/\bborder-cyan-400\b/g,    'border-skin-info/50'],

  // Remove dark: duplicatas que ficam vazias após migração do token
  [/\s+dark:bg-slate-\d{2,3}\b/g, ''],
  [/\s+dark:text-slate-\d{2,3}\b/g, ''],
  [/\s+dark:border-slate-\d{2,3}\b/g, ''],
  [/\s+dark:bg-background\/\d+\b/g, ''],

  // Cores extras que não foram cobertas na primeira passagem
  [/\bbg-indigo-600\b/g, 'bg-skin-primary'],
  [/\bbg-indigo-700\b/g, 'bg-skin-primary-hover'],
  [/\bbg-indigo-50\b/g,  'bg-skin-primary/10'],
  [/\bbg-indigo-950\b/g, 'bg-skin-primary/20'],
  [/\bbg-violet-50\b/g,  'bg-skin-secondary/10'],
  [/\bbg-violet-950\b/g, 'bg-skin-secondary/20'],
  [/\bbg-sky-50\b/g,     'bg-skin-info/10'],
  [/\bbg-sky-950\b/g,    'bg-skin-info/20'],
  [/\bbg-teal-50\b/g,    'bg-skin-info/10'],
  [/\bbg-cyan-50\b/g,    'bg-skin-info/10'],
  [/\bbg-purple-50\b/g,  'bg-skin-secondary/10'],
  [/\bbg-muted\/\d+\b/g, 'bg-skin-surface-hover'],

  [/\btext-indigo-\d+\b/g, 'text-skin-primary'],
  [/\btext-violet-\d+\b/g, 'text-skin-secondary'],
  [/\btext-sky-\d+\b/g,    'text-skin-info'],
  [/\btext-teal-\d+\b/g,   'text-skin-info'],
  [/\btext-cyan-\d+\b/g,   'text-skin-info'],
  [/\btext-purple-\d+\b/g, 'text-skin-secondary'],

  [/\bborder-indigo-\d+\b/g, 'border-skin-primary/30'],
  [/\bborder-violet-\d+\b/g, 'border-skin-secondary/30'],
  [/\bborder-sky-\d+\b/g,    'border-skin-info/30'],
  [/\bborder-teal-\d+\b/g,   'border-skin-info/30'],
  [/\bborder-cyan-\d+\b/g,   'border-skin-info/30'],
  [/\bborder-gray-\d+\b/g,   'border-skin-border'],
  [/\bborder-zinc-\d+\b/g,   'border-skin-border'],
];

function isSkipped(relPath) {
  return SKIP.some((s) => relPath.replace(/\\/g, '/').includes(s));
}

function getAllTsxFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.next'].includes(entry.name)) {
        results.push(...getAllTsxFiles(full));
      }
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

let totalMigrated = 0;
let totalFiles = 0;

for (const file of getAllTsxFiles(SRC)) {
  const rel = path.relative(SRC, file);
  if (isSkipped(rel)) continue;

  let content = fs.readFileSync(file, 'utf-8');
  let original = content;

  for (const [from, to] of MAPPINGS) {
    content = content.replace(from, to);
  }

  // Limpar espaços extras criados por remoções
  content = content.replace(/\s{2,}/g, ' ');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf-8');
    console.log(`✅ Migrado: ${rel}`);
    totalFiles++;
    totalMigrated++;
  }
}

console.log(`\n✔ ${totalFiles} arquivo(s) migrado(s).`);
