/**
 * Servicio de enrutamiento vehicular para trazado de ruta en vivo (tipo Uber).
 * Utiliza Google Directions API con la clave de entorno y conmuta
 * automáticamente a OSRM (Open Source Routing Machine) si hay algún fallo.
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface RouteInfo {
  coordinates: Coordinate[];
  distanceMeters: number;
  durationSeconds: number;
  distanceText: string;
  durationText: string;
}

/**
 * Formatea duración en segundos a texto legible (ej. "14 min" o "1 h 10 min")
 */
export function formatDurationText(seconds: number): string {
  if (seconds <= 0) return 'Llegando ahora';
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours} h ${remainingMins} min` : `${hours} h`;
}

/**
 * Formatea distancia en metros a texto legible (ej. "850 m" o "3.4 km")
 */
export function formatDistanceText(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Decodifica una polilínea codificada por Google (Overview Polyline) a un array de coordenadas.
 */
export function decodePolyline(encoded: string): Coordinate[] {
  if (!encoded || typeof encoded !== 'string') return [];
  const points: Coordinate[] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return points;
}

// Distancia en metros aproximada entre dos puntos
function approximateDistanceMeters(c1: Coordinate, c2: Coordinate): number {
  const dLat = (c2.latitude - c1.latitude) * 111320;
  const dLng = (c2.longitude - c1.longitude) * 111320 * Math.cos((c1.latitude * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// Caché en memoria para evitar llamadas redundantes en ráfagas rápidas de GPS
interface CachedRoute {
  origin: Coordinate;
  destination: Coordinate;
  timestamp: number;
  routeInfo: RouteInfo;
}

let lastCachedRoute: CachedRoute | null = null;
const CACHE_VALIDITY_MS = 20000; // 20 segundos
const MIN_DISTANCE_CHANGE_METERS = 30; // Solo recalcular si se movió más de 30m

/**
 * Consulta la ruta vehicular completa y métricas de tiempo estimado (ETA) y distancia.
 */
export async function fetchRouteWithEta(
  origin: Coordinate,
  destination: Coordinate,
  googleApiKey?: string
): Promise<RouteInfo> {
  const emptyResult: RouteInfo = {
    coordinates: [],
    distanceMeters: 0,
    durationSeconds: 0,
    distanceText: '0 km',
    durationText: '0 min',
  };

  if (!origin || !destination) return emptyResult;
  if (
    typeof origin.latitude !== 'number' ||
    typeof origin.longitude !== 'number' ||
    typeof destination.latitude !== 'number' ||
    typeof destination.longitude !== 'number'
  ) {
    return emptyResult;
  }

  // Verificar si podemos usar la caché
  const now = Date.now();
  if (
    lastCachedRoute &&
    now - lastCachedRoute.timestamp < CACHE_VALIDITY_MS &&
    approximateDistanceMeters(lastCachedRoute.origin, origin) < MIN_DISTANCE_CHANGE_METERS &&
    approximateDistanceMeters(lastCachedRoute.destination, destination) < 10
  ) {
    return lastCachedRoute.routeInfo;
  }

  const apiKey = googleApiKey || process.env.EXPO_PUBLIC_GOOGLE_API_KEY;

  // 1. Intentar Google Directions API si la clave está disponible
  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&key=${apiKey}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const route = data.routes?.[0];
        const leg = route?.legs?.[0];
        if (data.status === 'OK' && route?.overview_polyline?.points) {
          const coords = decodePolyline(route.overview_polyline.points);
          if (coords.length > 0) {
            const distanceMeters = leg?.distance?.value || approximateDistanceMeters(origin, destination);
            const durationSeconds = leg?.duration?.value || Math.round((distanceMeters / 1000 / 25) * 3600);
            const routeInfo: RouteInfo = {
              coordinates: coords,
              distanceMeters,
              durationSeconds,
              distanceText: leg?.distance?.text || formatDistanceText(distanceMeters),
              durationText: leg?.duration?.text || formatDurationText(durationSeconds),
            };
            lastCachedRoute = { origin, destination, timestamp: now, routeInfo };
            return routeInfo;
          }
        }
      }
    } catch {
      // Si Google falla o no responde, continuar al fallback OSRM
    }
  }

  // 2. Fallback resiliente: OSRM (Open Source Routing Machine)
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson`;
    const osrmRes = await fetch(osrmUrl);
    if (osrmRes.ok) {
      const osrmData = await osrmRes.json();
      const route = osrmData.routes?.[0];
      if (osrmData.code === 'Ok' && route?.geometry?.coordinates) {
        const coords: Coordinate[] = route.geometry.coordinates.map(
          ([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng })
        );
        if (coords.length > 0) {
          const distanceMeters = Math.round(route.distance || approximateDistanceMeters(origin, destination));
          const durationSeconds = Math.round(route.duration || (distanceMeters / 1000 / 25) * 3600);
          const routeInfo: RouteInfo = {
            coordinates: coords,
            distanceMeters,
            durationSeconds,
            distanceText: formatDistanceText(distanceMeters),
            durationText: formatDurationText(durationSeconds),
          };
          lastCachedRoute = { origin, destination, timestamp: now, routeInfo };
          return routeInfo;
        }
      }
    }
  } catch {
    // Si OSRM también falla (por ejemplo offline total), trazamos la línea recta origen-destino
  }

  // 3. Fallback final: estimación euclidiana urbana (factor 1.3 de calles y 25 km/h)
  const directDistance = approximateDistanceMeters(origin, destination);
  const estimatedStreetDistance = Math.round(directDistance * 1.3);
  const estimatedDuration = Math.max(60, Math.round((estimatedStreetDistance / 1000 / 25) * 3600));
  const fallbackInfo: RouteInfo = {
    coordinates: [origin, destination],
    distanceMeters: estimatedStreetDistance,
    durationSeconds: estimatedDuration,
    distanceText: formatDistanceText(estimatedStreetDistance),
    durationText: formatDurationText(estimatedDuration),
  };
  return fallbackInfo;
}

/**
 * Consulta la ruta vehicular entre dos coordenadas (compatibilidad hacia atrás).
 */
export async function fetchRouteCoordinates(
  origin: Coordinate,
  destination: Coordinate,
  googleApiKey?: string
): Promise<Coordinate[]> {
  const info = await fetchRouteWithEta(origin, destination, googleApiKey);
  return info.coordinates;
}
