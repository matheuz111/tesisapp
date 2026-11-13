import { toMillis } from './dashboardStats.ts';

/**
 * Técnicos conectados que dejaron de reportar su ubicación en horario laboral.
 * Es la versión de la central del control de ubicación: sin Cloud Functions no hay un proceso que revise
 * cada 15 minutos, así que el panel lo calcula en vivo con los datos de presencia que ya recibe.
 */

export interface WorkSchedule {
  days: readonly number[];
  startHour: number;
  endHour: number;
}

// TODO: CONFIRMAR - Misma jornada que usa la app móvil (src/services/locationCompliance.ts): lunes a sábado, 08:00-18:00.
export const WORK_SCHEDULE: WorkSchedule = { days: [1, 2, 3, 4, 5, 6], startHour: 8, endHour: 18 };

/** Sin señal desde hace más de este tiempo se considera "sin ubicación". */
export const STALE_AFTER_MINUTES = 20;

const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000;

export function isWithinWorkHours(now: Date, schedule: WorkSchedule = WORK_SCHEDULE): boolean {
  const lima = new Date(now.getTime() + LIMA_OFFSET_MS);
  return schedule.days.includes(lima.getUTCDay()) && lima.getUTCHours() >= schedule.startHour && lima.getUTCHours() < schedule.endHour;
}

export interface PresenceLike {
  providerId: string;
  providerName?: string;
  providerPhone?: string;
  status?: string;
  lastSeenAt?: unknown;
}

export interface StaleProvider {
  providerId: string;
  name: string;
  phone: string;
  /** Minutos sin señal; null si nunca reportó. */
  minutesSilent: number | null;
}

/** Conectados (disponibles u ocupados) cuya última señal supera el umbral. Fuera de horario no se reporta nadie. */
export function findStaleProviders(
  presence: readonly PresenceLike[],
  now: Date = new Date(),
  thresholdMinutes: number = STALE_AFTER_MINUTES,
  schedule: WorkSchedule = WORK_SCHEDULE,
): StaleProvider[] {
  if (!isWithinWorkHours(now, schedule)) return [];
  const limit = now.getTime() - thresholdMinutes * 60000;
  return presence
    .filter((p) => p.status === 'AVAILABLE' || p.status === 'BUSY')
    .map((p) => ({ p, seen: toMillis(p.lastSeenAt) }))
    .filter(({ seen }) => seen === null || seen < limit)
    .map(({ p, seen }) => ({
      providerId: p.providerId,
      name: p.providerName || 'Técnico',
      phone: p.providerPhone || '',
      minutesSilent: seen === null ? null : Math.round((now.getTime() - seen) / 60000),
    }))
    .sort((a, b) => (b.minutesSilent ?? Infinity) - (a.minutesSilent ?? Infinity));
}
