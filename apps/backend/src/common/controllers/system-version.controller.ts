import { Controller, Get } from '@nestjs/common';
import { SystemVersionService } from '../services/system-version.service';

@Controller('system')
export class SystemVersionController {
  constructor(private readonly systemVersionService: SystemVersionService) {}

  @Get('version')
  getVersion() {
    const info = this.systemVersionService.getVersionInfo();
    return {
      version: info.installedVersionRaw,
      source: info.versionSource,
      versionSource: info.versionSource,
      installedVersionRaw: info.installedVersionRaw,
      installedBaseTag: info.installedBaseTag,
      installedVersionNormalized: info.installedVersionNormalized,
      isExactTaggedRelease: info.isExactTaggedRelease,
      commitSha: info.commitSha,
      buildDate: info.buildDate,
      branch: info.branch,
    };
  }
}
