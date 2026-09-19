import {
  collection,
  doc,
  Firestore,
  serverTimestamp,
  Transaction,
  writeBatch,
  WriteBatch,
} from 'firebase/firestore';

export type ServiceStatus =
  | 'PENDING_ASSIGNMENT'
  | 'QUOTED'
  | 'PENDING'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'VALIDATED'
  | 'ARCHIVED'
  | 'CANCELLED_BY_CLIENT'
  | 'CANCELLED_BY_PROVIDER'
  | 'REQUIRES_REASSIGNMENT';

export type ActorRole = 'CLIENT' | 'OPERATOR' | 'PROVIDER';

export interface TransitionActor {
  uid: string;
  role: ActorRole | 'ADMIN';
}

export interface TransitionOptions {
  fromStatus?: ServiceStatus | string | null;
  notes?: string;
  extraFields?: Record<string, any>;
}

/**
 * Mapea automáticamente los campos y marcas de tiempo camelCase requeridos
 * por el Contrato de Datos de la tesis según el nuevo estado.
 */
export function getAutomaticTransitionFields(nextStatus: ServiceStatus): Record<string, any> {
  const fields: Record<string, any> = {
    status: nextStatus,
    updatedAt: serverTimestamp(),
  };

  switch (nextStatus) {
    case 'QUOTED':
      fields.firstResponseAt = serverTimestamp();
      fields.quotedAt = serverTimestamp();
      break;
    case 'PENDING':
      fields.assignedAt = serverTimestamp();
      break;
    case 'ACCEPTED':
      fields.acceptedAt = serverTimestamp();
      break;
    case 'IN_PROGRESS':
      fields.startedAt = serverTimestamp();
      fields.pinValidatedAt = serverTimestamp();
      fields.serviceStarted = true;
      break;
    case 'COMPLETED':
      fields.finishedAt = serverTimestamp();
      fields.finished_at = serverTimestamp(); // compatibilidad legacy
      break;
    case 'VALIDATED':
    case 'ARCHIVED':
      fields.validatedAt = serverTimestamp();
      break;
    case 'CANCELLED_BY_CLIENT':
    case 'CANCELLED_BY_PROVIDER':
      fields.cancelledAt = serverTimestamp();
      break;
  }

  return fields;
}

/**
 * Normaliza el rol del actor al formato requerido por el contrato: 'CLIENT' | 'OPERATOR' | 'PROVIDER'
 */
function normalizeActorRole(role: ActorRole | 'ADMIN'): ActorRole {
  if (role === 'ADMIN') return 'OPERATOR';
  return role;
}

/**
 * Agrega a un batch de Firestore la actualización de estado y la inserción
 * en la subcolección inmutable `service_requests/{id}/status_history/{historyId}`.
 */
export function applyTransitionToBatch(
  batch: WriteBatch,
  db: Firestore,
  requestId: string,
  nextStatus: ServiceStatus,
  actor: TransitionActor,
  options?: TransitionOptions
): void {
  const requestRef = doc(db, 'service_requests', requestId);
  const historyRef = doc(collection(db, 'service_requests', requestId, 'status_history'));

  const autoFields = getAutomaticTransitionFields(nextStatus);
  const mergedFields = {
    ...autoFields,
    ...(options?.extraFields || {}),
  };

  // Actualizar documento principal
  batch.update(requestRef, mergedFields);

  // Crear entrada inmutable de auditoría
  batch.set(historyRef, {
    fromStatus: options?.fromStatus ?? null,
    toStatus: nextStatus,
    actorId: actor.uid,
    actorRole: normalizeActorRole(actor.role),
    timestamp: serverTimestamp(),
    notes: options?.notes || `Transición a ${nextStatus}`,
  });
}

/**
 * Agrega a una transacción de Firestore la actualización de estado y la inserción
 * en la subcolección inmutable `service_requests/{id}/status_history/{historyId}`.
 */
export function applyTransitionToTransaction(
  transaction: Transaction,
  db: Firestore,
  requestId: string,
  nextStatus: ServiceStatus,
  actor: TransitionActor,
  options?: TransitionOptions
): void {
  const requestRef = doc(db, 'service_requests', requestId);
  const historyRef = doc(collection(db, 'service_requests', requestId, 'status_history'));

  const autoFields = getAutomaticTransitionFields(nextStatus);
  const mergedFields = {
    ...autoFields,
    ...(options?.extraFields || {}),
  };

  transaction.update(requestRef, mergedFields);

  transaction.set(historyRef, {
    fromStatus: options?.fromStatus ?? null,
    toStatus: nextStatus,
    actorId: actor.uid,
    actorRole: normalizeActorRole(actor.role),
    timestamp: serverTimestamp(),
    notes: options?.notes || `Transición a ${nextStatus}`,
  });
}

/**
 * Función central unificada para ejecutar una transición de estado con auditoría científica.
 * Crea un writeBatch() atómico que actualiza el documento principal y añade el registro en status_history.
 *
 * @param db Instancia de Firestore
 * @param requestId ID del servicio
 * @param nextStatus Nuevo estado a asignar
 * @param actor Actor que ejecuta la transición (con uid y rol)
 * @param options Opciones adicionales (fromStatus, notes, extraFields)
 */
export async function transitionServiceStatus(
  db: Firestore,
  requestId: string,
  nextStatus: ServiceStatus,
  actor: TransitionActor,
  options?: TransitionOptions
): Promise<void> {
  const batch = writeBatch(db);
  applyTransitionToBatch(batch, db, requestId, nextStatus, actor, options);
  await batch.commit();
}

/**
 * Registra el hito inicial de creación en la subcolección status_history
 */
export function createInitialStatusHistoryRecord(
  batch: WriteBatch,
  db: Firestore,
  requestId: string,
  actor: TransitionActor,
  notes: string = 'Solicitud creada desde app móvil'
): void {
  const historyRef = doc(collection(db, 'service_requests', requestId, 'status_history'));
  batch.set(historyRef, {
    fromStatus: null,
    toStatus: 'PENDING_ASSIGNMENT' as ServiceStatus,
    actorId: actor.uid,
    actorRole: normalizeActorRole(actor.role),
    timestamp: serverTimestamp(),
    notes,
  });
}
