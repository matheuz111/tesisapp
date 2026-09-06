export const MONITORED_STATUSES = ['PENDING_ASSIGNMENT', 'REQUIRES_REASSIGNMENT', 'PENDING', 'ACCEPTED', 'IN_PROGRESS'];

export function validCoordinate(value: any): boolean {
  return !!value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
    && Math.abs(value.latitude) <= 90 && Math.abs(value.longitude) <= 180;
}

// Firestore GeoPoint exposes getters. Spreading it does not produce the
// latitude/longitude fields expected by the native map bridge.
export function toMapCoordinate(value: any): { latitude: number; longitude: number } | null {
  return validCoordinate(value) ? { latitude: value.latitude, longitude: value.longitude } : null;
}

export function locationStatus(value: any, now: number): string {
  if (!validCoordinate(value)) return 'Sin GPS compartido';
  const received = value.updatedAt?.toMillis?.();
  if (!received || !Number.isFinite(value.capturedAt)) return 'Ubicación pendiente de confirmar';
  // Queued offline writes must not make an old GPS fix look live.
  const timestamp = Math.min(received, value.capturedAt);
  const age = Math.max(0, Math.floor((now - timestamp) / 1000));
  const accuracy = Number.isFinite(value.accuracy) ? `${Math.round(value.accuracy)} m` : 'no disponible';
  return `${age <= 45 ? 'GPS reciente' : 'Sin actualización reciente'} · ${new Date(timestamp).toLocaleTimeString('es-PE')} · precisión ${accuracy}`;
}
