import type { IntakeChannel, ServiceRequest } from '../../types';
import { resolveRequestCanonicalPricing } from '../../services/pricingPolicyService.ts';
import { toMillis } from '../../utils/dashboardStats.ts';
import type { SlaCalculation } from '../SlaTrafficBadge';

/** Lenguaje claro para quien no conoce el proceso: qué pasa con la solicitud y qué hacer a continuación. */
export interface StageExplanation {
  /** Qué está pasando, en una frase. */
  what: string;
  /** Siguiente paso recomendado para la central. */
  next: string;
  /** Si la central debe actuar ahora (resalta la fila y la acción principal). */
  needsAction: boolean;
}

export function explainStage(request: ServiceRequest): StageExplanation {
  const technician = request.providerName || 'El técnico';
  switch (request.status) {
    case 'PENDING_ASSIGNMENT':
      return { what: 'La solicitud llegó y todavía no tiene técnico.', next: 'Asigna un técnico de la zona.', needsAction: true };
    case 'REQUIRES_REASSIGNMENT':
      return { what: `${technician} devolvió la solicitud.`, next: 'Asigna a otro técnico lo antes posible.', needsAction: true };
    case 'QUOTED':
      return { what: 'Se envió la cotización al cliente.', next: 'Espera su respuesta en la app. No requiere acción.', needsAction: false };
    case 'PENDING':
      return { what: `${technician} recibió la asignación y aún no la acepta.`, next: 'Si demora, llámalo o reasigna.', needsAction: false };
    case 'ACCEPTED':
      return { what: `${technician} va camino al domicilio.`, next: 'Puedes seguir su ubicación en el mapa.', needsAction: false };
    case 'IN_PROGRESS':
      return { what: `${technician} está trabajando en el domicilio.`, next: 'Espera la foto de evidencia al terminar.', needsAction: false };
    case 'COMPLETED':
      return { what: 'El técnico terminó el trabajo.', next: 'Revisa la evidencia y valida el cierre.', needsAction: true };
    case 'VALIDATED':
      return { what: 'Servicio cerrado y validado por la central.', next: 'Puedes emitir el certificado de garantía.', needsAction: false };
    default:
      if (request.status.startsWith('CANCELLED')) {
        return { what: 'La solicitud fue cancelada.', next: 'No requiere acción.', needsAction: false };
      }
      return { what: 'Estado sin descripción.', next: 'Abre la ficha para ver el detalle.', needsAction: false };
  }
}

export function canAssign(request: ServiceRequest): boolean {
  return ['PENDING_ASSIGNMENT', 'REQUIRES_REASSIGNMENT'].includes(request.status);
}

export function isClosed(request: ServiceRequest): boolean {
  return ['COMPLETED', 'VALIDATED'].includes(request.status);
}

export function formatDateTime(value: unknown): { date: string; time: string } {
  const ms = toMillis(value);
  if (ms === null) return { date: '—', time: '' };
  const date = new Date(ms);
  return {
    date: date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: '2-digit' }),
    time: date.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }),
  };
}

export function getDisplayPrice(request: ServiceRequest): string {
  if (request.price_agreed && request.price_agreed.trim().length > 0) {
    const match = request.price_agreed.match(/(\d+(?:\.\d{1,2})?)/);
    return match ? `S/ ${parseFloat(match[1]).toFixed(2)}` : request.price_agreed;
  }
  return `S/ ${resolveRequestCanonicalPricing(request).fee.toFixed(2)}`;
}

export const CHANNEL_LABELS: Record<IntakeChannel, string> = {
  APP: 'App',
  WHATSAPP: 'WhatsApp',
  PHONE: 'Llamada',
  EMAIL: 'Correo',
  WEB: 'Web',
};

const WARRANTY_DAYS = 30;

export interface WarrantyInfo {
  active: boolean;
  label: string;
  expiryDate: string;
}

/** Garantía institucional de 30 días desde la validación (o el término) del servicio. */
export function getWarranty(request: ServiceRequest, now: number = Date.now()): WarrantyInfo | null {
  if (!isClosed(request)) return null;
  const base = toMillis(request.validatedAt) ?? toMillis(request.finishedAt) ?? toMillis(request.createdAt);
  if (base === null) return null;
  const expires = base + WARRANTY_DAYS * 24 * 60 * 60 * 1000;
  const active = now <= expires;
  return {
    active,
    label: active ? 'Garantía vigente' : 'Garantía vencida',
    expiryDate: new Date(expires).toLocaleDateString('es-PE', { dateStyle: 'medium' }),
  };
}

export const PAYMENT_LABELS: Record<string, string> = {
  PENDING: 'Pago pendiente',
  PAID: 'Pagado por el cliente, por confirmar',
  CONFIRMED: 'Pago confirmado',
};

export interface TimelineStep {
  key: string;
  label: string;
  at: unknown;
}

/** Hitos del servicio en orden; los que aún no ocurrieron se muestran como pendientes. */
export function buildTimeline(request: ServiceRequest): TimelineStep[] {
  return [
    { key: 'created', label: 'Solicitud recibida', at: request.createdAt },
    { key: 'assigned', label: 'Técnico asignado', at: request.assignedAt },
    { key: 'accepted', label: 'Técnico aceptó', at: request.acceptedAt },
    { key: 'arrived', label: 'Llegada validada con PIN', at: request.pinValidatedAt },
    { key: 'started', label: 'Trabajo iniciado', at: request.startedAt },
    { key: 'finished', label: 'Trabajo terminado', at: request.finishedAt },
    { key: 'validated', label: 'Cierre validado por la central', at: request.validatedAt },
  ];
}

/** 75 → "1 h 15 min"; 3000 → "2 d 2 h". Evita cifras grandes en minutos. */
export function formatElapsed(minutes: number): string {
  if (minutes < 1) return 'menos de 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days} d ${restHours} h` : `${days} d`;
}

/** Texto del tiempo en la etapa actual, sin siglas internas (T_RESP, T_ASIG…). */
export function describeSla(sla: SlaCalculation): string {
  const elapsed = formatElapsed(sla.elapsedMinutes);
  switch (sla.metric) {
    case 'REASSIGNMENT': return `Reasignar · hace ${elapsed}`;
    case 'T_RESP': return sla.label.startsWith('Cotizado') ? `Cotizado hace ${elapsed}` : `Esperando hace ${elapsed}`;
    case 'T_ASIG': return `Asignado hace ${elapsed}`;
    case 'T_VIS': return `En ruta hace ${elapsed}`;
    case 'T_EJEC': return `Trabajando hace ${elapsed}`;
    default: return '';
  }
}
