// Script simples para gerar favicon.ico a partir do SVG
// Execute: node generate-favicon.js

const fs = require('fs');
const path = require('path');

// Ler o SVG
const svgPath = path.join(__dirname, 'public', 'favicon.svg');
const svgContent = fs.readFileSync(svgPath, 'utf8');

console.log('✅ Favicon SVG encontrado!');
console.log('📁 Localização:', svgPath);
console.log('');
console.log('🎨 Para gerar favicon.ico, use uma das opções:');
console.log('');
console.log('1️⃣  Online (R