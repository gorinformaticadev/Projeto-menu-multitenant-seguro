const fs = require('fs');

const INPUT_PATH = 'c:\\Users\\Gilson\\Documents\\GitHub\\Projeto-menu-multitenant-seguro\\tmp\\audit_results.json';
const OUTPUT_PATH = 'c:\\Users\\Gilson\\Documents\\GitHub\\Projeto-menu-multitenant-seguro\\tmp\\audit_summary.json';

function summarize() {
    if (!fs.existsSync(INPUT_PATH)) {
        console.error('Audit results file not found.');
        return;
    }
    
    const data = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
    
    let hexCount = 0;
    let twCount = 0;
    let inlineCount = 0;
    
    const fileIssueCounts = {};
    const issuesByType = { HEX: 0, TAILWIND_HARDCODE: 0, INLINE_STYLE_COLOR: 0 };
    
    data.forEach(item => {
        fileIssueCounts[item.file] = (fileIssueCounts[item.file] || 0) + item.matches.length;
        item.matches.forEach(match => {
            if (issuesByType[match.type] !== undefined) {
                issuesByType[match.type]++;
            }
        });
    });
    
    const topFiles = Object.entries(fileIssueCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([file, count]) => ({ file, count }));
        
    const summary = {
        totalIssues: data.reduce((acc, item) => acc + item.matches.length, 0),
        issuesByType,
        topFiles
    };
    
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(summary, null, 2));
    console.log('Summary created:', summary);
}

summarize();
