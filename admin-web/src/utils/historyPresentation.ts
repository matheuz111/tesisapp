/**
 * Presentación del historial de estados: convierte lo que guarda la base de datos
 * (PENDING_ASSIGNMENT, OPERATOR, uid del actor…) en frases que entiende cualquier persona de la central.
 */

export interface HistoryEntry {
  fromStatus?: string | null;
  toStatus?: string;
  actorId?: string;
  actorRole?: string;
  notes?: string;
}

export type HistoryTone = 'primary' | 'success' | 'danger' | 'warning';

export interface TransitionText {
  title: string;
  tone: HistoryTone;
}

const ROLE_LABELS: Record<string, string> = {
  CLIENT: 'Cliente',
  PROVIDER: 'Técnico',
  OPERATOR: 'Central',
  ADMIN: 'Central',
  SYSTEM: 'Sistema',
};

export function roleLabel(role?: string): string {
  if (!role) return 'Sistema';
  return ROLE_LABELS[role] ?? 'Sistema';
}

/** Quién hizo el cambio: el nombre real cuando se conoce; si no, su rol. Nunca el identificador técnico. */
export function actorLabel(entry: HistoryEntry, context: { clientName?: string; providerName?: string }): string {
  const role = roleLabel(entry.actorRole);
  if (entry.actorRole === 'CLIENT' && context.clientName) return `${context.clientName} (${role})`;
  if (entry.actorRole === 'PROVIDER' && context.providerName) return `${context.providerName} (${role})`;
  return role === 'Central' ? 'Central de operaciones' : role;
}

/** Título en lenguaje claro del cambio de estado y su tono (para el color del punto de la línea de tiempo). */
export function describeTransition(entry: HistoryEntry): TransitionText {
  const to = entry.toStatus || '';
  const from = entry.fromStatus || '';
  switch (to) {
    case 'PENDING_ASSIGNMENT':
      return from === 'QUOTED'
        ? { title: 'El cliente aprobó la cotización', tone: 'success' }
        : { title: 'Solicitud recibida', tone: 'primary' };
    case 'QUOTED':
      return { title: 'Cotización enviada al cliente', tone: 'primary' };
    case 'PENDING':
      return { title: 'Técnico asignado, esperando su respuesta', tone: 'primary' };
    case 'ACCEPTED':
      return { title: 'El técnico aceptó y va en camino', tone: 'primary' };
    case 'IN_PROGRESS':
      return { title: 'Trabajo iniciado en el domicilio', tone: 'primary' };
    case 'COMPLETED':
      return { title: 'El técnico terminó el trabajo', tone: 'success' };
    case 'VALIDATED':
      return { title: 'Cierre validado por la central', tone: 'success' };
    case 'REQUIRES_REASSIGNMENT':
      return { title: 'El técnico devolvió la solicitud', tone: 'warning' };
    case 'CANCELLED_BY_CLIENT':
      return { title: 'Cancelada por el cliente', tone: 'danger' };
    case 'CANCELLED_BY_PROVIDER':
      return { title: 'Cancelada por el técnico', tone: 'danger' };
    case 'CANCELLED_BY_OPERATOR':
      return { title: 'Cancelada por la central', tone: 'danger' };
    default:
      return { title: to ? to.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : 'Cambio de estado', tone: 'primary' };
  }
}

/** Duración legible: 45 s, 1 min 54 s, 12 min, 1 h 15 min, 2 d 3 h. null si no hay datos válidos. */
export function formatDuration(milliseconds: number | null): string | null {
  if (milliseconds === null || Number.isNaN(milliseconds) || milliseconds < 0) return null;
  const totalSeconds = Math.round(milliseconds / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 10) return seconds ? `${minutes} min ${seconds} s` : `${minutes} min`;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24) return restMinutes ? `${hours} h ${restMinutes} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days} d ${restHours} h` : `${days} d`;
}

const REASON_LABELS: Record<string, string> = {
  DISTANCE: 'Distancia excesiva o fuera de zona',
  BUSY: 'Técnico ocupado con otro servicio',
  OUT_OF_SPECIALTY: 'Fuera de la especialidad del técnico',
  OTHER: 'Otro motivo justificado',
};

/**
 * Motivo de rechazo o cancelación en lenguaje claro. Los códigos de la base de datos (OUT_OF_SPECIALTY)
 * se traducen; el texto libre que escribió una persona se respeta tal cual.
 */
export function formatReason(value?: string | null): string {
  const text = (value || '').trim();
  if (!text) return '';
  if (REASON_LABELS[text]) return REASON_LABELS[text];
  if (/^[A-Z0-9_]+$/.test(text)) return text.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  return text;
}
