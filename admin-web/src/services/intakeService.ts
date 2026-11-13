import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { SPECIALTIES_CATALOG } from '../config/operationalConfig';
import { resolveOperationalZone } from '../types/canonical';
import { getDefaultVisitFee, getFormattedVisitFee } from './pricingPolicyService';
import { normalizeIntake, type RawIntake } from './intakeModel';

export interface IntakeEntry {
  id: string;
  data: RawIntake & { sourceRow?: number };
}

export type ConversionResult =
  | { kind: 'created'; code: string; requestId: string; clientName: string; district: string; urgent: boolean }
  | { kind: 'rejected'; errors: string[]; clientName: string }
  | { kind: 'skipped' };

/** PIN de seguridad de 4 dígitos con el generador criptográfico del navegador (no Math.random). */
function randomPin(): string {
  const limit = 4294967296 - (4294967296 % 9000);
  const buffer = new Uint32Array(1);
  do { globalThis.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
  return String(1000 + (buffer[0] % 9000));
}

/** Escucha las entradas nuevas (status NEW). Una sola condición: no necesita índice compuesto. */
export function subscribeNewIntakes(onData: (entries: IntakeEntry[]) => void, onError?: (error: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'intake_requests'), where('status', '==', 'NEW'), limit(25)),
    (snapshot) => onData(snapshot.docs.map((d) => ({ id: d.id, data: d.data() as IntakeEntry['data'] }))),
    (error) => onError?.(error),
  );
}

/**
 * Convierte una entrada de WhatsApp en una solicitud oficial. Todo ocurre en UNA transacción:
 * se reclama la entrada (solo si sigue NEW), se toma el correlativo, se crea la solicitud con su
 * historial y se marca la entrada como procesada. Si dos paneles abiertos intentan lo mismo, solo uno gana.
 */
export async function convertIntake(entry: IntakeEntry, operator: { uid: string; name: string }): Promise<ConversionResult> {
  return runTransaction(db, async (transaction) => {
    const intakeRef = doc(db, 'intake_requests', entry.id);
    const intakeSnap = await transaction.get(intakeRef);
    if (!intakeSnap.exists() || intakeSnap.data().status !== 'NEW') return { kind: 'skipped' } as ConversionResult;
    const raw = intakeSnap.data();
    const checked = normalizeIntake(raw);

    // Entrada inválida: se cierra como RECHAZADA con los motivos, para que no se reintente y la central pueda revisarla.
    if (!checked.ok) {
      transaction.update(intakeRef, {
        status: 'REJECTED',
        errors: checked.errors,
        processedBy: operator.uid,
        processedAt: serverTimestamp(),
      });
      return { kind: 'rejected', errors: checked.errors, clientName: String(raw.clientName ?? '').slice(0, 60) } as ConversionResult;
    }

    const value = checked.value;
    const counterRef = doc(db, 'counters', 'service_requests');
    const counterSnap = await transaction.get(counterRef);
    const nextNumber = counterSnap.exists() ? (counterSnap.data().current || 0) + 1 : 1;
    if (counterSnap.exists()) transaction.update(counterRef, { current: nextNumber, updatedAt: serverTimestamp() });
    else transaction.set(counterRef, { current: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    const code = `SOL-POST-${String(nextNumber).padStart(4, '0')}`;

    const zone = resolveOperationalZone({ district: value.district });
    const requestRef = doc(collection(db, 'service_requests'));
    transaction.set(requestRef, {
      code,
      intakeChannel: 'WHATSAPP',
      origin: 'CLIENT',
      intakeSource: 'GOOGLE_FORM',
      intakeId: entry.id,
      datosCompletos: true,
      status: 'PENDING_ASSIGNMENT',
      clientName: value.clientName,
      clientPhone: value.clientPhone,
      specialty: value.specialty,
      serviceLabel: SPECIALTIES_CATALOG.find((s) => s.id === value.specialty)?.label || value.specialty,
      priority: value.urgency === 'NOW' ? 'HIGH' : 'NORMAL',
      urgency: value.urgency,
      preferredDate: value.preferredDate,
      preferredTime: value.preferredTime,
      district: value.district,
      zone,
      address: value.address,
      addressReference: value.addressReference,
      description: value.description,
      technicalVisitFee: getDefaultVisitFee(zone, value.specialty),
      price_agreed: getFormattedVisitFee(zone, value.specialty),
      securityPin: randomPin(),
      // La hora real de llegada del pedido (no la de la conversión): así T_RSP mide la espera verdadera del cliente.
      createdAt: raw.createdAt ?? serverTimestamp(),
      intakeConvertedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    transaction.set(doc(collection(db, 'service_requests', requestRef.id, 'status_history')), {
      fromStatus: null,
      toStatus: 'PENDING_ASSIGNMENT',
      actorId: operator.uid,
      actorRole: 'OPERATOR',
      timestamp: serverTimestamp(),
      notes: `Solicitud recibida por formulario de WhatsApp${raw.sourceRow ? ` (fila ${raw.sourceRow})` : ''} [Urgencia: ${value.urgency}]. Registrada desde el panel de ${operator.name}.`,
    });

    transaction.update(intakeRef, {
      status: 'PROCESSED',
      requestId: requestRef.id,
      requestCode: code,
      processedBy: operator.uid,
      processedAt: serverTimestamp(),
    });

    return {
      kind: 'created',
      code,
      requestId: requestRef.id,
      clientName: value.clientName,
      district: value.district,
      urgent: value.urgency === 'NOW',
    } as ConversionResult;
  });
}
