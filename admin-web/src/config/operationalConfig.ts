/**
 * PARÁMETROS OPERATIVOS INSTITUCIONALES — MAESTRO A DOMICILIO PERÚ S.A.C.
 * 
 * Regla de Tesis:
 * Valores no confirmados por la empresa se centralizan aquí con bandera // TODO: CONFIRMAR.
 * Queda prohibido hardcodearlos dispersos en pantallas o componentes.
 */

export interface SpecialtyItem {
  id: string;
  label: string;
  iconName: string; // Nombre del icono Lucide equivalente
  description: string;
  // TODO: CONFIRMAR - Tarifa referencial de inspección diagnóstica en Soles
  defaultFeePen: number;
}

// TODO: CONFIRMAR - Catálogo exacto de especialidades técnicas homologadas para Lima Metropolitana y Callao
export const SPECIALTIES_CATALOG: readonly SpecialtyItem[] = [
  {
    id: 'Gasfitero',
    label: 'Gasfitería',
    iconName: 'Droplet',
    description: 'Fugas de agua, desagües atorados, griferías, bombas y termas',
    defaultFeePen: 45.00,
  },
  {
    id: 'Electricista',
    label: 'Electricidad',
    iconName: 'Zap',
    description: 'Cortocircuitos, llaves térmicas, cableado, luminarias y tableros',
    defaultFeePen: 50.00,
  },
  {
    id: 'Pintor',
    label: 'Pintura',
    iconName: 'Paintbrush',
    description: 'Pintura de interiores, exteriores, empastado y sellado',
    defaultFeePen: 40.00,
  },
  {
    id: 'Carpintero',
    label: 'Carpintería',
    iconName: 'Hammer',
    description: 'Muebles de melamina, puertas, reposteros y cerraduras de madera',
    defaultFeePen: 45.00,
  },
  {
    id: 'Albañil',
    label: 'Albañilería',
    iconName: 'BrickWall',
    description: 'Tarrajeo, resanes de humedad, asentado de ladrillo y mayólicas',
    defaultFeePen: 50.00,
  },
  {
    id: 'Cerrajero',
    label: 'Cerrajería',
    iconName: 'Key',
    description: 'Apertura de puertas de emergencia, cambio de chapas y cerrojos',
    defaultFeePen: 50.00,
  },
  {
    id: 'Tecnico',
    label: 'Línea Blanca / TV',
    iconName: 'Tv',
    description: 'Diagnóstico y reparación de lavadoras, refrigeradoras y racks',
    defaultFeePen: 55.00,
  },
  {
    id: 'Otro',
    label: 'Otro Servicio',
    iconName: 'Grid',
    description: 'Reparaciones y mantenimiento general del hogar',
    defaultFeePen: 45.00,
  },
] as const;

export const OPERATIONAL_CONFIG = {
  // TODO: CONFIRMAR - Tarifa base diagnóstica de visita técnica en Soles (PEN)
  DEFAULT_VISIT_FEE_PEN: 45.00,

  // TODO: CONFIRMAR - Descuento del valor de visita al aprobar el presupuesto final
  VISIT_FEE_DEDUCTIBLE_FROM_TOTAL: true,

  // TODO: CONFIRMAR - Días calendario de garantía post-servicio para emisión de certificados
  WARRANTY_DAYS_DEFAULT: 30,

  // TODO: CONFIRMAR - Métodos de pago y billeteras digitales habilitadas
  PAYMENT_METHODS_ENABLED: ['YAPE', 'PLIN', 'TRANSFERENCIA', 'EFECTIVO'] as const,

  // TODO: CONFIRMAR - Tiempo en segundos para que el técnico acepte una asignación antes de reasignar
  PROVIDER_ACCEPTANCE_TIMEOUT_SECONDS: 90,

  // TODO: CONFIRMAR - Límite de intentos erróneos de PIN antes de bloqueo temporal de seguridad
  MAX_PIN_VERIFICATION_ATTEMPTS: 3,

  // TODO: CONFIRMAR - Tiempo en segundos de bloqueo temporal tras agotar intentos de PIN
  PIN_LOCKOUT_DURATION_SECONDS: 60,

  // TODO: CONFIRMAR - Vigencia estándar de una cotización formal emitida por la central (días)
  QUOTE_VALIDITY_DAYS: 3,

  // TODO: CONFIRMAR - Teléfono oficial de emergencia de la Central de Operaciones en Lima
  CENTRAL_EMERGENCY_PHONE: '017009840',

  // TODO: CONFIRMAR - Número WhatsApp corporativo de soporte
  CENTRAL_WHATSAPP_PHONE: '924167911',
};

export function getSpecialtyById(id: string): SpecialtyItem {
  const found = SPECIALTIES_CATALOG.find((s) => s.id.toLowerCase() === id.toLowerCase() || s.label.toLowerCase() === id.toLowerCase());
  return found || SPECIALTIES_CATALOG[SPECIALTIES_CATALOG.length - 1];
}

