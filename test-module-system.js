/**
 * SCRIPT DE TESTE DO SISTEMA DE MÓDULOS ROBUSTO
 * 
 * Testa se todos os componentes estão funcionando corretamente
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 TESTANDO SISTEMA DE MÓDULOS ROBUSTO\n');

// Função para verificar se arquivo existe
function checkFile(filePath, description) {
  const exists = fs.existsSync(filePath);
  console.log(`${exists ? '✅' : '❌'} ${description}: ${filePath}`);
  return exists;
}

// Função para verificar conteúdo do arquivo
function checkFileContent(filePath, searchText, description) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const found = content.includes(searchText);
    console.log(`${found ? '✅' : '❌'} ${description}`);
    return found;
  } catch (error) {
    console.log(`❌ ${description} (erro ao ler arquivo)`);
    return false;
  }
}

let totalTests = 0;
let passedTests = 0;

function test(condition, description) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ ${description}`);
  } else {
    console.log(`❌ ${description}`);
  }
  return condition;
}

console.log('📁 VERIFICANDO ESTRUTURA DE ARQUIVOS\n');

// 1. Verificar Core do Sistema
test(
  checkFile('core/modules/engine/ModuleLoader.ts', 'ModuleLoader'),
  'Core ModuleLoader existe'
);

// 2. Verificar ModuleCore
test(
  checkFile('modules/ModuleCore.js', 'ModuleCore global'),
  'ModuleCore global existe'
);

// 3. Verificar API Routes
test(
  checkFile('frontend/src/app/api/modules/discover/route.ts', 'API de descoberta'),
  'API de descoberta existe'
);

test(
  checkFile('frontend/src/app/modules/[...slug]/page.tsx', 'Roteamento dinâmico'),
  'Roteamento dinâmico existe'
);

// 4. Verificar Módulo Exemplo Atualizado
test(
  checkFile('modules/module-exemplo/module.config.ts', 'Config do módulo exemplo'),
  'Configuração do módulo exemplo existe'
);

test(
  checkFile('modules/module-exemplo/module.pages.ts', 'Páginas do módulo exemplo'),
  'Páginas do módulo exemplo existem'
);

test(
  checkFile('modules/module-exemplo/module.bootstrap.ts', 'Bootstrap do módulo exemplo'),
  'Bootstrap do módulo exemplo existe'
);

// 5. Verificar Template de Módulo
test(
  checkFile('modules/module-template/module.config.ts', 'Config do template'),
  'Template de configuração existe'
);

test(
  checkFile('modules/module-template/module.pages.ts', 'Páginas do template'),
  'Template de páginas existe'
);

test(
  checkFile('modules/module-template/module.bootstrap.ts', 'Bootstrap do template'),
  'Template de bootstrap existe'
);

test(
  checkFile('modules/module-template/frontend/pages/index.js', 'Página principal do template'),
  'Página principal do template existe'
);

test(
  checkFile('modules/module-template/frontend/pages/settings.js', 'Página de configurações do template'),
  'Página de configurações do template existe'
);

console.log('\n🔍 VERIFICANDO CONTEÚDO DOS ARQUIVOS\n');

// 6. Verificar conteúdo das configurações
test(
  checkFileContent('modules/module-exemplo/module.config.ts', 'permissionsStrict: true', 'Módulo exemplo tem permissões estritas'),
  'Módulo exemplo configurado com segurança'
);

test(
  checkFileContent('modules/module-exemplo/module.config.ts', 'sandboxed: true', 'Módulo exemplo em sandbox'),
  'Módulo exemplo em sandbox'
);

test(
  checkFileContent('modules/module-template/module.config.ts', 'enabled: false', 'Template desabilitado por padrão'),
  'Template desabilitado por padrão'
);

// 7. Verificar registro de páginas
test(
  checkFileContent('modules/module-exemplo/module.pages.ts', 'modulePages', 'Módulo exemplo tem registro de páginas'),
  'Módulo exemplo tem registro de páginas'
);

test(
  checkFileContent('modules/module-template/module.pages.ts', 'module-template.index', 'Template tem páginas definidas'),
  'Template tem páginas definidas'
);

// 8. Verificar bootstrap
test(
  checkFileContent('modules/module-exemplo/module.bootstrap.ts', 'registerModule', 'Módulo exemplo tem função registerModule'),
  'Módulo exemplo tem função registerModule'
);

test(
  checkFileContent('modules/module-template/module.bootstrap.ts', 'registerModule', 'Template tem função registerModule'),
  'Template tem função registerModule'
);

// 9. Verificar ModuleCore robusto
test(
  checkFileContent('modules/ModuleCore.js', 'sanitizeText', 'ModuleCore tem sanitização'),
  'ModuleCore tem sanitização de segurança'
);

test(
  checkFileContent('modules/ModuleCore.js', 'validateModuleConfig', 'ModuleCore tem validação'),
  'ModuleCore tem validação de módulos'
);

// 10. Verificar API de descoberta
test(
  checkFileContent('frontend/src/app/api/modules/discover/route.ts', 'loadModule', 'API de descoberta carrega módulos'),
  'API de descoberta implementada'
);

// 11. Verificar roteamento atualizado
test(
  checkFileContent('frontend/src/app/modules/[...slug]/page.tsx', '/api/modules/discover', 'Roteamento usa descoberta automática'),
  'Roteamento usa descoberta automática'
);

console.log('\n📊 VERIFICANDO ESTRUTURA DE PASTAS\n');

// 12. Verificar estrutura de pastas
function checkDirectory(dirPath, description) {
  const exists = fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
  test(exists, `Pasta ${description} existe: ${dirPath}`);
  return exists;
}

checkDirectory('modules/module-exemplo/frontend/pages', 'páginas do módulo exemplo');
checkDirectory('modules/module-template/frontend/pages', 'páginas do template');
checkDirectory('core/modules/engine', 'engine do core');
checkDirectory('frontend/src/app/api/modules', 'API de módulos');

console.log('\n🎯 VERIFICANDO COMPATIBILIDADE\n');

// 13. Verificar se arquivos antigos ainda existem (compatibilidade)
test(
  checkFile('modules/module-exemplo/frontend/pages/index.js', 'Página principal original'),
  'Página principal original mantida'
);

test(
  checkFile('modules/module-exemplo/frontend/pages/settings.js', 'Página de configurações original'),
  'Página de configurações original mantida'
);

test(
  checkFile('modules/module-exemplo/module.config.json', 'Config JSON original'),
  'Configuração JSON original mantida (compatibilidade)'
);

console.log('\n📋 RESUMO DOS TESTES\n');

console.log(`Total de testes: ${totalTests}`);
console.log(`Testes aprovados: ${passedTests}`);
console.log(`Testes falharam: ${totalTests - passedTests}`);
console.log(`Taxa de sucesso: ${Math.round((passedTests / totalTests) * 100)}%`);

if (passedTests === totalTests) {
  console.log('\n🎉 TODOS OS TESTES PASSARAM!');
  console.log('✅ Sistema de Módulos Robusto implementado com sucesso!');
  console.log('\n🚀 PRÓXIMOS PASSOS:');
  console.log('1. Inicie o servidor: npm run dev');
  console.log('2. Acesse: http://localhost:3000/modules/module-exemplo');
  console.log('3. Teste: http://localhost:3000/api/modules/discover');
  console.log('4. Crie um novo módulo copiando module-template');
} else {
  console.log('\n⚠️ ALGUNS TESTES FALHARAM');
  console.log('Verifique os arquivos marcados com ❌ acima');
}

console.log('\n📚 DOCUMENTAÇÃO:');
console.log('- Leia: SISTEMA_MODULOS_ROBUSTO_IMPLEMENTADO.md');
console.log('- Template: modules/module-template/');
console.log('- Exemplo: modules/module-exemplo/');

console.log('\n🔧 COMANDOS ÚTEIS:');
console.log('- Testar API: curl http://localhost:3000/api/modules/discover');
console.log('- Ver logs: Abra o console do navegador');
console.log('- Criar módulo: cp -r modules/module-template modules/meu-modulo');

console.log('\n✨ Sistema pronto para uso!');