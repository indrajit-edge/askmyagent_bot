/**
 * Exponential Backoff with Jitter for Google Workspace APIs (PRD Section 58 & 60).
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    onRetry?: (attempt: number, delayMs: number, error: any) => void;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 300;
  const maxDelayMs = options.maxDelayMs ?? 4000;

  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (err: any) {
      attempt++;

      // Check if error is transient / retryable (429 Rate Limit, 503 Unavailable, network errors)
      const status = err.status || err.statusCode || (err.response && err.response.status);
      const isRetryable = status === 429 || status === 503 || status === 500 || err.code === 'ECONNRESET';

      if (attempt > maxRetries || !isRetryable) {
        throw err;
      }

      // Calculate exponential backoff with random jitter: delay = initial * 2^(attempt - 1) * jitter
      const exponential = initialDelayMs * Math.pow(2, attempt - 1);
      const jitter = 0.5 + Math.random() * 0.5;
      const delayMs = Math.min(maxDelayMs, Math.round(exponential * jitter));

      if (options.onRetry) {
        options.onRetry(attempt, delayMs, err);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
