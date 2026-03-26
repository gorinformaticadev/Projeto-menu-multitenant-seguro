const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const r = spawnSync(
  'node',
  ['node_modules/vitest/vitest.mjs', 'run', 'src/app/configuracoes/seguranca/page.test.tsx', '--no-color'],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 10,
  }
);

const out = (r.stdout || '') + (r.stderr || '');
const outFile = path.resolve(__dirname, 'vitest-page-test.log');
fs.writeFileSync(outFile, out, 'utf8');

// Print last section
const lines = out.split('\n');
const failIdx = lines.findLastIndex(l => l.includes('FAIL') || l.includes('Failed Tests'));
console.log('=== LAST 80 LINES ===');
console.log(lines.slice(Math.max(0, lines.length - 80)).join('\n'));
console.log('=== From FAIL idx ===');
if (failIdx >= 0) {
  console.log(lines.slice(failIdx, failIdx + 100).join('\n'));
}
