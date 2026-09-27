import { geohashForLocation, distanceBetween } from 'geofire-common';
import { doc, setDoc, serverTimestamp, Firestore } from 'firebase/firestore';
import type {
  ProviderPresence,
  ProviderOperationalStatus,
  OperationalZone,
} from '../types/canonical';
import { resolveOperationalZone } from '../types/canonical';

/**
 * Computes geohash string for given coordinates.
 */
export function computeGeohash(latitude: number, longitude: number, precision: number = 9): string {
  if (isNaN(latitude) || isNaN(longitude)) return '';
  return geohashForLocation([latitude, longitude], precision);
}

/**
 * Validates geographical coordinates range.
 */
export function validateCoordinates(latitude: number, longitude: number): boolean {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Checks whether a presence record has become stale.
 * Default threshold is 90 seconds (coherent with 45s stationary heartbeat).
 */
export function isPresenceStale(lastSeenAt: unknown, thresholdSeconds: number = 90): boolean {
  if (!lastSeenAt) return true;
  let timestampMs: number;

  const candidate = lastSeenAt as Record<string, unknown>;
  if (typeof candidate?.toMillis === 'function') {
    timestampMs = (candidate.toMillis as () => number)();
  } else if (typeof candidate?.seconds === 'number') {
    timestampMs = candidate.seconds * 1000;
  } else if (typeof (lastSeenAt as Date)?.getTime === 'function') {
    timestampMs = (lastSeenAt as Date).getTime();
  } else if (typeof lastSeenAt === 'number') {
    timestampMs = lastSeenAt;
  } else if (typeof lastSeenAt === 'string') {
    timestampMs = new Date(lastSeenAt).getTime();
  } else {
    return true;
  }

  const ageSeconds = (Date.now() - timestampMs) / 1000;
  return isNaN(ageSeconds) || ageSeconds > thresholdSeconds;
}

/**
 * Calculates straight line distance in kilometers.
 */
export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  if (!validateCoordinates(lat1, lng1) || !validateCoordinates(lat2, lng2)) return 0;
  return distanceBetween([lat1, lng1], [lat2, lng2]);
}

export interface PublishPresenceParams {
  providerId: string;
  providerName: string;
  providerPhone?: string;
  status: ProviderOperationalStatus;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  specialties?: string[];
  zones?: OperationalZone[];
  district?: string;
  activeRequestId?: string | null;
  batteryLevel?: number | null;
}

/**
 * Builds the canonical payload for `provider_presence/{providerId}`.
 */
export function buildProviderPresencePayload(params: PublishPresenceParams): ProviderPresence {
  if (!validateCoordinates(params.latitude, params.longitude)) {
    throw new Error(`Coordenadas inválidas: lat=${params.latitude}, lng=${params.longitude}`);
  }

  const geohash = computeGeohash(params.latitude, params.longitude);
  const inferredZone = resolveOperationalZone({
    district: params.district,
    latitude: params.latitude,
    longitude: params.longitude,
  });

  const zones: OperationalZone[] = params.zones && params.zones.length > 0
    ? params.zones
    : (inferredZone !== 'UNKNOWN' ? [inferredZone] : ['UNKNOWN']);

  return {
    providerId: params.providerId,
    providerName: params.providerName,
    providerPhone: params.providerPhone || '',
    status: params.status,
    location: {
      latitude: params.latitude,
      longitude: params.longitude,
    },
    geohash,
    accuracy: typeof params.accuracy === 'number' ? params.accuracy : null,
    lastSeenAt: serverTimestamp(),
    specialties: params.specialties || ['General'],
    zones,
    activeRequestId: params.activeRequestId || null,
    batteryLevel: typeof params.batteryLevel === 'number' ? params.batteryLevel : null,
    updatedAt: serverTimestamp(),
  };
}

/**
 * Publishes provider presence directly to Firestore.
 */
export async function updateProviderPresence(
  db: Firestore,
  params: PublishPresenceParams
): Promise<void> {
  const payload = buildProviderPresencePayload(params);
  const presenceRef = doc(db, 'provider_presence', params.providerId);
  await setDoc(presenceRef, payload, { merge: true });
}

/**
 * Adaptive publisher that adjusts interval dynamically:
 * - Stationary (moved < 25m): publishes heartbeat every 45s.
 * - In motion (moved >= 25m): publishes every 15s for high precision.
 * - First sample publishes immediately.
 * - Concurrency guard prevents duplicate writes.
 * - Bounded backoff retry on failure.
 */
export function createAdaptivePresencePublisher(
  onPublish: (coords: { latitude: number; longitude: number; accuracy?: number | null }) => Promise<void>,
  options: {
    stationaryIntervalMs?: number;
    motionIntervalMs?: number;
    motionThresholdMeters?: number;
    now?: () => number;
    maxRetries?: number;
  } = {}
) {
  const stationaryIntervalMs = options.stationaryIntervalMs ?? 45000;
  const motionIntervalMs = options.motionIntervalMs ?? 15000;
  const motionThresholdKm = (options.motionThresholdMeters ?? 25) / 1000;
  const now = options.now ?? Date.now;
  const maxRetries = options.maxRetries ?? 3;

  let lastCoords: { latitude: number; longitude: number } | null = null;
  let lastPublishTime = 0;
  let isPublishing = false;
  let disposed = false;
  let pendingRetryTimeout: ReturnType<typeof setTimeout> | null = null;

  async function executePublish(coords: { latitude: number; longitude: number; accuracy?: number | null }, attempt = 1) {
    if (disposed) return;
    isPublishing = true;
    try {
      await onPublish(coords);
      lastCoords = { latitude: coords.latitude, longitude: coords.longitude };
      lastPublishTime = now();
    } catch (err) {
      console.warn(`[AdaptivePresencePublisher] Publish attempt ${attempt} failed:`, err);
      if (attempt < maxRetries && !disposed) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        pendingRetryTimeout = setTimeout(() => {
          if (!disposed) {
            void executePublish(coords, attempt + 1);
          }
        }, backoffMs);
      }
    } finally {
      isPublishing = false;
    }
  }

  return {
    async onLocationSample(coords: { latitude: number; longitude: number; accuracy?: number | null }) {
      if (disposed || isPublishing) return;

      const currentTime = now();
      let isMoving = false;

      if (lastCoords) {
        const distKm = distanceBetween(
          [lastCoords.latitude, lastCoords.longitude],
          [coords.latitude, coords.longitude]
        );
        isMoving = distKm >= motionThresholdKm;
      } else {
        isMoving = true;
      }

      const intervalNeeded = isMoving ? motionIntervalMs : stationaryIntervalMs;
      const timeSinceLastPublish = currentTime - lastPublishTime;

      if (timeSinceLastPublish < intervalNeeded && lastCoords !== null) {
        return; // Throttled
      }

      if (pendingRetryTimeout) {
        clearTimeout(pendingRetryTimeout);
        pendingRetryTimeout = null;
      }

      await executePublish(coords, 1);
    },
    dispose() {
      disposed = true;
      if (pendingRetryTimeout) {
        clearTimeout(pendingRetryTimeout);
        pendingRetryTimeout = null;
      }
    },
  };
}