import type { OperationalZone } from '../types/canonical';

/**
 * UMBRALES DE SEMÁFORO DE TIEMPOS DE SERVICIO (SLA) — Tesis Maestro a Domicilio
 *
 * Configuración centralizada de semáforos por etapa operativa:
 * - T_RESP (Tiempo de respuesta de central): verde < 10m, ámbar 10-20m, rojo > 20m.
 * - T_ASIG (Tiempo de asignación técnica): verde < 15m, ámbar 15-30m, rojo > 30m.
 */
export const SLA_CONFIG = {
  // TODO: CONFIRMAR - Umbrales de respuesta inicial de central (minutos)
  T_RESP: {
    GREEN_LIMIT_MINUTES: 10,
    AMBER_LIMIT_MINUTES: 20,
  },
  // TODO: CONFIRMAR - Umbrales de asignación de técnico tras aprobación o recepción (minutos)
  T_ASIG: {
    GREEN_LIMIT_MINUTES: 15,
    AMBER_LIMIT_MINUTES: 30,
  },
  // TODO: CONFIRMAR - Umbrales de tiempo de traslado en ruta hacia domicilio (minutos)
  T_VIS: {
    GREEN_LIMIT_MINUTES: 45,
    AMBER_LIMIT_MINUTES: 60,
  },
  // TODO: CONFIRMAR - Umbrales de ejecución técnica en sitio (minutos)
  T_EJEC: {
    GREEN_LIMIT_MINUTES: 120,
    AMBER_LIMIT_MINUTES: 180,
  },
} as const;

export interface DistrictOption {
  code: string;
  name: string;
  zone: OperationalZone;
  zoneName: string;
}

/**
 * CATÁLOGO COMPLETO DE LOS 50 DISTRITOS (43 Lima Metropolitana + 7 Callao)
 * Agrupados según su Zona Operativa Canónica.
 */
