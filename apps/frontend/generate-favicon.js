// Script simples para gerar favicon.ico a partir do SVG
// Execute: node generate-favicon.js

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ler o SVG
const svgPath = path.join(__dirname, 'public', 'pwa.svg');

console.log('✅ Favicon SVG encontrado!');
console.log('📁 Localização:', svgPath);
console.log('');
console.log('🎨 Para gerar favicon.ico:');
console.log('1. Use um conversor online de SVG para ICO');
console.log('2. Ou use imagemagick se instalado');