import {
  Timestamp,
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { ServiceRequest } from '../types';
import {
  WARRANTY_DAYS,
  SCAN_RETENTION_DAYS,
  addDays,
  buildVerifyUrl,
  generateCertificateCode,
  maskName,
  scanDocId,
} from './warrantyCertificateModel';

/** Certificado tal como lo ve la página pública: sin datos personales completos. */
export interface WarrantyCertificate {
  code: string;
  requestId: string;
  serviceLabel: string;
  clientMasked: string;
  issuedAt: number | null;
  validFrom: number;
  validUntil: number;
  status: 'ACTIVE' | 'REVOKED';
  revokedAt: number | null;
}

const toMillis = (value: unknown): number | null => {
  const v = value as { toMillis?: () => number } | null | undefined;
  return typeof v?.toMillis === 'function' ? v.toMillis() : null;
};

function fromSnapshot(data: Record<string, unknown>): WarrantyCertificate {
  return {
    code: String(data.code),
    requestId: String(data.requestId ?? ''),
    serviceLabel: String(data.serviceLabel ?? 'Servicio técnico'),
    clientMasked: String(data.clientMasked ?? 'Cliente'),
    issuedAt: toMillis(data.issuedAt),
    validFrom: toMillis(data.validFrom) ?? 0,
    validUntil: toMillis(data.validUntil) ?? 0,
    status: data.status === 'REVOKED' ? 'REVOKED' : 'ACTIVE',
    revokedAt: toMillis(data.revokedAt),
  };
}

/** Dirección pública de la página de verificación. En producción es el dominio de Firebase Hosting. */
export function verifyBaseUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_BASE_URL as string | undefined;
  return (configured && configured.trim()) || window.location.origin;
}

export function verifyUrlFor(code: string): string {
  return buildVerifyUrl(verifyBaseUrl(), code);
}

// ── Central (requiere sesión de operador; las reglas lo imponen) ──

/** Certificado vigente de la solicitud o, si no hay, el más reciente (por ejemplo uno anulado). */
export async function findCertificateForRequest(requestId: string): Promise<WarrantyCertificate | null> {
  const snapshot = await getDocs(query(collection(db, 'warranty_certificates'), where('requestId', '==', requestId)));
  const all = snapshot.docs.map((d) => fromSnapshot(d.data()));
  if (all.length === 0) return null;
  const active = all.filter((c) => c.status === 'ACTIVE');
  const pool = active.length > 0 ? active : all;
  return pool.sort((a, b) => (b.issuedAt ?? 0) - (a.issuedAt ?? 0))[0];
}

export async function issueCertificate(request: ServiceRequest): Promise<WarrantyCertificate> {
  const operatorId = auth.currentUser?.uid;
  if (!operatorId) throw new Error('Inicia sesión como operador para emitir certificados.');
  if (!['COMPLETED', 'VALIDATED'].includes(request.status)) {
    throw new Error('Solo se emite garantía para servicios culminados o validados.');
  }

  const baseDate = [request.validatedAt, request.finishedAt, request.createdAt]
    .map((value) => (value?.toDate ? value.toDate() : value ? new Date(value) : null))
    .find((date): date is Date => !!date && !Number.isNaN(date.getTime())) ?? new Date();
  const validUntil = addDays(baseDate, WARRANTY_DAYS);
  const code = generateCertificateCode();

  await setDoc(doc(db, 'warranty_certificates', code), {
    code,
    requestId: request.id,
    serviceLabel: request.serviceLabel || request.specialty || 'Servicio técnico',
    clientMasked: maskName(request.clientName),
    issuedAt: serverTimestamp(),
    validFrom: Timestamp.fromDate(baseDate),
    validUntil: Timestamp.fromDate(validUntil),
    status: 'ACTIVE',
    issuedBy: operatorId,
  });

  return {
    code,
    requestId: request.id,
    serviceLabel: request.serviceLabel || request.specialty || 'Servicio técnico',
    clientMasked: maskName(request.clientName),
    issuedAt: Date.now(),
    validFrom: baseDate.getTime(),
    validUntil: validUntil.getTime(),
    status: 'ACTIVE',
    revokedAt: null,
  };
}

