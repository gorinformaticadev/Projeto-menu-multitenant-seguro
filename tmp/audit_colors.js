const fs = require('fs');
const path = require('path');

const SEARCH_DIR = 'c:\\Users\\Gilson\\Documents\\GitHub\\Projeto-menu-multitenant-seguro\\apps\\frontend\\src';

// Regex for hex codes they shouldn't use directly
const hexRegex = /#[0-9a-fA-F]{3,6}/g;

// List of Tailwind color names that are specific, not semantic tokens
const specificTailwindColors = [
    'slate', 'zinc', 'neutral', 'stone', 'gray', 'red', 'orange', 'amber', 'yellow', 
    'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 
    'purple', 'fuchsia', 'pink', 'rose'
];

// Tailwind classes like bg-slate-500, text-red-600
const tailwindRegexString = `(?:bg|text|border|ring|stroke|fill)-(?:${specificTailwindColors.join('|')})-(?:[1-9]00|50)`;
const tailwindRegex = new RegExp(tailwindRegexString, 'g');

// Inline style patterns
const inlineStyleRegex = /style=\{\{[^}]*(?:color|background|backgroundColor|borderColor)\s*:\s*['"](?:#[0-9a-fA-F]{3,6}|[^'"]+)['"][^}]*\}\}/g;

function getFilesRecursively(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            getFilesRecursively(filePath, fileList);
        } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.css')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

function scanFiles() {
    console.log('Scanning files recursively...');
    const files = getFilesRecursively(SEARCH_DIR);
    console.log(`Found ${files.length} files to scan.`);
    
    const auditResults = [];
    
    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            let matches = [];
            
            // 1. Hex codes (ignore if they are in CSS variable definitions)
            if (!file.endsWith('globals.css')) {
                const hexMatches = line.match(hexRegex);
                if (hexMatches) {
                    hexMatches.forEach(m => {
                        matches.push({ type: 'HEX', match: m });
                    });
                }
            }
            
            // 2. Tailwind specific colors
            const twMatches = line.match(tailwindRegex);
            if (twMatches) {
                twMatches.forEach(m => {
                    matches.push({ type: 'TAILWIND_HARDCODE', match: m });
                });
            }
            
            // 3. Inline style colors
            const styleMatches = line.match(inlineStyleRegex);
            if (styleMatches) {
                styleMatches.forEach(m => {
                    matches.push({ type: 'INLINE_STYLE_COLOR', match: m });
                });
            }
            
            if (matches.length > 0) {
                auditResults.push({
                    file: path.relative(SEARCH_DIR, file),
                    line: index + 1,
                    content: line.trim(),
                    matches
                });
            }
        });
    }
    
    const outputPath = 'c:\\Users\\Gilson\\Documents\\GitHub\\Projeto-menu-multitenant-seguro\\tmp\\audit_results.json';
    fs.writeFileSync(outputPath, JSON.stringify(auditResults, null, 2));
    console.log(`Audit complete. Found ${auditResults.length} issues saved to ${outputPath}`);
}

scanFiles();