export const COMPLETE_DISTRICTS_CATALOG: readonly DistrictOption[] = [
  // ── 1. Lima Norte (8 distritos) ──
  { code: 'ANCON', name: 'Ancón', zone: 'LIMA_NORTE', zoneName: 'Lima Norte' },
  { code: 'CARABAYLLO', name: 'Carabayllo', zone: 'LIMA_NORTE', zoneName: 'Lima Norte' },
  { code: 'COMAS', name: 'Comas', zone: 'LIMA_NORTE', zoneName: 'Lima Norte' },
  { code: 'INDEPENDENCIA', name: 'Independencia', zone: 'LIMA_NORTE', zoneName: 'Lima Norte' },
  { code: 'LOS_OLIVOS', name: 'Los Olivos', zone: 'LIMA_NORTE', zoneName: 'Lima Norte' },
  { code: 'PUENTE_PIEDRA', name: 'Puente Piedra', zone: 'LIMA_NORTE', zoneName: 'Lima Norte' },
  { code: 'SAN_MARTIN_DE_PORRES', name: 'San Martín de Porres', zone: 'LIMA_NORTE', zoneName: 'Lima Norte' },
  { code: 'SANTA_ROSA', name: 'Santa Rosa', zone: 'LIMA_NORTE', zoneName: 'Lima Norte' },

  // ── 2. Lima Centro (14 distritos) ──
  { code: 'BARRANCO', name: 'Barranco', zone: 'LIMA_CENTRO', zoneName: 'Lima Centro' },
  { code: 'BRENA', name: 'Breña', zone: 'LIMA_CENTRO', zoneName: 'Lima Centro' },
  { code: 'CERCADO_DE_LIMA', name: 'Cercado de Lima', zone: 'LIMA_CENTRO', zoneName: 'Lima Centro' },
  { code: 'JESUS_MARIA', name: 'Jesús María', zone: 'LIMA_CENTRO', zoneName: 'Lima Centro' },
  { code: 'LA_VICTORIA', name: 'La Victoria', zone: 'LIMA_CENTRO', zoneName: 'Lima Centro' },
  { code: 'LINCE', name: 'Lince', zone: 'LIMA_CENTRO', zoneName: 'Lima Centro' },
  { code: 'MAGDALENA_DEL_MAR', name: 'Magdalena del Mar', zone: 'LIMA_CENTRO', zoneName: 'Lima Centro' },
  { code: 'MIRAFLORES', name: 'Miraflores', zone: 'LIMA_CENTRO', zoneName: 'Lima Centro' },
  { code: 'PUEBLO_LIBRE', name: 'Pueblo Libre', zone: 'LIMA_CENTRO', zoneName: 'Lima Centro' },
  { code: 'RIMAC', name: 'Rímac', zone: 'LIMA_CENTRO', zoneName: 'Lima Centro' },
  { code: 'SAN_BORJA', name: 'San Borja', zone: 'LIMA_CENTRO', zoneName: 'Lima Centro' },
  { code: 'SAN_ISIDRO', name: 'San Isidro', zone: 'LIMA_CENTRO', zoneName: 'Lima Centro' },
  { code: 'SURQUILLO', name: 'Surquillo', zone: 'LIMA_CENTRO', zoneName: 'Lima Centro' },
  { code: 'LIMA', name: 'Lima', zone: 'LIMA_CENTRO', zoneName: 'Lima Centro' },

  // ── 3. Lima Sur (12 distritos) ──
  { code: 'CHORRILLOS', name: 'Chorrillos', zone: 'LIMA_SUR', zoneName: 'Lima Sur' },
  { code: 'LURIN', name: 'Lurín', zone: 'LIMA_SUR', zoneName: 'Lima Sur' },
  { code: 'PACHACAMAC', name: 'Pachacámac', zone: 'LIMA_SUR', zoneName: 'Lima Sur' },
  { code: 'PUCUSANA', name: 'Pucusana', zone: 'LIMA_SUR', zoneName: 'Lima Sur' },
  { code: 'PUNTA_HERMOSA', name: 'Punta Hermosa', zone: 'LIMA_SUR', zoneName: 'Lima Sur' },
  { code: 'PUNTA_NEGRA', name: 'Punta Negra', zone: 'LIMA_SUR', zoneName: 'Lima Sur' },
  { code: 'SAN_BARTOLO', name: 'San Bartolo', zone: 'LIMA_SUR', zoneName: 'Lima Sur' },
  { code: 'SAN_JUAN_DE_MIRAFLORES', name: 'San Juan de Miraflores', zone: 'LIMA_SUR', zoneName: 'Lima Sur' },
  { code: 'SANTA_MARIA_DEL_MAR', name: 'Santa María del Mar', zone: 'LIMA_SUR', zoneName: 'Lima Sur' },
  { code: 'SANTIAGO_DE_SURCO', name: 'Santiago de Surco', zone: 'LIMA_SUR', zoneName: 'Lima Sur' },
  { code: 'VILLA_EL_SALVADOR', name: 'Villa El Salvador', zone: 'LIMA_SUR', zoneName: 'Lima Sur' },
  { code: 'VILLA_MARIA_DEL_TRIUNFO', name: 'Villa María del Triunfo', zone: 'LIMA_SUR', zoneName: 'Lima Sur' },

  // ── 4. Lima Este (9 distritos) ──
  { code: 'ATE', name: 'Ate', zone: 'LIMA_ESTE', zoneName: 'Lima Este' },
  { code: 'CHACLACAYO', name: 'Chaclacayo', zone: 'LIMA_ESTE', zoneName: 'Lima Este' },
  { code: 'CHOSICA', name: 'Chosica (Lurigancho)', zone: 'LIMA_ESTE', zoneName: 'Lima Este' },
  { code: 'CIENEGUILLA', name: 'Cieneguilla', zone: 'LIMA_ESTE', zoneName: 'Lima Este' },
  { code: 'EL_AGUSTINO', name: 'El Agustino', zone: 'LIMA_ESTE', zoneName: 'Lima Este' },
  { code: 'LA_MOLINA', name: 'La Molina', zone: 'LIMA_ESTE', zoneName: 'Lima Este' },
  { code: 'LURIGANCHO', name: 'Lurigancho', zone: 'LIMA_ESTE', zoneName: 'Lima Este' },
  { code: 'SANTA_ANITA', name: 'Santa Anita', zone: 'LIMA_ESTE', zoneName: 'Lima Este' },
  { code: 'SAN_JUAN_DE_LURIGANCHO', name: 'San Juan de Lurigancho', zone: 'LIMA_ESTE', zoneName: 'Lima Este' },

  // ── 5. Callao (7 distritos) ──
  { code: 'BELLAVISTA', name: 'Bellavista', zone: 'CALLAO', zoneName: 'Callao' },
  { code: 'CALLAO', name: 'Callao (Cercado)', zone: 'CALLAO', zoneName: 'Callao' },
  { code: 'CARMEN_DE_LA_LEGUA', name: 'Carmen de la Legua Reynoso', zone: 'CALLAO', zoneName: 'Callao' },
  { code: 'LA_PERLA', name: 'La Perla', zone: 'CALLAO', zoneName: 'Callao' },
  { code: 'LA_PUNTA', name: 'La Punta', zone: 'CALLAO', zoneName: 'Callao' },
  { code: 'MI_PERU', name: 'Mi Perú', zone: 'CALLAO', zoneName: 'Callao' },
  { code: 'VENTANILLA', name: 'Ventanilla', zone: 'CALLAO', zoneName: 'Callao' },
] as const;
