import { execSync } from 'child_process';
import fs from 'fs';

const args = process.argv.slice(2);
// Aceita tanto a flag exata pedida (--rc) quanto a padrão sem npm args duplicados, etc.
const createGithubRelease = args.some(arg => arg.includes('--rc') || arg.includes('--release'));

console.log('📦 Iniciando processo de versionamento (standard-version)...');
try {
  execSync('pnpm dlx standard-version', { stdio: 'inherit' });
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

if (createGithubRelease) {
  const pkgData = fs.readFileSync('package.json', 'utf8');
  const pkg = JSON.parse(pkgData);
  const version = `v${pkg.version}`;
  
  console.log(`\n🚀 Comando --rc detectado! Publicando Release no GitHub para a versão ${version}...`);
  try {
    execSync(`gh release create ${version} --generate-notes --title "Release ${version}"`, { stdio: 'inherit' });
    console.log('✅ Release oficial publicada e visível no painel do GitHub!');
  } catch (err) {
    console.error('❌ Erro ao usar o GitHub CLI (gh) para criar a release. Certifique-se de que está autenticado com "gh auth login".', err.message);
  }
} else {
  console.log('\n✅ Tag sincronizada apenas localmente e via Git.');
  console.log('💡 Dica: Para promover essa tag a uma RELEASE OFICIAL no GitHub, use o comando: pnpm run versao --rc');
}
