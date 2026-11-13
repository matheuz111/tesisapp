/**
 * Modelo de los certificados de garantía verificables (sin dependencias de Firebase, para poder probarlo).
 *
 * Seguridad sin servidor: el código del certificado es aleatorio (≈78 bits) y es el id del documento.
 * Las reglas de Firestore permiten leer UN documento si se conoce su id y no permiten listar, por lo que
 * un código no se puede adivinar ni recorrer. El documento público no contiene datos personales completos.
 */

/** Sin caracteres ambiguos (0/O, 1/I/L, U): se puede dictar por teléfono sin confusiones. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
export const CERTIFICATE_CODE_LENGTH = 16;
export const WARRANTY_DAYS = 30;
/** Los registros de escaneo se eliminan a los 12 meses (política TTL sobre `expireAt`). */
export const SCAN_RETENTION_DAYS = 365;

const CODE_PATTERN = /^[A-HJKMNP-TV-Z2-9]{16}$/;

/** Código aleatorio criptográfico. `random` se inyecta para pruebas deterministas. */
export function generateCertificateCode(
  random: (length: number) => Uint8Array = (length) => globalThis.crypto.getRandomValues(new Uint8Array(length)),
): string {
  let code = '';
  // Rechaza bytes que sesgarían la distribución (el alfabeto tiene 30 símbolos).
  const limit = 256 - (256 % ALPHABET.length);
  while (code.length < CERTIFICATE_CODE_LENGTH) {
    for (const byte of random(CERTIFICATE_CODE_LENGTH * 2)) {
      if (byte < limit && code.length < CERTIFICATE_CODE_LENGTH) code += ALPHABET[byte % ALPHABET.length];
    }
  }
  return code;
}

export function isValidCertificateCode(value: string): boolean {
  return CODE_PATTERN.test(value);
}

/** Acepta el código con o sin guiones/prefijo y en minúsculas: "gar-ab12-…" → "AB12…". Devuelve null si no es válido. */
export function normalizeCertificateCode(input: string): string | null {
  const cleaned = input.toUpperCase().replace(/^GAR-/, '').replace(/[^A-Z0-9]/g, '');
  return isValidCertificateCode(cleaned) ? cleaned : null;
}

/** GAR-XXXX-XXXX-XXXX-XXXX, para mostrar e imprimir. */
export function formatCertificateCode(code: string): string {
  return `GAR-${code.match(/.{1,4}/g)?.join('-') ?? code}`;
}

/** Enmascara un nombre para la página pública: "Rosa Quispe" → "Ros*** Qui***". */
export function maskName(name?: string | null): string {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'Cliente';
  return words
    .map((word) => (word.length <= 2 ? `${word[0]}*` : `${word.slice(0, 3)}***`))
    .join(' ');
}

export function buildVerifyUrl(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/verificar/${code}`;
}

export type CertificateState = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

/** Estado efectivo: anulado manda sobre vencido; el vencimiento se calcula con la fecha, sin servidor. */
export function resolveCertificateState(
  certificate: { status: 'ACTIVE' | 'REVOKED'; validUntil: number },
  now: number = Date.now(),
): CertificateState {
  if (certificate.status === 'REVOKED') return 'REVOKED';
  return now > certificate.validUntil ? 'EXPIRED' : 'ACTIVE';
}

/** Día UTC (AAAAMMDD) que usan las reglas de Firestore para limitar el registro a un escaneo por día y certificado. */
export function utcDayKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

export function scanDocId(code: string, date: Date = new Date()): string {
  return `${code}_${utcDayKey(date)}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
