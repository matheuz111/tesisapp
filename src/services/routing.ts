/**
 * Servicio de enrutamiento vehicular para trazado de ruta en vivo (tipo Uber).
 * Utiliza Google Directions API con la clave de entorno y conmuta
 * automáticamente a OSRM (Open Source Routing Machine) si hay algún fallo.
 */

export interface Coordinate {
  latitude: number;
  longitude: number;
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
  route: Coordinate[];
}

let lastCachedRoute: CachedRoute | null = null;
const CACHE_VALIDITY_MS = 20000; // 20 segundos
const MIN_DISTANCE_CHANGE_METERS = 30; // Solo recalcular si se movió más de 30m

/**
 * Consulta la ruta vehicular entre dos coordenadas.
 */
export async function fetchRouteCoordinates(
  origin: Coordinate,
  destination: Coordinate,
  googleApiKey?: string
): Promise<Coordinate[]> {
  if (!origin || !destination) return [];
  if (
    typeof origin.latitude !== 'number' ||
    typeof origin.longitude !== 'number' ||
    typeof destination.latitude !== 'number' ||
    typeof destination.longitude !== 'number'
  ) {
    return [];
  }

  // Verificar si podemos usar la caché
  const now = Date.now();
  if (
    lastCachedRoute &&
    now - lastCachedRoute.timestamp < CACHE_VALIDITY_MS &&
    approximateDistanceMeters(lastCachedRoute.origin, origin) < MIN_DISTANCE_CHANGE_METERS &&
    approximateDistanceMeters(lastCachedRoute.destination, destination) < 10
  ) {
    return lastCachedRoute.route;
  }

  const apiKey = googleApiKey || process.env.EXPO_PUBLIC_GOOGLE_API_KEY;

  // 1. Intentar Google Directions API si la clave está disponible
  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&key=${apiKey}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'OK' && data.routes?.[0]?.overview_polyline?.points) {
          const coords = decodePolyline(data.routes[0].overview_polyline.points);
          if (coords.length > 0) {
            lastCachedRoute = { origin, destination, timestamp: now, route: coords };
            return coords;
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
      if (osrmData.code === 'Ok' && osrmData.routes?.[0]?.geometry?.coordinates) {
        const coords: Coordinate[] = osrmData.routes[0].geometry.coordinates.map(
          ([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng })
        );
        if (coords.length > 0) {
          lastCachedRoute = { origin, destination, timestamp: now, route: coords };
          return coords;
        }
      }
    }
  } catch {
    // Si OSRM también falla (por ejemplo offline total), trazamos la línea recta origen-destino
  }

  // 3. Fallback final: línea directa entre ambos puntos
  const directLine = [origin, destination];
  return directLine;
}
