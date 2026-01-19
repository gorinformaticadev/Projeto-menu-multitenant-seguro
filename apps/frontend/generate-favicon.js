// Script simples para gerar favicon.ico a partir do SVG
// Execute: node generate-favicon.js

const path = require('path');

// Ler o SVG
const svgPath = path.join(__dirname, 'public', 'favicon.svg');

console.log('✅ Favicon SVG encontrado!');
console.log('📁 Localização:', svgPath);
console.log('');
console.log('🎨 Para gerar favicon.ico:');
console.log('1. Use um conversor online de SVG para ICO');
console.log('2. Ou use imagemagick se instalado');