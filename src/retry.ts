export interface RetryEvent {
  failedAttempt: number;
  nextAttempt: number;
  waitingTime: number;
  error: unknown;
}

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMilliseconds: number;
  maximumDelayMilliseconds: number;
  shouldRetry: (error: unknown) => boolean;
  getRetryAfterMilliseconds?: (error: unknown) => number | undefined;
  sleep?: (milliseconds: number) => Promise<void>;
  onRetry?: (event: RetryEvent) => void;
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function withExponentialBackoff<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const sleep = options.sleep ?? defaultSleep;

  if (!Number.isInteger(options.maxAttempts) || options.maxAttempts < 1) {
    throw new Error("maxAttempts debe ser un entero positivo");
  }

  for (let attempt = 1; attempt <= options.maxAttempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error: unknown) {
      const isLastAttempt = attempt === options.maxAttempts;

      if (isLastAttempt || !options.shouldRetry(error)) {
        throw error;
      }

      const exponentialDelay = Math.min(
        options.baseDelayMilliseconds * 2 ** (attempt - 1),
        options.maximumDelayMilliseconds,
      );
      const retryAfter = options.getRetryAfterMilliseconds?.(error) ?? 0;
      const waitingTime = Math.max(exponentialDelay, retryAfter);

      options.onRetry?.({
        failedAttempt: attempt,
        nextAttempt: attempt + 1,
        waitingTime,
        error,
      });

      await sleep(waitingTime);
    }
  }

  throw new Error("Se agotaron los intentos");
}
