const fs = require('fs');
const FILE_PATH = 'c:\\Users\\Gilson\\Documents\\GitHub\\Projeto-menu-multitenant-seguro\\apps\\frontend\\src\\contexts\\AuthContext.tsx';

function updateAuthContext() {
    let content = fs.readFileSync(FILE_PATH, 'utf8');
    
    if (content.includes('preferences?: {')) {
        console.log('User preferences already update in AuthContext.');
        return;
    }

    const placeholder = `  twoFactorEnabled?: boolean;\n}`;
    const replacement = `  twoFactorEnabled?: boolean;\n  preferences?: {\n    theme?: string;\n  } | null;\n}`;

    if (content.includes(placeholder)) {
        content = content.replace(placeholder, replacement);
    } else {
        // Fallback for Windows \r\n
        const winPlaceholder = `  twoFactorEnabled?: boolean;\r\n}`;
        const winReplacement = `  twoFactorEnabled?: boolean;\r\n  preferences?: {\r\n    theme?: string;\r\n  } | null;\r\n}`;
        
        if (content.includes(winPlaceholder)) {
            content = content.replace(winPlaceholder, winReplacement);
        } else {
            console.log('Regex fallback.');
            content = content.replace(/twoFactorEnabled\s*\?:\s*boolean\s*;\s*}/, `twoFactorEnabled?: boolean;\n  preferences?: {\n    theme?: string;\n  } | null;\n}`);
        }
    }

    fs.writeFileSync(FILE_PATH, content);
    console.log('AuthContext updated successfully.');
}

updateAuthContext();
