const fs = require('fs');
const path = require('path');

const roots = [
  path.resolve('apps/backend/src'),
  path.resolve('apps/backend/prisma'),
  path.resolve('apps/frontend/src'),
];

const allowedExt = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'dist' || entry.name === 'node_modules' || entry.name === '.next') continue;
      walk(full, out);
      continue;
    }
    if (!allowedExt.has(path.extname(entry.name))) continue;
    out.push(full);
  }
  return out;
}

const chars = [
  'á','à','â','ã','ä','é','ê','è','í','ì','ó','ò','ô','õ','ö','ú','ù','ü','ç','ñ',
  'Á','À','Â','Ã','Ä','É','Ê','È','Í','Ì','Ó','Ò','Ô','Õ','Ö','Ú','Ù','Ü','Ç','Ñ',
  'º','ª','°','’','‘','“','”','–','—','…','•','✅','❌','⚡','🔍','🛡️','🎉','🚀'
];

const pairs = new Map();
for (const ch of chars) {
  const bad = Buffer.from(ch, 'utf8').toString('latin1');
  pairs.set(bad, ch);
}

function fixMojibake(content) {
  let out = content;
  for (let pass = 0; pass < 4; pass++) {
    const before = out;
    for (const [bad, good] of pairs) {
      if (out.includes(bad)) out = out.split(bad).join(good);
    }

    // casos comuns de lixo isolado
    out = out
      .replace(/\u00A0/g, ' ')
      .replace(/Â(?=[\s.,;:!?)}\]"'`]|$)/g, '')
      .replace(/\uFFFD/g, '');

    if (out === before) break;
  }
  return out;
}

const files = roots.flatMap((r) => walk(r));
const changed = [];

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  if (!/[ÃÂâð\uFFFD]/.test(raw)) continue;

  const fixed = fixMojibake(raw);
  if (fixed !== raw) {
    fs.writeFileSync(file, fixed, 'utf8');
    changed.push(path.relative(process.cwd(), file));
  }
}

console.log(`Changed files: ${changed.length}`);
for (const f of changed.sort()) console.log(f);
