import { Injectable } from '@nestjs/common';
import { ResolvedSystemVersion, resolveSystemVersion } from '../utils/app-version.util';

@Injectable()
export class SystemVersionService {
  getVersionInfo(options?: { cwd?: string; env?: NodeJS.ProcessEnv }): ResolvedSystemVersion {
    return resolveSystemVersion(options);
  }

  getVersionTag(options?: { cwd?: string; env?: NodeJS.ProcessEnv }): string {
    return this.getVersionInfo(options).version;
  }
}
