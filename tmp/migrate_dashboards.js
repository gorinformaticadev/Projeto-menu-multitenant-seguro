const fs = require('fs');
const path = require('path');

const filesToMigrate = [
  'apps/frontend/src/components/dashboard/DashboardHome.tsx',
  'apps/frontend/src/components/operational-dashboard/OperationalDashboard.tsx',
];

const basePath = 'c:\\Users\\Gilson\\Documents\\GitHub\\Projeto-menu-multitenant-seguro';

const mappings = [
  // Backgrounds
  { from: /bg-white(?!\w)/g, to: 'bg-skin-surface' },
  { from: /bg-slate-50(?!\w)/g, to: 'bg-skin-background-elevated' },
  { from: /bg-slate-100(?!\w)/g, to: 'bg-skin-surface-hover' },
  { from: /bg-slate-900(?!\w)/g, to: 'bg-skin-surface' }, // Geralmente se torna surface no dark
  { from: /bg-slate-950(?!\w)/g, to: 'bg-skin-surface' },
  
  // Texts
  { from: /text-slate-900(?!\w)/g, to: 'text-skin-text' },
  { from: /text-slate-800(?!\w)/g, to: 'text-skin-text' },
  { from: /text-slate-700(?!\w)/g, to: 'text-skin-text' },
  { from: /text-slate-600(?!\w)/g, to: 'text-skin-text-muted' },
  { from: /text-slate-500(?!\w)/g, to: 'text-skin-text-muted' },
  { from: /text-slate-400(?!\w)/g, to: 'text-skin-text-muted' },
  { from: /text-slate-300(?!\w)/g, to: 'text-skin-text-muted' },
  { from: /text-slate-200(?!\w)/g, to: 'text-skin-text-muted' },
  { from: /text-slate-100(?!\w)/g, to: 'text-skin-text' }, // Inverso
  
  // Borders
  { from: /border-slate-200(?!\w)/g, to: 'border-skin-border' },
  { from: /border-slate-300(?!\w)/g, to: 'border-skin-border-strong' },
  { from: /border-slate-800(?!\w)/g, to: 'border-skin-border' },
  { from: /border-slate-700(?!\w)/g, to: 'border-skin-border-strong' },
  
  // Tones (Emerald/Amber/Rose)
  { from: /bg-emerald-50(?!\w)/g, to: 'bg-skin-success/10' },
  { from: /bg-amber-50(?!\w)/g, to: 'bg-skin-warning/10' },
  { from: /bg-rose-50(?!\w)/g, to: 'bg-skin-danger/10' },
  { from: /text-emerald-900(?!\w)/g, to: 'text-skin-success' },
  { from: /text-amber-900(?!\w)/g, to: 'text-skin-warning' },
  { from: /text-rose-900(?!\w)/g, to: 'text-skin-danger' },
  
  // Remove dark: classes that override to redundant things when using skin tokens
  { from: /dark:bg-slate-950(?!\w)/g, to: '' },
  { from: /dark:bg-slate-900(?!\w)/g, to: '' },
  { from: /dark:text-slate-100(?!\w)/g, to: '' },
  { from: /dark:text-slate-200(?!\w)/g, to: '' },
  { from: /dark:border-slate-800(?!\w)/g, to: '' },
];

function migrateFile(filePath) {
  const fullPath = path.join(basePath, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf-8');
  let original = content;

  mappings.forEach(({ from, to }) => {
    content = content.replace(from, to);
  });

  // Limpar espaços duplos criados por remoção de dark: classes
  content = content.replace(/\s{2,}/g, ' ');

  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`Migrated: ${filePath}`);
  } else {
    console.log(`No changes needed for: ${filePath}`);
  }
}

filesToMigrate.forEach(migrateFile);
