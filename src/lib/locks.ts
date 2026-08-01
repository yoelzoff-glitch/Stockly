const activeLocks = new Set<string>();

/**
 * Intenta adquirir un bloqueo para una clave dada.
 * Si el bloqueo ya existe, espera hasta que se libere o transcurra el tiempo de espera.
 */
export async function acquireLock(key: string, timeoutMs = 15000): Promise<boolean> {
  const start = Date.now();
  while (activeLocks.has(key)) {
    if (Date.now() - start > timeoutMs) {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  activeLocks.add(key);
  return true;
}

/**
 * Libera el bloqueo para una clave dada.
 */
export function releaseLock(key: string): void {
  activeLocks.delete(key);
}
