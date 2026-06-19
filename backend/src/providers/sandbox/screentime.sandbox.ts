import type { ScreenTimeProvider, ScreenUsage } from '../types.js';
import { logger } from '../../lib/logger.js';

/**
 * In-memory screen-time provider. In production, usage comes from the mobile OS
 * (Android UsageStatsManager / iOS Screen Time) and enforcement happens device-side;
 * here the mobile app reports usage to the backend and we echo it back.
 */
export class SandboxScreenTimeProvider implements ScreenTimeProvider {
  private usage = new Map<string, ScreenUsage[]>();

  async getUsage(userId: string): Promise<ScreenUsage[]> {
    return this.usage.get(userId) ?? [];
  }

  /** Test/dev helper used by the screentime service to record reported usage. */
  setUsage(userId: string, usage: ScreenUsage[]): void {
    this.usage.set(userId, usage);
  }

  async enforceBlock(userId: string, appOrSite: string, blocked: boolean): Promise<void> {
    logger.info('screentime.enforce', { userId, appOrSite, blocked });
  }
}
