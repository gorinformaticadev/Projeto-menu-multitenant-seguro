import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveSystemVersion } from './app-version.util';

describe('app-version util', () => {
  it('falls back to the workspace package.json version when build metadata files are absent', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dashboard-version-'));
    const backendDir = path.join(tempRoot, 'apps', 'backend');
    fs.mkdirSync(backendDir, { recursive: true });

    fs.writeFileSync(
      path.join(tempRoot, 'package.json'),
      JSON.stringify(
        {
          private: true,
          version: '9.9.9-workspace',
          workspaces: ['apps/*'],
        },
        null,
        2,
      ),
      'utf8',
    );
    fs.writeFileSync(
      path.join(backendDir, 'package.json'),
      JSON.stringify(
        {
          name: 'backend',
          version: '1.0.0-backend',
        },
        null,
        2,
      ),
      'utf8',
    );

    try {
      expect(
        resolveSystemVersion({
          cwd: backendDir,
          env: {} as NodeJS.ProcessEnv,
        }),
      ).toMatchObject({
        version: '9.9.9-workspace',
        source: 'file',
      });
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
