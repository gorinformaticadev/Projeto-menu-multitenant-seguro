const fs = require('fs');
const FILE_PATH = 'c:\\Users\\Gilson\\Documents\\GitHub\\Projeto-menu-multitenant-seguro\\apps\\frontend\\src\\app\\globals.css';

function appendThemes() {
    let content = fs.readFileSync(FILE_PATH, 'utf8');
    
    const themeCSS = `
  /* Temas de Cor (Accent) */
  .theme-blue {
    --primary: 221.2 83.2% 53.3%;
    --primary-hover: 221.2 75.2% 45.3%;
  }

  .theme-emerald {
    --primary: 142.1 76.2% 36.3%;
    --primary-hover: 142.1 70.2% 30.3%;
  }

  .theme-violet {
    --primary: 262.1 83.3% 57.8%;
    --primary-hover: 262.1 75.3% 50.8%;
  }
`;

    if (content.includes('theme-blue')) {
        console.log('Themes already appended.');
        return;
    }

    // Insert right before the closing brace of the first @layer base { } block,
    // Or just append it right before the second @layer base {
    
    if (content.includes('}\r\n}\r\n\r\n@layer base {')) {
        content = content.replace('}\r\n}\r\n\r\n@layer base {', '}\r\n' + themeCSS + '}\r\n\r\n@layer base {');
    } else if (content.includes('}\n}\n\n@layer base {')) {
        content = content.replace('}\n}\n\n@layer base {', '}\n' + themeCSS + '}\n\n@layer base {');
    } else {
        console.log('Fallback: replacing s s s s s .');
        content = content.replace(/}\s*}\s*@layer base {/m, '}\r\n' + themeCSS + '}\r\n\r\n@layer base {');
    }

    fs.writeFileSync(FILE_PATH, content);
    console.log('Themes appended successfully to globals.css');
}

appendThemes();
