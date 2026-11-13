import type { ServiceRequest } from '../types';

/** Estados que requieren acción de la central antes de que un técnico pueda atender. */
const TO_ASSIGN = ['PENDING_ASSIGNMENT', 'REQUIRES_REASSIGNMENT'] as const;
/** Estados de espera previos al servicio (incluye cotización pendiente del cliente). */
const PENDING = ['PENDING_ASSIGNMENT', 'QUOTED', 'REQUIRES_REASSIGNMENT'] as const;
const IN_PROGRESS = ['PENDING', 'ACCEPTED', 'IN_PROGRESS'] as const;
const COMPLETED = ['COMPLETED', 'VALIDATED'] as const;

export interface DashboardStats {
  total: number;
  /** Pendientes de la central: por asignar, cotizadas o por reasignar. */
  pending: number;
  /** Por asignar o reasignar: solicitudes donde la central debe actuar ya. */
  toAssign: number;
  /** Solicitudes rechazadas o devueltas por el técnico. */
  reassign: number;
  /** Técnico asignado, en camino o ejecutando. */
  inProgress: number;
  /** Técnicos en ruta hacia el domicilio (ACCEPTED). */
  inTransit: number;
  /** Servicios en ejecución en el predio (IN_PROGRESS). */
  executing: number;
  completed: number;
  /** Atenciones concluidas durante el día local actual. */
  completedToday: number;
  /** Solicitudes en curso: todo lo que no está concluido ni cancelado. */
  active: number;
  completionRate: string;
  photoEvidences: number;
  auditRate: string;
}

/** Convierte un Timestamp de Firestore, Date, número o cadena en milisegundos; null si no es válido. */
export function toMillis(value: unknown): number | null {
  if (!value) return null;
  const v = value as { toMillis?: () => number; toDate?: () => Date; seconds?: number };
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (typeof v.toDate === 'function') return v.toDate().getTime();
  if (typeof v.seconds === 'number') return v.seconds * 1000;
  const parsed = new Date(value as string | number | Date).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function isSameLocalDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

/** Indicadores operativos de la bandeja. `now` se inyecta para que el cálculo sea determinista en pruebas. */
export function computeDashboardStats(requests: readonly ServiceRequest[], now: number = Date.now()): DashboardStats {
  const count = (statuses: readonly string[]) => requests.filter((r) => statuses.includes(r.status)).length;

  const total = requests.length;
  const completed = count(COMPLETED);
  const completedToday = requests.filter((r) => {
    if (!(COMPLETED as readonly string[]).includes(r.status)) return false;
    const at = toMillis(r.finishedAt) ?? toMillis(r.validatedAt);
    return at !== null && isSameLocalDay(at, now);
  }).length;
  const finished = requests.filter((r) => (COMPLETED as readonly string[]).includes(r.status) || r.status.startsWith('CANCELLED')).length;
  const photoEvidences = requests.filter(
    (r) => r.issuePhoto || r.evidencePhoto || (r as unknown as Record<string, unknown>).evidence_photo,
  ).length;

  return {
    total,
    pending: count(PENDING),
    toAssign: count(TO_ASSIGN),
    reassign: count(['REQUIRES_REASSIGNMENT']),
    inProgress: count(IN_PROGRESS),
    inTransit: count(['ACCEPTED']),
    executing: count(['IN_PROGRESS']),
    completed,
    completedToday,
    active: total - finished,
    completionRate: total > 0 ? ((completed / total) * 100).toFixed(0) : '0',
    photoEvidences,
    auditRate: total > 0 ? ((photoEvidences / total) * 100).toFixed(0) : '0',
  };
}
