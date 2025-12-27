const fs = require('fs');
const path = require('path');
// Attempt to require adm-zip from backend node_modules
// If not found there, we might need another strategy, but it should be there.
let AdmZip;
try {
    AdmZip = require('./apps/backend/node_modules/adm-zip');
} catch (e) {
    console.error('Could not load adm-zip from apps/backend/node_modules.');
    console.error(e.message);
    process.exit(1);
}

const zip = new AdmZip();
const sourceDir = path.resolve('apps/backend/src/modules/sistema');
const outputFile = path.resolve('sistema.zip');

if (!fs.existsSync(sourceDir)) {
    console.error(`Source directory not found: ${sourceDir}`);
    process.exit(1);
}

console.log(`Packaging module from ${sourceDir}...`);

const items = fs.readdirSync(sourceDir);
for (const item of items) {
    // Ignore common non-source items
    if (['node_modules', '.git', 'dist', '.DS_Store'].includes(item)) continue;

    const fullPath = path.join(sourceDir, item);
    const stats = fs.statSync(fullPath);

    if (item === 'frontend') {
        // Frontend folder: preserve structure under 'frontend/' in zip
        console.log(`Adding Folder: frontend`);
        zip.addLocalFolder(fullPath, 'frontend');
    } else if (item === 'module.json') {
        // module.json at root
        console.log(`Adding File: module.json`);
        zip.addLocalFile(fullPath);
    } else {
        // All other files/folders are Backend
        // They go into 'backend/' folder in zip
        if (stats.isDirectory()) {
            console.log(`Adding Backend Folder: ${item}`);
            zip.addLocalFolder(fullPath, `backend/${item}`);
        } else {
            console.log(`Adding Backend File: ${item}`);
            zip.addLocalFile(fullPath, 'backend');
        }
    }
}

zip.writeZip(outputFile);
console.log(`Successfully created ${outputFile}`);
