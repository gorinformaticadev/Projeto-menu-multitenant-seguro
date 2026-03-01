const fs = require('fs');
const path = require('path');

const roots = ['apps/backend/src', 'apps/frontend/src'];
const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.next'].includes(entry.name)) continue;
      walk(full, out);
      continue;
    }
    if (exts.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

const files = roots.flatMap((r) => walk(r));
const bad = new Map();

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const re = /(?:[^\s'"`]{0,30})(?:Ã|Â|â|ð|Å)(?:[^\s'"`]{0,30})/g;
  const matches = content.match(re) || [];
  for (const token of matches) {
    if (!bad.has(token)) bad.set(token, []);
    const list = bad.get(token);
    if (list.length < 2 && !list.includes(file)) list.push(file);
  }
}

const entries = [...bad.entries()].sort((a, b) => a[0].localeCompare(b[0]));
for (const [token, list] of entries) {
  console.log(`${token} => ${list[0]}`);
}
console.log(`Total tokens: ${entries.length}`);
