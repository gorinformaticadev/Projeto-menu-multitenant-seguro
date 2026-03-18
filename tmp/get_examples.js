const fs = require('fs');
const data = JSON.parse(fs.readFileSync('c:\\Users\\Gilson\\Documents\\GitHub\\Projeto-menu-multitenant-seguro\\tmp\\audit_results.json', 'utf8'));

const filtered = data.filter(item => item.file.includes('OperationalDashboard.tsx')).slice(0, 5);

console.log(JSON.stringify(filtered, null, 2));
