/** Firestore writes cannot be cancelled. Keep one batch in flight while offline,
 * expose a timeout to the UI, and drop GPS samples until that batch settles. */
export function createLocationPublisher(
  publish: () => Promise<unknown>,
  onState: (state: 'confirmed' | 'waiting' | 'failed') => void,
  options: { timeoutMs?: number; intervalMs?: number; now?: () => number } = {},
) {
  let disposed = false;
  let pending = false;
  let lastWrite: number | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const now = options.now ?? Date.now;
  return {
    publish() {
      const time = now();
      if (disposed || pending || (lastWrite !== undefined && time - lastWrite < (options.intervalMs ?? 10000))) return;
      pending = true;
      lastWrite = time;
      timer = setTimeout(() => { if (!disposed) onState('waiting'); }, options.timeoutMs ?? 10000);
      Promise.resolve().then(() => disposed ? undefined : publish()).then(
        () => { if (!disposed) onState('confirmed'); },
        () => { if (!disposed) onState('failed'); },
      ).finally(() => { clearTimeout(timer); pending = false; });
    },
    dispose() { disposed = true; clearTimeout(timer); },
  };
}
