import { Project, SyntaxKind } from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Script de auditoria estrutural para garantir a blindagem de contratos.
 * Suporte a baseline removido: O enforcement agora é estrito e bloqueante no CI.
 */

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

        // 4. Verificação Mínima de Swagger como fonte de verdade
        if (!decorators.includes('ApiOperation')) {
          if (cls.getName() !== 'HealthController') {
             const violation = `MISSING_SWAGGER_API_OPERATION: ${methodName} in ${relativePath}`;
             currentViolations.push(violation);
             console.log(`[ERRO] ${violation}`);
          }
        }
      }
    }
  }

  if (currentViolations.length > 0) {
    console.error(`\n❌ FALHA CRÍTICA (ENFORCEMENT ATIVADO): ${currentViolations.length} violações de contrato detectadas.`);
    currentViolations.forEach(v => console.error(`   - ${v}`));
    process.exit(1);
  }

  console.log(`\n✨ SUCESSO STRICT: Todos os controllers e métodos respeitam as regras de contrato!`);


  process.exit(0);
}

runAudit().catch(err => {
  console.error('Falha crítica na auditoria:', err);
  process.exit(1);
});
