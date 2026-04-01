import { execSync } from 'child_process';
import fs from 'fs';

const args = process.argv.slice(2);
// Agora '--rc' indica uma Release Candidate interina (só Tag, sem GitHub Release)
const isRc = args.some(arg => arg.includes('--rc'));

console.log('📦 Iniciando processo de versionamento (standard-version)...');
try {
  let svCommand = 'pnpm dlx standard-version';
  if (isRc) {
    // Altera a mensagem do commit/tag para incluir "rc" no final
    svCommand += ' --releaseCommitMessageFormat "chore:{{currentTag}} rc"';
  }
  execSync(svCommand, { stdio: 'inherit' });
} catch (err) {
  console.error('❌ Falha ao rodar standard-version. Abortando processo.');
  process.exit(1);
}

console.log('⬆️ Sincronizando tags com o repositório remoto...');
try {
  execSync('git push --follow-tags', { stdio: 'inherit' });
} catch (err) {
  console.error('❌ Falha ao realizar git push.');
  process.exit(1);
}

if (!isRc) {
  const pkgData = fs.readFileSync('package.json', 'utf8');
  const pkg = JSON.parse(pkgData);
  const version = `v${pkg.version}`;
  
  console.log(`\n🚀 Publicando Release Final (Stable) no GitHub para a versão ${version}...`);
  try {
    execSync(`gh release create ${version} --generate-notes --title "Release ${version}"`, { stdio: 'inherit' });
    console.log('✅ Release oficial publicada e visível no painel do GitHub!');
  } catch (err) {
    console.error('❌ Erro ao usar o GitHub CLI (gh) para criar a release. Certifique-se de que está autenticado com "gh auth login".', err.message);
  }
} else {
  console.log('\n✅ Tag RC gerada de forma segura e sincronizada via Git.');
  console.log('💡 Como foi utilizado o "--rc", a Release no GitHub foi ignorada.');
}
