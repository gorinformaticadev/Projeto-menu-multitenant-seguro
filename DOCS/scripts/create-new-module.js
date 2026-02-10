/**
 * SCRIPT PARA CRIAR NOVOS MÓDULOS
 * 
 * Automatiza a criação de novos módulos baseados no template
 */

const fs = require('fs');
const path = require('path');

// Função para copiar diretório recursivamente
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Função para substituir texto em arquivo
function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  for (const [search, replace] of Object.entries(replacements)) {
    content = content.replace(new RegExp(search, 'g'), replace);
  }
  
  fs.writeFileSync(filePath, content, 'utf-8');
}

// Função principal para criar módulo
function createModule(moduleName, displayName, description, author = 'Sistema') {
  const moduleSlug = moduleName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const templatePath = 'modules/module-template';
  const newModulePath = `modules/${moduleSlug}`;
  
  console.log(`🚀 Criando novo módulo: ${displayName}`);
  console.log(`📁 Slug: ${moduleSlug}`);
  console.log(`📂 Caminho: ${newModulePath}\n`);
  
  // 1. Verificar se template existe
  if (!fs.existsSync(templatePath)) {
    console.error('❌ Template não encontrado:', templatePath);
    return false;
  }
  
  // 2. Verificar se módulo já existe
  if (fs.existsSync(newModulePath)) {
    console.error('❌ Módulo já existe:', newModulePath);
    return false;
  }
  
  // 3. Copiar template
  console.log('📋 Copiando template...');
  copyDirectory(templatePath, newModulePath);
  console.log('✅ Template copiado');
  
  // 4. Definir substituições
  const replacements = {
    'Module Template': displayName,
    'module-template': moduleSlug,
    'Template para criação de novos módulos independentes': description,
    'Seu Nome': author,
    'Template': 'Módulo',
    'template': moduleSlug.replace(/-/g, ''),
    'ModuleTemplate': moduleName.replace(/[^a-zA-Z0-9]/g, ''),
    'FileTemplate': 'Package', // Ícone padrão
    'order: 200': `order: ${Math.floor(Math.random() * 900) + 100}`, // Ordem aleatória
    'enabled: false': 'enabled: true' // Habilitar por padrão
  };
  
  // 5. Atualizar arquivos
  const filesToUpdate = [
    `${newModulePath}/module.config.ts`,
    `${newModulePath}/module.pages.ts`,
    `${newModulePath}/module.bootstrap.ts`,
    `${newModulePath}/frontend/pages/index.js`,
    `${newModulePath}/frontend/pages/settings.js`
  ];
  
  console.log('🔧 Atualizando arquivos...');
  for (const file of filesToUpdate) {
    if (fs.existsSync(file)) {
      replaceInFile(file, replacements);
      console.log(`✅ Atualizado: ${file}`);
    }
  }
  
  // 6. Criar README do módulo
  const readmeContent = `# ${displayName}

## Descrição
${description}

## Autor
${author}

## Versão
1.0.0

## Instalação
Este módulo foi criado automaticamente usando o template do sistema de módulos robusto.

## Configuração
- Arquivo de configuração: \`module.config.ts\`
- Páginas: \`module.pages.ts\`
- Bootstrap: \`module.bootstrap.ts\`

## Páginas Disponíveis
- **Página Principal**: \`/${moduleSlug}\`
- **Configurações**: \`/${moduleSlug}/settings\`

## Como Usar
1. O módulo já está habilitado (\`enabled: true\`)
2. Acesse: \`http://localhost:3000/modules/${moduleSlug}\`
3. Personalize as páginas em \`frontend/pages/\`
4. Modifique a configuração conforme necessário

## Estrutura
\`\`\`
${moduleSlug}/
├── module.config.ts      # Configuração do módulo
├── module.pages.ts       # Registro de páginas
├── module.bootstrap.ts   # Bootstrap e inicialização
└── frontend/
    └── pages/
        ├── index.js      # Página principal
        └── settings.js   # Página de configurações
\`\`\`

## Segurança
- ✅ Sandbox habilitado
- ✅ Permissões estritas
- ✅ Validações de entrada
- ✅ Sanitização de dados

## Desenvolvimento
Para modificar este módulo:
1. Edite os arquivos em \`frontend/pages/\`
2. Atualize \`module.config.ts\` se necessário
3. Adicione novas páginas em \`module.pages.ts\`
4. Teste acessando as rotas do módulo

Criado automaticamente pelo Sistema de Módulos Robusto.
`;
  
  fs.writeFileSync(`${newModulePath}/README.md`, readmeContent, 'utf-8');
  console.log('✅ README.md criado');
  
  console.log('\n🎉 MÓDULO CRIADO COM SUCESSO!');
  console.log(`\n📋 Informações do Módulo:`);
  console.log(`   Nome: ${displayName}`);
  console.log(`   Slug: ${moduleSlug}`);
  console.log(`   Caminho: ${newModulePath}`);
  console.log(`   Status: Habilitado`);
  
  console.log(`\n🌐 URLs Disponíveis:`);
  console.log(`   Principal: http://localhost:3000/modules/${moduleSlug}`);
  console.log(`   Configurações: http://localhost:3000/modules/${moduleSlug}/settings`);
  
  console.log(`\n🔧 Próximos Passos:`);
  console.log(`   1. Inicie o servidor: npm run dev`);
  console.log(`   2. Acesse as URLs acima`);
  console.log(`   3. Personalize em: ${newModulePath}/frontend/pages/`);
  console.log(`   4. Leia: ${newModulePath}/README.md`);
  
  return true;
}

// Exemplos de uso
console.log('🛠️ CRIADOR DE MÓDULOS - SISTEMA ROBUSTO\n');

// Verificar argumentos da linha de comando
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('📋 EXEMPLOS DE USO:\n');
  
  console.log('node create-new-module.js "Meu Módulo" "Descrição do módulo" "Meu Nome"');
  console.log('node create-new-module.js "Sistema de Vendas" "Módulo para gerenciar vendas" "João Silva"');
  console.log('node create-new-module.js "Relatórios" "Módulo de relatórios avançados" "Equipe Dev"');
  
  console.log('\n🚀 CRIANDO MÓDULO DE EXEMPLO...\n');
  
  // Criar módulo de exemplo
  createModule(
    'Módulo Exemplo Novo',
    'Módulo Exemplo Novo',
    'Módulo criado automaticamente para demonstração',
    'Sistema Automático'
  );
  
} else {
  const [displayName, description = 'Módulo criado automaticamente', author = 'Sistema'] = args;
  createModule(displayName, displayName, description, author);
}

console.log('\n✨ Script concluído!');