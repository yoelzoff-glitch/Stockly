/**
 * A simple concurrency rate limiter that schedules function execution.
 * It controls how many operations can run concurrently and introduces
 * a delay between resolving queued actions to respect rate limits.
 */
export function createRateLimiter(maxConcurrent: number, delayMs: number = 100) {
  let active = 0;
  const queue: (() => void)[] = [];

  function next() {
    if (queue.length > 0 && active < maxConcurrent) {
      active++;
      const resolve = queue.shift()!;
      resolve();
    }
  }

  return {
    async acquire(): Promise<void> {
      if (active < maxConcurrent) {
        active++;
        return;
      }
      return new Promise<void>((resolve) => {
        queue.push(resolve);
      });
    },
    release() {
      active--;
      if (delayMs > 0) {
        setTimeout(next, delayMs);
      } else {
        next();
      }
    }
  };
}
