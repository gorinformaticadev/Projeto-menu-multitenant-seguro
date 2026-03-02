import { SeedModuleKey } from './seeds/types';
import { runSeedPipeline } from './seeds/runner';

const VALID_COMMANDS = new Set(['deploy', 'run']);
const VALID_MODULES = new Set<SeedModuleKey>(['initial-tenants', 'default-users', 'system-config']);

type ParsedArgs = {
  command: 'deploy' | 'run';
  force: boolean;
  modules: SeedModuleKey[];
};

function parseArgs(rawArgs: string[]): ParsedArgs {
  let command: 'deploy' | 'run' = 'deploy';
  const modules: SeedModuleKey[] = [];
  let force = false;

  for (const arg of rawArgs) {
    if (arg === '--force') {
      force = true;
      continue;
    }

    if (arg.startsWith('--module=')) {
      const value = arg.slice('--module='.length).trim().toLowerCase() as SeedModuleKey;
      if (!VALID_MODULES.has(value)) {
        throw new Error(`Modulo invalido: ${value}`);
      }
      modules.push(value);
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    if (!arg.startsWith('-') && VALID_COMMANDS.has(arg)) {
      command = arg as 'deploy' | 'run';
      continue;
    }

    throw new Error(`Argumento nao reconhecido: ${arg}`);
  }

  return {
    command,
    force,
    modules,
  };
}

function printUsage(): void {
  console.log('Uso: node dist/prisma/seed.js [deploy|run] [--module=<name>] [--force]');
  console.log('Modulos validos: initial-tenants, default-users, system-config');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log('Iniciando pipeline de seed versionado...');
  console.log(`Comando: ${args.command}`);
  console.log(`Force: ${args.force ? 'true' : 'false'}`);
  if (args.modules.length > 0) {
    console.log(`Modulos: ${args.modules.join(', ')}`);
  }

  const result = await runSeedPipeline({
    force: args.force,
    modules: args.modules,
    mode: args.command === 'run' ? 'manual' : 'deploy',
  });

  if (!result.lockAcquired) {
    console.log('Seed ignorado: outro processo ja executa o pipeline no banco.');
    return;
  }

  const failed = result.results.filter((item) => item.status === 'FAILED');

  for (const item of result.results) {
    const summaryText = item.summary
      ? `created=${item.summary.created} updated=${item.summary.updated} skipped=${item.summary.skipped}`
      : 'sem resumo';
    console.log(`[${item.status}] ${item.key}@${item.version} (${summaryText})`);
    if (item.error) {
      console.error(`  erro: ${item.error}`);
    }
  }

  if (failed.length > 0) {
    throw new Error(`Seed finalizado com ${failed.length} modulo(s) com falha.`);
  }

  console.log('Seed concluido com sucesso.');
}

main().catch((error) => {
  console.error('Erro na execucao do seed:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
