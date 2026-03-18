const fs = require('fs');
const FILE_PATH = 'c:\\Users\\Gilson\\Documents\\GitHub\\Projeto-menu-multitenant-seguro\\apps\\frontend\\src\\components\\ThemeToggle.tsx';

function updateThemeToggle() {
    let content = fs.readFileSync(FILE_PATH, 'utf8');
    
    const newContent = `    return (
        <div className="px-2 py-2">
            <div className="mb-2 text-xs font-semibold text-muted-foreground">Modo</div>
            <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg border border-border">
                <Button
                    variant="ghost"
                    size="sm"
                    className={\`flex-1 h-7 px-2 \${theme === 'light' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}\`}
                    onClick={() => updateTheme('light')}
                    title="Claro"
                >
                    <Sun className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className={\`flex-1 h-7 px-2 \${theme === 'dark' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}\`}
                    onClick={() => updateTheme('dark')}
                    title="Escuro"
                >
                    <Moon className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className={\`flex-1 h-7 px-2 \${theme === 'system' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}\`}
                    onClick={() => updateTheme('system')}
                    title="Sistema"
                >
                    <Monitor className="h-4 w-4" />
                </Button>
            </div>

            <div className="mt-3 mb-2 text-xs font-semibold text-muted-foreground">Cores do Sistema</div>
            <div className="grid grid-cols-4 gap-2">
                <button
                    className={\`flex items-center justify-center h-8 rounded-full border \${theme === 'light' || theme === 'dark' ? 'border-primary ring-2 ring-offset-1 ring-primary' : 'border-border'}\`}
                    onClick={() => updateTheme('light')}
                    title="Padrão"
                    style={{ background: '#2563EB' }}
                >
                    { (theme === 'light' || theme === 'dark') && <div className="w-2 h-2 rounded-full bg-white"></div> }
                </button>
                <button
                    className={\`flex items-center justify-center h-8 rounded-full border \${theme === 'theme-blue' ? 'border-primary ring-2 ring-offset-1 ring-primary' : 'border-border'}\`}
                    onClick={() => updateTheme('theme-blue')}
                    style={{ background: '#1d4ed8' }}
                    title="Azul Safira"
                >
                    { theme === 'theme-blue' && <div className="w-2 h-2 rounded-full bg-white"></div> }
                </button>
                <button
                    className={\`flex items-center justify-center h-8 rounded-full border \${theme === 'theme-emerald' ? 'border-primary ring-2 ring-offset-1 ring-primary' : 'border-border'}\`}
                    onClick={() => updateTheme('theme-emerald')}
                    style={{ background: '#059669' }}
                    title="Esmeralda"
                >
                    { theme === 'theme-emerald' && <div className="w-2 h-2 rounded-full bg-white"></div> }
                </button>
                <button
                    className={\`flex items-center justify-center h-8 rounded-full border \${theme === 'theme-violet' ? 'border-primary ring-2 ring-offset-1 ring-primary' : 'border-border'}\`}
                    onClick={() => updateTheme('theme-violet')}
                    style={{ background: '#8b5cf6' }}
                    title="Violeta"
                >
                    { theme === 'theme-violet' && <div className="w-2 h-2 rounded-full bg-white"></div> }
                </button>
            </div>
        </div>
    );
`;

    const regex = /return \(\s*<div className="px-2 py-1">[\s\S]*?<\/div>[\s\S]*?\);/m;

    if (content.match(regex)) {
        content = content.replace(regex, newContent);
        fs.writeFileSync(FILE_PATH, content);
        console.log('ThemeToggle updated successfully with color choices');
    } else {
        console.log('Regex did not match exactly for ThemeToggle.tsx return block');
    }
}

updateThemeToggle();
