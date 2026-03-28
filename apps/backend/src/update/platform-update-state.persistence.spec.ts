import * as os from 'os';
import * as path from 'path';
import * as fsp from 'fs/promises';
import {
  readPersistedUpdateState,
  writePersistedUpdateState,
  type PersistedUpdateState,
} from './platform-update-state.persistence';

function createState(overrides?: Partial<PersistedUpdateState>): PersistedUpdateState {
  return {
    status: 'running',
    mode: 'native',
    startedAt: '2026-03-28T12:00:00.000Z',
    finishedAt: null,
    fromVersion: 'v1.0.0',
    toVersion: 'v1.2.3',
    step: 'build_frontend',
    progress: 54,
    lock: true,
    lastError: null,
    errorCode: null,
    errorCategory: null,
    errorStage: null,
    exitCode: null,
    userMessage: null,
    technicalMessage: null,
    rollback: {
      attempted: false,
      completed: false,
      reason: null,
    },
    ...overrides,
  };
}

describe('platform-update-state.persistence', () => {
  let tempDir: string;
  let statePath: string;
  let logPath: string;

  beforeEach(async () => {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pluggor-update-state-'));
    statePath = path.join(tempDir, 'update-state.json');
    logPath = path.join(tempDir, 'update.log');
  });

  afterEach(async () => {
    await fsp.rm(tempDir, { recursive: true, force: true });
  });

  it('parseia update-state.json valido', async () => {
    await writePersistedUpdateState(statePath, createState());

    const result = await readPersistedUpdateState({
      statePath,
      logPath,
      detectMode: () => 'native',
      activeOperation: { active: true, type: 'update' },
    });

    expect(result.state.step).toBe('build_frontend');
    expect(result.diagnostics.healthy).toBe(true);
    expect(result.diagnostics.source).toBe('state_file');
  });

  it('trata arquivo inexistente sem derrubar a leitura', async () => {
    const result = await readPersistedUpdateState({
      statePath,
      logPath,
      detectMode: () => 'native',
      activeOperation: { active: false, type: null },
    });

    expect(result.state.status).toBe('idle');
    expect(result.diagnostics.source).toBe('state_missing');
  });

  it('trata arquivo vazio com fallback coerente', async () => {
    await fsp.writeFile(statePath, '', 'utf8');

    const result = await readPersistedUpdateState({
      statePath,
      logPath,
      detectMode: () => 'native',
      activeOperation: { active: false, type: null },
    });

    expect(result.state.status).toBe('failed');
    expect(result.diagnostics.source).toBe('state_empty');
    expect(result.diagnostics.issueCode).toBe('UPDATE_STATUS_PERSISTENCE_ERROR');
  });

  it('recupera contexto util de JSON truncado', async () => {
    await fsp.writeFile(
      statePath,
      '{"status":"running","step":"build_frontend","progress":54,"lock":true',
      'utf8',
    );

    const result = await readPersistedUpdateState({
      statePath,
      logPath,
      detectMode: () => 'native',
      activeOperation: { active: true, type: 'update' },
    });

    expect(result.state.status).toBe('running');
    expect(result.state.step).toBe('build_frontend');
    expect(result.diagnostics.source).toBe('partial_state_recovery');
    expect(result.diagnostics.recoveredStepCode).toBe('build_frontend');
  });

  it('normaliza arquivo com campos obrigatorios ausentes sem quebrar a leitura', async () => {
    await fsp.writeFile(
      statePath,
      JSON.stringify({
        status: 'running',
        step: 'build_backend',
      }),
      'utf8',
    );

    const result = await readPersistedUpdateState({
      statePath,
      logPath,
      detectMode: () => 'native',
      activeOperation: { active: true, type: 'update' },
    });

    expect(result.state.status).toBe('running');
    expect(result.state.step).toBe('build_backend');
    expect(result.state.progress).toBe(0);
    expect(result.diagnostics.source).toBe('state_invalid_shape');
    expect(result.diagnostics.issueCode).toBe('UPDATE_STATUS_PERSISTENCE_ERROR');
  });

  it('usa ultima leitura saudavel quando o arquivo corrompe durante update ativo', async () => {
    const lastKnownState = createState({ step: 'migrate', progress: 72 });
    await fsp.writeFile(statePath, '{"status":"running","step":"', 'utf8');

    const result = await readPersistedUpdateState({
      statePath,
      logPath,
      lastKnownState,
      detectMode: () => 'native',
      activeOperation: { active: true, type: 'update' },
    });

    expect(result.state.step).toBe('migrate');
    expect(result.state.status).toBe('running');
    expect(['partial_state_recovery', 'last_good_state']).toContain(result.diagnostics.source);
  });

  it('usa log como apoio quando nao consegue reconstruir o JSON', async () => {
    await fsp.writeFile(statePath, '{INVALID', 'utf8');
    await fsp.writeFile(logPath, "[deploy] [2026-03-28T12:00:00Z] Efetuando pull das imagens...\n", 'utf8');

    const result = await readPersistedUpdateState({
      statePath,
      logPath,
      detectMode: () => 'docker',
      activeOperation: { active: true, type: 'update' },
    });

    expect(result.state.step).toBe('pull_images');
    expect(result.diagnostics.source).toBe('log_recovery');
  });

  it('nao deixa escrita com falha intermediaria substituir o arquivo oficial', async () => {
    await writePersistedUpdateState(statePath, createState({ step: 'prepare', progress: 10 }));

    const fsMock = {
      mkdir: jest.fn(async () => undefined),
      writeFile: jest.fn(async () => {
        throw new Error('falha simulada');
      }),
      rename: jest.fn(async () => undefined),
      rm: jest.fn(async () => undefined),
      readFile: fsp.readFile.bind(fsp),
    };

    await expect(writePersistedUpdateState(statePath, createState({ step: 'build_backend' }), fsMock as never)).rejects.toThrow('falha simulada');

    const official = JSON.parse(await fsp.readFile(statePath, 'utf8')) as PersistedUpdateState;
    expect(official.step).toBe('prepare');
  });

  it('mantem o arquivo oficial sempre parseavel durante leituras concorrentes', async () => {
    await writePersistedUpdateState(statePath, createState({ step: 'build_backend', progress: 40 }));

    const reader = async () => JSON.parse(await fsp.readFile(statePath, 'utf8')) as PersistedUpdateState;

    const reads: PersistedUpdateState[] = [];

    for (let index = 0; index < 10; index += 1) {
      const pendingRead = reader();
      await writePersistedUpdateState(statePath, createState({
        step: index % 2 === 0 ? 'build_backend' : 'build_frontend',
        progress: 41 + index,
      }));
      reads.push(await pendingRead);
    }

    for (const snapshot of reads) {
      expect(['build_backend', 'build_frontend']).toContain(snapshot.step);
      expect(typeof snapshot.progress).toBe('number');
    }
  });
});
