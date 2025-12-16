import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PlatformConfigService } from '../../security-config/platform-config.service';
import { initializePlatformConfig, PLATFORM } from '../constants/platform.constants';

@Injectable()
export class PlatformInitService implements OnModuleInit {
  private readonly logger = new Logger(PlatformInitService.name);

  constructor(private platformConfigService: PlatformConfigService) {}

  async onModuleInit() {
    try {
      this.logger.log('Initializing platform configuration...');
      
      // Initialize the platform config service in constants
      initializePlatformConfig(this.platformConfigService);
      
      // Load and cache initial configuration
      const config = await this.platformConfigService.getPlatformConfig();
      PLATFORM.updateCache(config);
      
      this.logger.log(`Platform initialized: ${config.platformName}`);
      this.logger.log(`Contact email: ${config.platformEmail}`);
      this.logger.log(`Contact phone: ${config.platformPhone}`);
    } catch (error) {
      this.logger.error('Failed to initialize platform configuration:', error);
      this.logger.warn('Using default platform configuration');
    }
  }
}