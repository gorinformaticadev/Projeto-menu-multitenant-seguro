const fs = require('fs');
const FILE_PATH = 'c:\\Users\\Gilson\\Documents\\GitHub\\Projeto-menu-multitenant-seguro\\apps\\frontend\\src\\app\\layout.tsx';

function updateLayout() {
    let content = fs.readFileSync(FILE_PATH, 'utf8');
    
    if (content.includes("themes={['light'")) {
        console.log('Themes already present in layout.tsx');
        return;
    }

    const placeholder = `<ThemeProvider
                      attribute="class"
                      defaultTheme="light"
                      enableSystem
                      disableTransitionOnChange
                    >`;
                    
    const replacement = `<ThemeProvider
                      attribute="class"
                      defaultTheme="light"
                      enableSystem
                      disableTransitionOnChange
                      themes={['light', 'dark', 'system', 'theme-blue', 'theme-emerald', 'theme-violet']}
                    >`;

    if (content.includes(placeholder)) {
        content = content.replace(placeholder, replacement);
    } else {
        // Fallback using Regex
        content = content.replace(/<ThemeProvider\s+attribute="class"\s+defaultTheme="light"\s+enableSystem\s+disableTransitionOnChange\s*>/m, replacement);
    }

    fs.writeFileSync(FILE_PATH, content);
    console.log('Layout updated with themes successfully.');
}

updateLayout();
