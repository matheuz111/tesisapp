/**
 * Entrada de solicitudes por WhatsApp (Google Forms → Google Sheets → Firestore).
 *
 * La hoja de cálculo la llena el cliente, así que NADA de lo que llega es confiable: este módulo
 * normaliza y valida cada campo antes de crear la solicitud oficial. Es puro (sin Firebase) para poder probarlo.
 */

export type IntakeUrgency = 'NOW' | 'TODAY' | 'SCHEDULED';

export type SpecialtyId = 'Gasfitero' | 'Electricista' | 'Pintor' | 'Carpintero' | 'Albañil' | 'Cerrajero' | 'Tecnico' | 'Otro';

export interface RawIntake {
  clientName?: unknown;
  clientPhone?: unknown;
  specialty?: unknown;
  district?: unknown;
  address?: unknown;
  addressReference?: unknown;
  description?: unknown;
  urgency?: unknown;
  preferredDate?: unknown;
  preferredTime?: unknown;
}

export interface NormalizedIntake {
  clientName: string;
  clientPhone: string;
  specialty: SpecialtyId;
  district: string;
  address: string;
  addressReference: string;
  description: string;
  urgency: IntakeUrgency;
  preferredDate: string | null;
  preferredTime: string | null;
}

export type IntakeResult = { ok: true; value: NormalizedIntake } | { ok: false; errors: string[] };

/** Minúsculas, sin tildes ni signos: "Gasfitería y Plomería" → "gasfiteria y plomeria". */
function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9/ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Texto plano: sin caracteres de control, espacios sobrantes ni exceso de largo. */
function clean(value: unknown, max: number): string {
  if (value === null || value === undefined) return '';
  // Los caracteres de control (código < 32 o 127) pasan a espacio sin usar una expresión regular con ellos.
  const text = Array.from(String(value), (char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : char;
  }).join('');
  return text.replace(/\s+/g, ' ').trim().slice(0, max);
}

const SPECIALTY_RULES: Array<[RegExp, SpecialtyId]> = [
  [/gasfit|plom|sanitari/, 'Gasfitero'],
  [/electric|luz|cortocircuito/, 'Electricista'],
  // Carpintería antes que pintura: "carpintería" contiene "pint".
  [/carpint|madera|mueble/, 'Carpintero'],
  [/pint/, 'Pintor'],
  [/alban|construc|muro/, 'Albañil'],
  [/cerraj|llave|chapa/, 'Cerrajero'],
  [/linea blanca|electrodomest|tecnic|soporte|lavadora|refriger|televis/, 'Tecnico'],
];

export function normalizeSpecialty(raw: unknown): SpecialtyId {
  const text = fold(clean(raw, 80));
  for (const [pattern, id] of SPECIALTY_RULES) if (pattern.test(text)) return id;
  return 'Otro';
}

export function normalizeUrgency(raw: unknown): IntakeUrgency {
  const text = fold(clean(raw, 60));
  if (/^now$|urgent|emergenc|antes posible|ahora/.test(text)) return 'NOW';
  if (/^scheduled$|program|otra fecha|coordinar|posterior|agendar/.test(text)) return 'SCHEDULED';
  return 'TODAY';
}

/** Teléfono peruano en el formato que usa el panel (sin +51): "+51 999 888 777" → "999888777". null si no es utilizable. */
export function normalizePhone(raw: unknown): string | null {
  let digits = clean(raw, 40).replace(/\D/g, '');
  if (digits.startsWith('0051')) digits = digits.slice(4);
  else if (digits.startsWith('51') && digits.length >= 11) digits = digits.slice(2);
  return digits.length >= 7 && digits.length <= 11 ? digits : null;
}

/** Acepta AAAA-MM-DD y DD/MM/AAAA; devuelve AAAA-MM-DD o null si no es una fecha real. */
export function normalizeDate(raw: unknown): string | null {
  const text = clean(raw, 20);
  let year: number;
  let month: number;
  let day: number;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  const latin = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (latin) {
    day = Number(latin[1]);
    month = Number(latin[2]);
    year = Number(latin[3]);
  } else {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function normalizeTime(raw: unknown): string | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(clean(raw, 10));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` : null;
}

/** `today` (AAAA-MM-DD) se inyecta para pruebas deterministas. */
export function normalizeIntake(raw: RawIntake, today: string = new Date().toISOString().slice(0, 10)): IntakeResult {
  const errors: string[] = [];

  const clientName = clean(raw.clientName, 80);
  if (clientName.length < 2) errors.push('Falta el nombre del cliente.');

  const clientPhone = normalizePhone(raw.clientPhone);
  if (!clientPhone) errors.push('El teléfono no es válido.');

  const district = clean(raw.district, 60);
  if (district.length < 2) errors.push('Falta el distrito.');

  const address = clean(raw.address, 160);
  if (address.length < 5) errors.push('La dirección es muy corta.');

  const description = clean(raw.description, 500);
  if (description.length < 10) errors.push('La descripción del problema es muy corta (mínimo 10 caracteres).');

  const urgency = normalizeUrgency(raw.urgency);
  let preferredDate: string | null = null;
  let preferredTime: string | null = null;
  if (urgency === 'SCHEDULED') {
    preferredDate = normalizeDate(raw.preferredDate);
    if (!preferredDate) errors.push('Falta una fecha válida para programar el servicio.');
    else if (preferredDate < today) errors.push('La fecha para programar ya pasó.');
    preferredTime = normalizeTime(raw.preferredTime);
  }

  if (errors.length > 0 || !clientPhone) return { ok: false, errors };
  return {
    ok: true,
    value: {
      clientName,
      clientPhone,
      specialty: normalizeSpecialty(raw.specialty),
      district,
      address,
      addressReference: clean(raw.addressReference, 120),
      description,
      urgency,
      preferredDate,
      preferredTime,
    },
  };
}
