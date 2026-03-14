import { Injectable } from '@nestjs/common';
import { ConfigResolverService } from '../../system-settings/config-resolver.service';
import { SettingValueSource } from '../../system-settings/system-settings.types';

export interface WebsocketToggleState {
  key: 'security.websocket.enabled';
  enabled: boolean;
  source: SettingValueSource;
}

@Injectable()
export class WebsocketRuntimeToggleService {
  private readonly configCacheTtlMs = 15000;
  private cachedState: WebsocketToggleState | null = null;
  private configExpiresAt = 0;

  constructor(private readonly configResolver: ConfigResolverService) {}

  async isEnabledCached(): Promise<boolean> {
    return (await this.getToggleStateCached()).enabled;
  }

  async getToggleStateCached(): Promise<WebsocketToggleState> {
    const now = Date.now();

    if (this.cachedState && now < this.configExpiresAt) {
      return this.cachedState;
    }

    const resolved = await this.configResolver.getResolved<boolean>('security.websocket.enabled');
    this.cachedState = {
      key: 'security.websocket.enabled',
      enabled: resolved?.value !== false,
      source: resolved?.source ?? 'default',
    };
    this.configExpiresAt = now + this.configCacheTtlMs;

    return this.cachedState;
  }
}
