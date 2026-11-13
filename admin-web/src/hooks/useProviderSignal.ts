import { useEffect, useMemo, useState } from 'react';
import { presenceRepository } from '../repositories/presenceRepository';
import { findStaleProviders, type PresenceLike, type StaleProvider } from '../utils/providerSignal';

const REFRESH_MS = 60 * 1000;

/**
 * Técnicos conectados que llevan más de 20 minutos sin reportar ubicación, en horario laboral.
 * Se recalcula cada minuto con la presencia en tiempo real (no hace falta que llegue un dato nuevo
 * para darse cuenta de que alguien dejó de reportar).
 */
export function useProviderSignal(enabled: boolean): StaleProvider[] {
  const [presence, setPresence] = useState<PresenceLike[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = presenceRepository.subscribeActive(
      (list) => setPresence(list as unknown as PresenceLike[]),
      () => setPresence([]),
    );
    const timer = setInterval(() => setNow(new Date()), REFRESH_MS);
    return () => { unsubscribe(); clearInterval(timer); };
  }, [enabled]);

  return useMemo(() => (enabled ? findStaleProviders(presence, now) : []), [enabled, presence, now]);
}
