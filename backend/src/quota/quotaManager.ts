import db from '../database/connection';

interface QuotaBucket {
  count: number;
  resetAt: number;
}

export class QuotaManager {
  private static userLimits: Map<string, QuotaBucket> = new Map();
  private static MAX_REQUESTS_PER_MINUTE = 30;
  private static WINDOW_MS = 60 * 1000; // 1 minute

  /**
   * Checks whether the user has exceeded their request quota for a specific connector.
   */
  static async checkQuota(
    chatId: number,
    connector: string
  ): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
    const key = `${chatId}:${connector.toLowerCase()}`;
    const now = Date.now();

    let bucket = this.userLimits.get(key);

    if (!bucket || now > bucket.resetAt) {
      bucket = {
        count: 0,
        resetAt: now + this.WINDOW_MS
      };
      this.userLimits.set(key, bucket);
    }

    if (bucket.count >= this.MAX_REQUESTS_PER_MINUTE) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);

      // Log quota limit violation to database
      try {
        await db('api_logs').insert({
          chat_id: chatId,
          connector,
          operation: 'quota_check',
          status: 'quota_limit',
          error_message: `Rate limit of ${this.MAX_REQUESTS_PER_MINUTE} req/min exceeded. Retry after ${retryAfterSeconds}s.`
        });
      } catch (e) {
        // Ignore DB logging failure
      }

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds
      };
    }

    bucket.count++;
    return {
      allowed: true,
      remaining: this.MAX_REQUESTS_PER_MINUTE - bucket.count,
      retryAfterSeconds: 0
    };
  }

  /**
   * Resets quota tracking (useful in testing).
   */
  static reset(): void {
    this.userLimits.clear();
  }
}
