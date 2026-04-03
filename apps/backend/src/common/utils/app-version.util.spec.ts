import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveSystemVersion } from './app-version.util';

function createWorkspace(version = '3.4.2') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'app-version-util-'));
  fs.mkdirSync(path.join(root, 'apps', 'backend'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ version }, null, 2),
    'utf8',
  );

  return {
    root,
    cwd: path.join(root, 'apps', 'backend'),
  };
}

function mockGitCommands(
  repoRoot: string,
  handlers: Record<string, string | Error>,
) {
  return jest.spyOn(childProcess, 'execFileSync').mockImplementation((command, args) => {
    const serializedArgs = Array.isArray(args) ? args.map(String) : [];
    const key = [String(command), ...serializedArgs].join(' ');

    if (!(key in handlers)) {
      throw new Error(`Comando git nao mapeado no teste: ${key}`);
    }

    const value = handlers[key];
    if (value instanceof Error) {
      throw value;
    }

    return `${value}\n`;
  });
}

describe('resolveSystemVersion', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retorna release exata quando o commit atual aponta para uma tag oficial', () => {
    const workspace = createWorkspace('3.4.2');
    const gitSpy = mockGitCommands(workspace.root, {
      [`git -C ${workspace.root} rev-parse --show-toplevel`]: workspace.root,
      [`git -C ${workspace.root} rev-parse --short HEAD`]: 'abc1234',
      [`git -C ${workspace.root} tag --points-at HEAD`]: 'v3.4.2',
    });

    const result = resolveSystemVersion({
      cwd: workspace.cwd,
      env: { PROJECT_ROOT: workspace.root } as NodeJS.ProcessEnv,
    });

    expect(result).toMatchObject({
      version: 'v3.4.2',
      installedVersionRaw: 'v3.4.2',
      installedBaseTag: 'v3.4.2',
      installedVersionNormalized: '3.4.2',
      isExactTaggedRelease: true,
      commitSha: 'abc1234',
      versionSource: 'git_exact_tag',
      source: 'git_exact_tag',
    });

    expect(gitSpy).toHaveBeenCalled();
    fs.rmSync(workspace.root, { recursive: true, force: true });
  });

  it('separa base tag da versao instalada quando o commit esta acima da tag', () => {
    const workspace = createWorkspace('3.4.2');
    mockGitCommands(workspace.root, {
      [`git -C ${workspace.root} rev-parse --show-toplevel`]: workspace.root,
      [`git -C ${workspace.root} rev-parse --short HEAD`]: 'abc1234',
      [`git -C ${workspace.root} tag --points-at HEAD`]: '',
      [`git -C ${workspace.root} describe --tags --abbrev=0 --match v[0-9]*`]: 'v3.4.2',
    });

    const result = resolveSystemVersion({
      cwd: workspace.cwd,
      env: { PROJECT_ROOT: workspace.root } as NodeJS.ProcessEnv,
    });

    expect(result.installedVersionRaw).toBe('v3.4.2+abc1234');
    expect(result.installedBaseTag).toBe('v3.4.2');
    expect(result.installedVersionNormalized).toBe('3.4.2');
    expect(result.isExactTaggedRelease).toBe(false);
    expect(result.commitSha).toBe('abc1234');
    expect(result.versionSource).toBe('git_describe');

    fs.rmSync(workspace.root, { recursive: true, force: true });
  });

  it('cai para package.json de forma explicita quando git nao esta disponivel', () => {
    const workspace = createWorkspace('3.4.2');
    jest.spyOn(childProcess, 'execFileSync').mockImplementation(() => {
      throw new Error('git indisponivel');
    });

    const result = resolveSystemVersion({
      cwd: workspace.cwd,
      env: { PROJECT_ROOT: workspace.root } as NodeJS.ProcessEnv,
    });

    expect(result).toMatchObject({
      version: 'v3.4.2',
      installedVersionRaw: 'v3.4.2',
      installedBaseTag: 'v3.4.2',
      installedVersionNormalized: '3.4.2',
      isExactTaggedRelease: false,
      versionSource: 'package_json',
      source: 'package_json',
    });

    fs.rmSync(workspace.root, { recursive: true, force: true });
  });

  it('mantem a versao comparavel pronta para regras futuras mesmo no fallback tecnico', () => {
    const workspace = createWorkspace('3.4.2');
    jest.spyOn(childProcess, 'execFileSync').mockImplementation(() => {
      throw new Error('git indisponivel');
    });

    const result = resolveSystemVersion({
      cwd: workspace.cwd,
      env: { PROJECT_ROOT: workspace.root, GIT_SHA: 'def5678' } as NodeJS.ProcessEnv,
    });

    expect(result.installedVersionNormalized).toBe('3.4.2');
    expect(result.commitSha).toBe('def5678');
    expect(result.isExactTaggedRelease).toBe(false);

    fs.rmSync(workspace.root, { recursive: true, force: true });
  });

  it('considera APP_BASE_DIR como raiz candidata para encontrar a metadata de versao', () => {
    const workspace = createWorkspace('3.4.2');
    jest.spyOn(childProcess, 'execFileSync').mockImplementation(() => {
      throw new Error('git indisponivel');
    });
    fs.writeFileSync(path.join(workspace.root, 'VERSION'), 'dev+815c70c\n', 'utf8');

    const result = resolveSystemVersion({
      cwd: path.join(workspace.root, 'apps', 'backend', 'dist'),
      env: { APP_BASE_DIR: workspace.root } as NodeJS.ProcessEnv,
    });

    expect(result.installedVersionRaw).toBe('vdev+815c70c');
    expect(result.versionSource).toBe('file');

    fs.rmSync(workspace.root, { recursive: true, force: true });
  });
});
