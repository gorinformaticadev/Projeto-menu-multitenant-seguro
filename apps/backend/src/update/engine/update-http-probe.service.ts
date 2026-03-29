import { Injectable } from '@nestjs/common';

@Injectable()
export class UpdateHttpProbeService {
  async waitForReady(params: {
    url: string;
    timeoutMs: number;
    intervalMs?: number;
  }): Promise<void> {
    const startedAt = Date.now();
    const intervalMs = params.intervalMs || 2_000;

    while (Date.now() - startedAt < params.timeoutMs) {
      try {
        await this.fetchText(params.url, 5_000);
        return;
      } catch {
        await this.sleep(intervalMs);
      }
    }

    throw new Error(`Timeout aguardando resposta em ${params.url}`);
  }

  async fetchText(url: string, timeoutMs = 10_000): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} em ${url}`);
      }

      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
