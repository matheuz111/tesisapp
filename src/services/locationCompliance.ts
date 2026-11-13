/**
 * Control de ubicación activa en horario laboral (puro y probable, sin dependencias de React Native).
 *
 * Regla de negocio: un técnico marcado como disponible, dentro de su jornada, debe tener los servicios de
 * ubicación y el permiso activos. Si no, se le avisa para que los encienda y la central pueda asignarle
 * servicios cercanos.
 */

export interface WorkSchedule {
  /** Días laborables: 0 = domingo … 6 = sábado. */
  days: readonly number[];
  /** Hora de inicio (incluida) y de fin (excluida), en hora de Lima. */
  startHour: number;
  endHour: number;
}

// TODO: CONFIRMAR - Jornada laboral de los técnicos (lunes a sábado, 08:00 a 18:00)
export const DEFAULT_WORK_SCHEDULE: WorkSchedule = { days: [1, 2, 3, 4, 5, 6], startHour: 8, endHour: 18 };

/** Lima está en UTC-5 todo el año (Perú no usa horario de verano): no depende de la zona del teléfono. */
const LIMA_OFFSET_MS = -5 * 60 * 60 * 1000;

export function isWithinWorkHours(now: Date, schedule: WorkSchedule = DEFAULT_WORK_SCHEDULE): boolean {
  const lima = new Date(now.getTime() + LIMA_OFFSET_MS);
  const day = lima.getUTCDay();
  const hour = lima.getUTCHours();
  return schedule.days.includes(day) && hour >= schedule.startHour && hour < schedule.endHour;
}

export type LocationIssue = 'SERVICES_OFF' | 'PERMISSION_DENIED';

export interface ComplianceInput {
  /** El técnico está conectado/disponible para recibir servicios. */
  available: boolean;
  /** Los servicios de ubicación (GPS) del teléfono están encendidos. */
  servicesEnabled: boolean;
  /** La app tiene permiso de ubicación. */
  permissionGranted: boolean;
  now: Date;
  schedule?: WorkSchedule;
}

/** Devuelve el problema a corregir, o null si todo está bien o no corresponde avisar. */
export function evaluateLocationCompliance(input: ComplianceInput): LocationIssue | null {
  if (!input.available) return null;
  if (!isWithinWorkHours(input.now, input.schedule)) return null;
  if (!input.permissionGranted) return 'PERMISSION_DENIED';
  if (!input.servicesEnabled) return 'SERVICES_OFF';
  return null;
}

export const REMINDER_COOLDOWN_MS = 15 * 60 * 1000;

/** Evita insistir: como máximo un recordatorio cada 15 minutos. */
export function shouldRemind(lastReminderAt: number | null, now: number, cooldownMs: number = REMINDER_COOLDOWN_MS): boolean {
  return lastReminderAt === null || now - lastReminderAt >= cooldownMs;
}

export const LOCATION_REMINDER_COPY: Record<LocationIssue, { title: string; body: string; action: string }> = {
  SERVICES_OFF: {
    title: 'Enciende tu ubicación',
    body: 'Estás en horario laboral y la central necesita tu ubicación activa para asignarte servicios cercanos.',
    action: 'Activar ubicación',
  },
  PERMISSION_DENIED: {
    title: 'Permite el acceso a tu ubicación',
    body: 'La app no tiene permiso de ubicación. Actívalo en los ajustes para recibir servicios cercanos.',
    action: 'Abrir ajustes',
  },
};
