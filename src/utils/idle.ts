/**
 * Ejecuta `task` cuando el hilo de JS está libre (tras animaciones y montajes pendientes).
 * Reemplaza a InteractionManager, obsoleto. Devuelve la función que cancela la tarea.
 */
export function runWhenIdle(task: () => void, timeoutMs = 600): () => void {
  const g = globalThis as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (typeof g.requestIdleCallback === 'function' && typeof g.cancelIdleCallback === 'function') {
    const id = g.requestIdleCallback(task, { timeout: timeoutMs });
    return () => g.cancelIdleCallback?.(id);
  }
  const timer = setTimeout(task, 50);
  return () => clearTimeout(timer);
}
