#!/usr/bin/env ts-node

/**
 * Script de verificação de segurança
 * Executa validações de segurança antes do deploy
 */

import { validateSecurityConfig } from '../src/common/utils/security.utils';
import * as fs from 'fs';
import * as path from 'path';

interface SecurityIssue {
  level: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  file?: string;
  line?: number;
}

class SecurityChecker {
  private issues: SecurityIssue[] = [];

  addIssue(issue: SecurityIssue) {
    this.issues.push(issue);
  }

  /**
   * Verifica configurações de ambiente
   */
  checkEnvironmentConfig() {
    console.log('🔍 Verificando configurações de ambiente...');
    
    const validation = validateSecurityConfig();
    
    validation.errors.forEach(error => {
      this.addIssue({
        level: 'error',
        category: 'Environment',
        message: error
      });
    });
    
    validation.warnings.forEach(warning => {
      this.addIssue({
        level: 'warning',
        category: 'Environment',
        message: warning
      });
    });
  }

  /**
   * Verifica senhas hardcoded no código
   */
  checkHardcodedSecrets() {
    console.log('🔍 Verificando senhas hardcoded...');
    
    // Padrões mais específicos para evitar falsos positivos
    const patterns = [
      /password\s*[:=]\s*['"](?!.*\[FILTERED\]|.*placeholder|.*example)[a-zA-Z0-9!@#$%^&*]{3,20}['"]/gi,
      /secret\s*[:=]\s*['"](?!.*placeholder|.*example|.*your-|.*change)[a-zA-Z0-9!@#$%^&*]{8,50}['"]/gi,
      // Senhas específicas conhecidas como inseguras
      /(admin123|password123|123456|qwerty|password|admin|root|test123)/gi
    ];
    
    this.scanDirectory('./src', patterns, 'Hardcoded Secrets');
    this.scanDirectory('./prisma', patterns, 'Hardcoded Secrets');
  }

  /**
   * Verifica uso de funções perigosas
   */
  checkDangerousFunctions() {
    console.log('🔍 Verificando funções perigosas...');
    
    const patterns = [
      /\beval\s*\(/gi,
      /new\s+Function\s*\(/gi,
      /setTimeout\s*\(\s*['"][^'"]*['"]/gi,
      /setInterval\s*\(\s*['"][^'"]*['"]/gi,
      /innerHTML\s*=/gi,
      /document\.write\s*\(/gi,
      /execSync\s*\(\s*[^)]*\$\{/gi, // Command injection
      /exec\s*\(\s*[^)]*\$\{/gi // Command injection
    ];
    
    this.scanDirectory('./src', patterns, 'Dangerous Functions');
  }

  /**
   * Verifica configurações de CORS
   */
  checkCORSConfig() {
    console.log('🔍 Verificando configurações de CORS...');
    
    const mainTsPath = './src/main.ts';
    if (fs.existsSync(mainTsPath)) {
      const content = fs.readFileSync(mainTsPath, 'utf8');
      
      if (content.includes("'*'") && content.includes('Access-Control-Allow-Origin')) {
        this.addIssue({
          level: 'error',
          category: 'CORS',
          message: 'CORS configurado para aceitar qualquer origem (*)',
          file: mainTsPath
        });
      }
    }
  }

  /**
   * Verifica dependências com vulnerabilidades conhecidas
   */
  async checkDependencies() {
    console.log('🔍 Verificando dependências...');
    
    try {
      const { execSync } = require('child_process');
      const auditResult = execSync('npm audit --json', { encoding: 'utf8' });
      const audit = JSON.parse(auditResult);
      
      if (audit.metadata && audit.metadata.vulnerabilities) {
        const vulns = audit.metadata.vulnerabilities;
        
        if (vulns.critical > 0) {
          this.addIssue({
            level: 'error',
            category: 'Dependencies',
            message: `${vulns.critical} vulnerabilidades críticas encontradas`
          });
        }
        
        if (vulns.high > 0) {
          this.addIssue({
            level: 'warning',
            category: 'Dependencies',
            message: `${vulns.high} vulnerabilidades altas encontradas`
          });
        }
      }
    } catch (error) {
      this.addIssue({
        level: 'warning',
        category: 'Dependencies',
        message: 'Não foi possível executar npm audit'
      });
    }
  }

  /**
   * Escaneia diretório em busca de padrões
   */
  private scanDirectory(dir: string, patterns: RegExp[], category: string) {
    if (!fs.existsSync(dir)) return;
    
    const files = this.getAllFiles(dir);
    
    files.forEach(file => {
      if (file.endsWith('.ts') || file.endsWith('.js')) {
        const content = fs.readFileSync(file, 'utf8');
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
          patterns.forEach(pattern => {
            if (pattern.test(line)) {
              // Filtrar falsos positivos
              const lineContent = line.trim();
              
              // Ignorar comentários
              if (lineContent.startsWith('//') || lineContent.startsWith('*') || lineContent.startsWith('/*')) {
                return;
              }
              
              // Ignorar constantes de configuração conhecidas
              if (lineContent.includes('IS_PUBLIC_KEY') || 
                  lineContent.includes('ROLES_KEY') || 
                  lineContent.includes('SKIP_CSRF_KEY') ||
                  lineContent.includes('[FILTERED]') ||
                  lineContent.includes('charset') ||
                  lineContent.includes('commonPasswords') ||
                  lineContent.includes('function (object:') ||
                  lineContent.includes('return function')) {
                return;
              }
              
              this.addIssue({
                level: 'error',
                category,
                message: `Padrão suspeito encontrado: ${lineContent.substring(0, 100)}${lineContent.length > 100 ? '...' : ''}`,
                file: file,
                line: index + 1
              });
            }
          });
        });
      }
    });
  }

  /**
   * Obtém todos os arquivos de um diretório recursivamente
   */
  private getAllFiles(dir: string): string[] {
    const files: string[] = [];
    
    const items = fs.readdirSync(dir);
    
    items.forEach(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        files.push(...this.getAllFiles(fullPath));
      } else if (stat.isFile()) {
        files.push(fullPath);
      }
    });
    
    return files;
  }

  /**
   * Executa todas as verificações
   */
  async runAllChecks() {
    console.log('🔒 Iniciando verificação de segurança...\n');
    
    this.checkEnvironmentConfig();
    this.checkHardcodedSecrets();
    this.checkDangerousFunctions();
    this.checkCORSConfig();
    await this.checkDependencies();
    
    this.generateReport();
  }

  /**
   * Gera relatório final
   */
  private generateReport() {
    console.log('\n📊 RELATÓRIO DE SEGURANÇA');
    console.log('========================\n');
    
    const errors = this.issues.filter(i => i.level === 'error');
    const warnings = this.issues.filter(i => i.level === 'warning');
    const infos = this.issues.filter(i => i.level === 'info');
    
    console.log(`❌ Erros: ${errors.length}`);
    console.log(`⚠️  Avisos: ${warnings.length}`);
    console.log(`ℹ️  Informações: ${infos.length}\n`);
    
    if (errors.length > 0) {
      console.log('❌ ERROS CRÍTICOS:');
      errors.forEach(error => {
        console.log(`   [${error.category}] ${error.message}`);
        if (error.file) {
          console.log(`      Arquivo: ${error.file}${error.line ? `:${error.line}` : ''}`);
        }
      });
      console.log('');
    }
    
    if (warnings.length > 0) {
      console.log('⚠️  AVISOS:');
      warnings.forEach(warning => {
        console.log(`   [${warning.category}] ${warning.message}`);
        if (warning.file) {
          console.log(`      Arquivo: ${warning.file}${warning.line ? `:${warning.line}` : ''}`);
        }
      });
      console.log('');
    }
    
    // Resultado final
    if (errors.length === 0) {
      console.log('✅ VERIFICAÇÃO CONCLUÍDA: Sistema pronto para produção!');
      process.exit(0);
    } else {
      console.log('❌ VERIFICAÇÃO FALHOU: Corrija os erros antes do deploy!');
      process.exit(1);
    }
  }
}

// Executar verificação
const checker = new SecurityChecker();
checker.runAllChecks().catch(error => {
  console.error('Erro durante verificação de segurança:', error);
  process.exit(1);
});