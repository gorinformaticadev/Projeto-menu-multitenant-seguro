import { Project, SyntaxKind } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Script de auditoria estrutural para garantir a blindagem de contratos.
 * Com suporte a baseline para migração progressiva.
 */

const BASELINE_FILE = path.join(__dirname, '../contract-audit-baseline.json');

async function runAudit() {
  const project = new Project({
    tsConfigFilePath: path.join(__dirname, '../tsconfig.json'),
  });

  const controllers = project.getSourceFiles('src/**/*.controller.ts');
  const currentViolations: string[] = [];

  console.log(`\n=== Iniciando Auditoria de Hardening de Contratos (${controllers.length} controllers) ===\n`);

  for (const file of controllers) {
    const classes = file.getClasses();
    
    for (const cls of classes) {
      if (!cls.getName()?.endsWith('Controller')) continue;

      const methods = cls.getMethods();
      
      for (const method of methods) {
        const isEndpoint = method.getDecorators().some(d => 
          ['Get', 'Post', 'Put', 'Delete', 'Patch', 'All'].includes(d.getName())
        );

        if (!isEndpoint) continue;

        const methodName = `${cls.getName()}.${method.getName()}`;
        const decorators = method.getDecorators().map(d => d.getName());
        const filePath = file.getFilePath().replace(/\\/g, '/');
        const relativePath = path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');
        
        // 1. Verificação de @ValidateResponse
        if (!decorators.includes('ValidateResponse')) {
          if (cls.getName() !== 'HealthController') {
            const violation = `MISSING_VALIDATE_RESPONSE: ${methodName} in ${relativePath}`;
            currentViolations.push(violation);
            console.log(`[ERRO] ${violation}`);
          }
        }

        // 2. Verificação de @Res/@Response
        const hasRes = method.getParameters().some(p => 
          p.getDecorators().some(d => ['Res', 'Response'].includes(d.getName()))
        );
        if (hasRes) {
          const violation = `FORBIDDEN_RES_USAGE: ${methodName} in ${relativePath}`;
          currentViolations.push(violation);
          console.log(`[ERRO] ${violation}`);
        }

        // 3. Verificação de tipo de retorno
        const returnType = method.getReturnType().getText();
        if (returnType.includes('any') || returnType === 'Promise<any>') {
          const violation = `FORBIDDEN_ANY_RETURN: ${methodName} in ${relativePath}`;
          currentViolations.push(violation);
          console.log(`[ERRO] ${violation}`);
        }
      }
    }
  }

  // Carregar baseline se existir
  let baseline: string[] = [];
  if (fs.existsSync(BASELINE_FILE)) {
    baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
  } else {
    // Se não existir, criar um inicial com as violações atuais
    console.log(`\n⚠️  Baseline não encontrado. Criando baseline inicial com ${currentViolations.length} violações.`);
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(currentViolations.sort(), null, 2));
    baseline = currentViolations;
  }

  const newViolations = currentViolations.filter(v => !baseline.includes(v));
  const fixedViolations = baseline.filter(v => !currentViolations.includes(v));

  if (fixedViolations.length > 0) {
    console.log(`\n✅ ${fixedViolations.length} violações do legado foram corrigidas! Atualizando baseline...`);
    fs.writeFileSync(BASELINE_FILE, JSON.stringify(currentViolations.sort(), null, 2));
  }

  if (newViolations.length > 0) {
    console.error(`\n❌ FALHA: ${newViolations.length} novas violações de contrato detectadas (não estão no baseline):`);
    newViolations.forEach(v => console.error(`   - ${v}`));
    process.exit(1);
  }

  console.log(`\n=== Resumo da Auditoria ===`);
  console.log(`Total de violações atuais: ${currentViolations.length}`);
  console.log(`Violações no baseline: ${baseline.length}`);
  
  if (currentViolations.length > 0) {
    console.warn(`\n⚠️  Atenção: Ainda existem ${currentViolations.length} violações legadas. Continue a migração.`);
  } else {
    console.log(`\n✨ SUCESSO: Todos os contratos estão blindados e o baseline está zerado!`);
  }

  process.exit(0);
}

runAudit().catch(err => {
  console.error('Falha crítica na auditoria:', err);
  process.exit(1);
});
