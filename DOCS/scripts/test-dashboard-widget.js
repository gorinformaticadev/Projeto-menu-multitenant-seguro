/**
 * SCRIPT DE TESTE: Widget do Dashboard
 * 
 * Verifica se o widget do módulo sistema está configurado corretamente
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testando configuração do Widget do Dashboard\n');

// 1. Verificar se o componente SistemaWidget existe
const widgetPath = path.join(__dirname, '../modules/sistema/frontend/components/SistemaWidget.tsx');
const widgetExists = fs.existsSync(widgetPath);

console.log('1️⃣ Componente SistemaWidget.tsx:');
console.log(`   ${widgetExists ? '✅' : '❌'} ${widgetPath}`);

if (!widgetExists) {
  console.log('\n❌ ERRO: Componente SistemaWidget.tsx não encontrado!');
  process.exit(1);
}

// 2. Verificar conteúdo do widget
const widgetContent = fs.readFileSync(widgetPath, 'utf-8');
const hasExport = widgetContent.includes('export function SistemaWidget');
const hasDefaultExport = widgetContent.includes('export default SistemaWidget');
const hasCard = widgetContent.includes('<Card');
const hasBadge = widgetContent.includes('<Badge');

console.log('\n2️⃣ Estrutura do componente:');
console.log(`   ${hasExport ? '✅' : '❌'} export function SistemaWidget()`);
console.log(`   ${hasDefaultExport ? '✅' : '❌'} export default SistemaWidget`);
console.log(`   ${hasCard ? '✅' : '❌'} Usa componente Card`);
console.log(`   ${hasBadge ? '✅' : '❌'} Usa componente Badge`);

// 3. Verificar ModuleRegistryWidgets
const registryWidgetsPath = path.join(__dirname, '../frontend/src/components/ModuleRegistryWidgets.tsx');
const registryWidgetsExists = fs.existsSync(registryWidgetsPath);

console.log('\n3️⃣ Componente ModuleRegistryWidgets.tsx:');
console.log(`   ${registryWidgetsExists ? '✅' : '❌'} ${registryWidgetsPath}`);

if (!registryWidgetsExists) {
  console.log('\n❌ ERRO: ModuleRegistryWidgets.tsx não encontrado!');
  process.exit(1);
}

// 4. Verificar import dinâmico
const registryContent = fs.readFileSync(registryWidgetsPath, 'utf-8');
const hasDynamicImport = registryContent.includes("import('../../../../modules/sistema/frontend/components/SistemaWidget')");
const hasWidgetComponent = registryContent.includes("SistemaWidget: SistemaWidget");
const hasGetWidgets = registryContent.includes('moduleRegistry.getDashboardWidgets()');

console.log('\n4️⃣ Configuração do import:');
console.log(`   ${hasDynamicImport ? '✅' : '❌'} Import dinâmico correto (4 níveis)`);
console.log(`   ${hasWidgetComponent ? '✅' : '❌'} Registrado em widgetComponents`);
console.log(`   ${hasGetWidgets ? '✅' : '❌'} Chama getDashboardWidgets()`);

// Verificar se não está usando caminho errado
const hasWrongPath = registryContent.includes("import('../../../../../modules/sistema");
if (hasWrongPath) {
  console.log('   ⚠️  AVISO: Encontrado import com 6 níveis (deveria ser 4)');
}

// 5. Verificar dashboard page
const dashboardPath = path.join(__dirname, '../frontend/src/app/dashboard/page.tsx');
const dashboardExists = fs.existsSync(dashboardPath);

console.log('\n5️⃣ Dashboard Page:');
console.log(`   ${dashboardExists ? '✅' : '❌'} ${dashboardPath}`);

if (dashboardExists) {
  const dashboardContent = fs.readFileSync(dashboardPath, 'utf-8');
  const hasModuleRegistryWidgets = dashboardContent.includes('<ModuleRegistryWidgets />');
  console.log(`   ${hasModuleRegistryWidgets ? '✅' : '❌'} Usa <ModuleRegistryWidgets />`);
}

// 6. Verificar module-registry.ts
const moduleRegistryPath = path.join(__dirname, '../frontend/src/lib/module-registry.ts');
const moduleRegistryExists = fs.existsSync(moduleRegistryPath);

console.log('\n6️⃣ Module Registry:');
console.log(`   ${moduleRegistryExists ? '✅' : '❌'} ${moduleRegistryPath}`);

if (moduleRegistryExists) {
  const moduleRegistryContent = fs.readFileSync(moduleRegistryPath, 'utf-8');
  const hasGetDashboardWidgets = moduleRegistryContent.includes('getDashboardWidgets()');
  const createsWidgets = moduleRegistryContent.includes("component: 'SistemaWidget'");
  
  console.log(`   ${hasGetDashboardWidgets ? '✅' : '❌'} Método getDashboardWidgets() existe`);
  console.log(`   ${createsWidgets ? '✅' : '❌'} Cria widgets com component: SistemaWidget`);
}

// Resumo
console.log('\n' + '='.repeat(60));
console.log('📊 RESUMO DA VERIFICAÇÃO');
console.log('='.repeat(60));

const allChecks = [
  widgetExists,
  hasExport,
  hasDefaultExport,
  hasCard,
  hasBadge,
  registryWidgetsExists,
  hasDynamicImport,
  hasWidgetComponent,
  hasGetWidgets,
  !hasWrongPath
];

const passedChecks = allChecks.filter(Boolean).length;
const totalChecks = allChecks.length;

console.log(`\nVerificações passadas: ${passedChecks}/${totalChecks}`);

if (passedChecks === totalChecks) {
  console.log('\n✅ TUDO CERTO! O widget está configurado corretamente.');
  console.log('\n📝 Próximos passos:');
  console.log('   1. Faça hard refresh no navegador (Ctrl+Shift+R)');
  console.log('   2. Abra o console (F12)');
  console.log('   3. Procure pelos logs do widget');
  console.log('   4. Verifique se o card roxo aparece no dashboard');
} else {
  console.log('\n⚠️  ATENÇÃO! Algumas verificações falharam.');
  console.log('   Revise os itens marcados com ❌ acima.');
}

console.log('\n' + '='.repeat(60));
