const fs = require('fs');

const FILE_PATH = 'c:\\Users\\Gilson\\Documents\\GitHub\\Projeto-menu-multitenant-seguro\\apps\\frontend\\src\\components\\operational-dashboard\\OperationalDashboard.tsx';

function refactor() {
    let content = fs.readFileSync(FILE_PATH, 'utf8');
    
    // 1. Generic Button and Bg replacements
    content = content.replace(/border-blue-500 bg-blue-600/g, 'border-primary bg-primary');
    content = content.replace(/hover:bg-blue-500 hover:text-white/g, 'hover:bg-primary/90 hover:text-primary-foreground');
    content = content.replace(/bg-blue-600/g, 'bg-primary');
    content = content.replace(/text-blue-600/g, 'text-primary');
    content = content.replace(/border-blue-500/g, 'border-primary');
    content = content.replace(/hover:border-blue-200/g, 'hover:border-primary/30');
    content = content.replace(/focus-visible:ring-blue-400/g, 'focus-visible:ring-primary/70');
    content = content.replace(/focus-visible:ring-indigo-500/g, 'focus-visible:ring-primary');
    
    // 2. Generic Slate to Semantic
    content = content.replace(/text-slate-900/g, 'text-foreground');
    content = content.replace(/text-slate-800/g, 'text-foreground/90');
    content = content.replace(/text-slate-500/g, 'text-muted-foreground');
    content = content.replace(/text-slate-400/g, 'text-muted-foreground/80');
    content = content.replace(/bg-slate-50/g, 'bg-muted/50');
    content = content.replace(/bg-slate-100/g, 'bg-muted');
    content = content.replace(/border-slate-200/g, 'border-border');
    content = content.replace(/border-slate-300/g, 'border-border');
    
    // 3. Dark mode specific generic classes
    content = content.replace(/dark:text-slate-100/g, 'dark:text-foreground');
    content = content.replace(/dark:text-slate-50/g, 'dark:text-foreground');
    content = content.replace(/dark:text-slate-400/g, 'dark:text-muted-foreground');
    content = content.replace(/dark:bg-slate-950/g, 'dark:bg-background');
    content = content.replace(/dark:border-slate-800/g, 'dark:border-border');

    fs.writeFileSync(FILE_PATH, content);
    console.log('Refactor complete for OperationalDashboard.tsx');
}

refactor();