/** Anula el certificado (no se puede deshacer; se emite uno nuevo). El motivo queda solo para la central. */
export async function revokeCertificate(code: string, reason: string): Promise<void> {
  const operatorId = auth.currentUser?.uid;
  if (!operatorId) throw new Error('Inicia sesión como operador para anular certificados.');
  const text = reason.trim();
  if (text.length < 5) throw new Error('Escribe el motivo de la anulación (mínimo 5 caracteres).');

  const batch = writeBatch(db);
  batch.update(doc(db, 'warranty_certificates', code), {
    status: 'REVOKED',
    revokedAt: serverTimestamp(),
    revokedBy: operatorId,
  });
  batch.set(doc(db, 'warranty_certificates', code, 'admin', 'revocation'), {
    reason: text.slice(0, 300),
    revokedAt: serverTimestamp(),
    revokedBy: operatorId,
  });
  await batch.commit();
}

/** Cuántos días distintos se escaneó este certificado (el registro guarda un documento por día). */
export async function countScanDays(code: string): Promise<number> {
  const snapshot = await getCountFromServer(query(collection(db, 'warranty_scans'), where('certificateId', '==', code)));
  return snapshot.data().count;
}

// ── Público (sin sesión) ──

export async function getPublicCertificate(code: string): Promise<WarrantyCertificate | null> {
  const snapshot = await getDoc(doc(db, 'warranty_certificates', code));
  return snapshot.exists() ? fromSnapshot(snapshot.data()) : null;
}

/**
 * Registra el escaneo (un documento por certificado y día; las reglas impiden más). Es un registro de
 * cortesía: si falla (sin red, ya registrado hoy) no afecta a la verificación.
 */
export async function registerScan(code: string): Promise<void> {
  const sessionKey = `warranty-scan:${code}`;
  try {
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, '1');
    await setDoc(doc(db, 'warranty_scans', scanDocId(code)), {
      certificateId: code,
      at: serverTimestamp(),
      expireAt: Timestamp.fromDate(addDays(new Date(), SCAN_RETENTION_DAYS)),
    });
  } catch {
    // Ya registrado hoy o sin conexión: se ignora a propósito.
  }
}

/**
 * Mensaje claro para un error de Firestore. El caso más común al estrenar los certificados es que las
 * reglas nuevas todavía no están publicadas: Firestore responde "permission-denied", que no es un problema de red.
 */
export function describeCertificateError(error: unknown, fallback: string): string {
  const code = (error as { code?: string } | null)?.code;
  if (code === 'permission-denied') {
    return 'Firestore no permite esta operación todavía. Publica las reglas nuevas (firestore.rules) en Firebase y vuelve a intentarlo.';
  }
  if (code === 'unavailable') return 'Sin conexión con Firebase. Revisa tu internet y vuelve a intentarlo.';
  return error instanceof Error && error.message ? error.message : fallback;
}

const PURGE_BATCH = 200;

/**
 * Borra los registros de escaneo con más de 12 meses (su campo expireAt ya pasó). Sin facturación no existe
 * la política TTL de Firestore, así que la central hace la limpieza: se ejecuta en silencio, como máximo una vez
 * al día por navegador, y las reglas solo permiten borrar registros vencidos. Devuelve cuántos borró.
 */
export async function purgeExpiredScans(): Promise<number> {
  const sessionKey = `warranty-scan-purge:${new Date().toISOString().slice(0, 10)}`;
  try {
    if (localStorage.getItem(sessionKey)) return 0;
    localStorage.setItem(sessionKey, '1');
    const expired = await getDocs(
      query(collection(db, 'warranty_scans'), where('expireAt', '<', Timestamp.now()), limit(PURGE_BATCH)),
    );
    if (expired.empty) return 0;
    const batch = writeBatch(db);
    expired.docs.forEach((document) => batch.delete(document.ref));
    await batch.commit();
    return expired.size;
  } catch {
    // Sin permisos o sin conexión: se reintenta mañana.
    return 0;
  }
}
