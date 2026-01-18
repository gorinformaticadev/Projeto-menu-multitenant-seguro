#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Function to recursively find all TypeScript files
function findTsFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !['node_modules', 'dist', '.git'].includes(item)) {
      findTsFiles(fullPath, files);
    } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Function to fix common ESLint issues
function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // Fix 1: Remove unused imports
  const unusedImports = [
    { pattern: /, NotFoundException/g, replacement: '' },
    { pattern: /NotFoundException, /g, replacement: '' },
    { pattern: /, StaticCorsMiddleware/g, replacement: '' },
    { pattern: /StaticCorsMiddleware, /g, replacement: '' },
    { pattern: /, ValidateIf/g, replacement: '' },
    { pattern: /ValidateIf, /g, replacement: '' },
    { pattern: /, HttpStatus/g, replacement: '' },
    { pattern: /HttpStatus, /g, replacement: '' },
    { pattern: /, IsArray/g, replacement: '' },
    { pattern: /IsArray, /g, replacement: '' },
    { pattern: /, ForbiddenException/g, replacement: '' },
    { pattern: /ForbiddenException, /g, replacement: '' },
    { pattern: /, DynamicModule/g, replacement: '' },
    { pattern: /DynamicModule, /g, replacement: '' },
    { pattern: /, Prisma/g, replacement: '' },
    { pattern: /Prisma, /g, replacement: '' },
    { pattern: /, PrismaClient/g, replacement: '' },
    { pattern: /PrismaClient, /g, replacement: '' },
    { pattern: /, JwtAuthGuard/g, replacement: '' },
    { pattern: /JwtAuthGuard, /g, replacement: '' },
    { pattern: /, NotificationGateway/g, replacement: '' },
    { pattern: /NotificationGateway, /g, replacement: '' },
    { pattern: /, Role/g, replacement: '' },
    { pattern: /Role, /g, replacement: '' },
    { pattern: /, Req/g, replacement: '' },
    { pattern: /Req, /g, replacement: '' },
    { pattern: /, fs/g, replacement: '' },
    { pattern: /fs, /g, replacement: '' },
    { pattern: /, path/g, replacement: '' },
    { pattern: /path, /g, replacement: '' }
  ];
  
  for (const { pattern, replacement } of unusedImports) {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      changed = true;
    }
  }
  
  // Fix 2: Prefix unused parameters with underscore
  const unusedParams = [
    { pattern: /\(([^,)]+), info\)/g, replacement: '($1, _info)' },
    { pattern: /\(([^,)]+), hint\)/g, replacement: '($1, _hint)' },
    { pattern: /\(([^,)]+), args\)/g, replacement: '($1, _args)' },
    { pattern: /\(([^,)]+), data\)/g, replacement: '($1, _data)' },
    { pattern: /\(([^,)]+), req\)/g, replacement: '($1, _req)' },
    { pattern: /\(([^,)]+), client\)/g, replacement: '($1, _client)' },
    { pattern: /\(([^,)]+), payload\)/g, replacement: '($1, _payload)' },
    { pattern: /\(([^,)]+), authorInfo\)/g, replacement: '($1, _authorInfo)' },
    { pattern: /\(([^,)]+), stat\)/g, replacement: '($1, _stat)' },
    { pattern: /\(([^,)]+), password\)/g, replacement: '($1, _password)' },
    { pattern: /\(([^,)]+), tenantId\)/g, replacement: '($1, _tenantId)' },
    { pattern: /\(([^,)]+), moduleName\)/g, replacement: '($1, _moduleName)' },
    { pattern: /\(([^,)]+), config\)/g, replacement: '($1, _config)' },
    { pattern: /\(([^,)]+), index\)/g, replacement: '($1, _index)' }
  ];
  
  for (const { pattern, replacement } of unusedParams) {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      changed = true;
    }
  }
  
  // Fix 3: Remove unnecessary escape characters in regex
  const escapePatterns = [
    { pattern: /\\\[/g, replacement: '[' },
    { pattern: /\\\//g, replacement: '/' },
    { pattern: /\\\(/g, replacement: '(' },
    { pattern: /\\\)/g, replacement: ')' },
    { pattern: /\\\+/g, replacement: '+' }
  ];
  
  for (const { pattern, replacement } of escapePatterns) {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      changed = true;
    }
  }
  
  // Fix 4: Replace @ts-ignore with @ts-expect-error
  if (content.includes('@ts-ignore')) {
    content = content.replace(/@ts-ignore/g, '@ts-expect-error');
    changed = true;
  }
  
  // Fix 5: Remove empty constructors
  const emptyConstructorPattern = /constructor\(\)\s*{\s*}/g;
  if (emptyConstructorPattern.test(content)) {
    content = content.replace(emptyConstructorPattern, '// Empty constructor removed');
    changed = true;
  }
  
  // Fix 6: Replace Object type with object
  const objectTypePattern = /:\s*Object\b/g;
  if (objectTypePattern.test(content)) {
    content = content.replace(objectTypePattern, ': object');
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
  }
}

// Main execution
const srcDir = path.join(__dirname, 'apps', 'backend', 'src');
if (fs.existsSync(srcDir)) {
  const tsFiles = findTsFiles(srcDir);
  console.log(`Found ${tsFiles.length} TypeScript files`);
  
  for (const file of tsFiles) {
    try {
      fixFile(file);
    } catch (error) {
      console.error(`Error fixing ${file}:`, error.message);
    }
  }
  
  console.log('ESLint fixes completed!');
} else {
  console.error('Source directory not found:', srcDir);
}