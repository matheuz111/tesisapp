/**
 * CANONICAL DOMAIN TYPES — Maestro a Domicilio Perú S.A.C. (Admin Web)
 * 
 * Synchronized with mobile root canonical definitions.
 */

export type OperationalZone =
  | 'LIMA_NORTE'
  | 'LIMA_CENTRO'
  | 'LIMA_SUR'
  | 'LIMA_ESTE'
  | 'CALLAO'
  | 'UNKNOWN';

export interface ZoneDefinition {
  id: OperationalZone;
  name: string;
  districts: string[];
  center: { latitude: number; longitude: number };
}

export const OPERATIONAL_ZONES: Record<OperationalZone, ZoneDefinition> = {
  LIMA_NORTE: {
    id: 'LIMA_NORTE',
    name: 'Lima Norte',
    districts: [
      'COMAS',
      'LOS OLIVOS',
      'SAN MARTIN DE PORRES',
      'INDEPENDENCIA',
      'CARABAYLLO',
      'PUENTE PIEDRA',
      'ANCON',
      'SANTA ROSA',
    ],
    center: { latitude: -11.95, longitude: -77.06 },
  },
  LIMA_CENTRO: {
    id: 'LIMA_CENTRO',
    name: 'Lima Centro',
    districts: [
      'LIMA',
      'CERCADO DE LIMA',
      'BREÑA',
      'JESUS MARIA',
      'LINCE',
      'MAGDALENA DEL MAR',
      'PUEBLO LIBRE',
      'SAN ISIDRO',
      'MIRAFLORES',
      'SAN BORJA',
      'SURQUILLO',
      'BARRANCO',
      'LA VICTORIA',
      'RIMAC',
    ],
    center: { latitude: -12.08, longitude: -77.03 },
  },
  LIMA_SUR: {
    id: 'LIMA_SUR',
    name: 'Lima Sur',
    districts: [
      'SAN JUAN DE MIRAFLORES',
      'VILLA MARIA DEL TRIUNFO',
      'VILLA EL SALVADOR',
      'SANTIAGO DE SURCO',
      'CHORRILLOS',
      'LURIN',
      'PACHACAMAC',
      'SAN BARTOLO',
      'PUNTA HERMOSA',
      'PUNTA NEGRA',
      'SANTA MARIA DEL MAR',
      'PUCUSANA',
    ],
    center: { latitude: -12.16, longitude: -76.98 },
  },
  LIMA_ESTE: {
    id: 'LIMA_ESTE',
    name: 'Lima Este',
    districts: [
      'SAN JUAN DE LURIGANCHO',
      'ATE',
      'SANTA ANITA',
      'EL AGUSTINO',
      'LA MOLINA',
      'LURIGANCHO',
      'CHOSICA',
      'CHACLACAYO',
      'CIENEGUILLA',
    ],
    center: { latitude: -12.02, longitude: -76.94 },
  },
  CALLAO: {
    id: 'CALLAO',
    name: 'Callao',
    districts: [
      'CALLAO',
      'BELLAVISTA',
      'CARMEN DE LA LEGUA REYNOSO',
      'LA PERLA',
      'LA PUNTA',
      'VENTANILLA',
      'MI PERU',
    ],
    center: { latitude: -12.05, longitude: -77.12 },
  },
  UNKNOWN: {
    id: 'UNKNOWN',
    name: 'Zona sin determinar',
    districts: [],
    center: { latitude: -12.046374, longitude: -77.042793 },
  },
};

/**
 * Geographic bounding box approximations for Lima operational zones.
 */
export const ZONE_BOUNDING_BOXES: Record<Exclude<OperationalZone, 'UNKNOWN'>, { minLat: number; maxLat: number; minLng: number; maxLng: number }> = {
  LIMA_NORTE: { minLat: -12.03, maxLat: -11.65, minLng: -77.18, maxLng: -76.85 },
  CALLAO: { minLat: -12.12, maxLat: -11.83, minLng: -77.22, maxLng: -77.10 },
  LIMA_ESTE: { minLat: -12.12, maxLat: -11.82, minLng: -77.01, maxLng: -76.60 },
  LIMA_SUR: { minLat: -12.45, maxLat: -12.11, minLng: -77.06, maxLng: -76.70 },
  LIMA_CENTRO: { minLat: -12.14, maxLat: -12.03, minLng: -77.09, maxLng: -77.00 },
};

export function normalizeDistrictName(rawDistrict: string): string {
  if (!rawDistrict) return '';
  return rawDistrict
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^DISTRITO DE\s+/i, '');
}

export function getZoneByDistrict(district: string): OperationalZone {
  const normalized = normalizeDistrictName(district);
  if (!normalized) return 'UNKNOWN';

  // 1. Exact match first across all zones
  for (const [zoneKey, zoneDef] of Object.entries(OPERATIONAL_ZONES)) {
    if (zoneKey === 'UNKNOWN') continue;
    if (zoneDef.districts.some((d) => normalizeDistrictName(d) === normalized)) {
      return zoneKey as OperationalZone;
    }
  }

  // 2. Substring match sorted by name length descending to avoid short-name collisions
  const sortedDistricts: { zone: OperationalZone; name: string }[] = [];
  for (const [zoneKey, zoneDef] of Object.entries(OPERATIONAL_ZONES)) {
    if (zoneKey === 'UNKNOWN') continue;
    for (const d of zoneDef.districts) {
      sortedDistricts.push({ zone: zoneKey as OperationalZone, name: normalizeDistrictName(d) });
    }
  }
  sortedDistricts.sort((a, b) => b.name.length - a.name.length);

  for (const entry of sortedDistricts) {
    if (normalized.includes(entry.name)) {
      return entry.zone;
    }
  }

  return 'UNKNOWN';
}

export function getZoneByCoordinates(lat: number, lng: number): OperationalZone {
  if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
    return 'UNKNOWN';
  }

  for (const [zoneKey, bbox] of Object.entries(ZONE_BOUNDING_BOXES)) {
    if (
      lat >= bbox.minLat &&
      lat <= bbox.maxLat &&
      lng >= bbox.minLng &&
      lng <= bbox.maxLng
    ) {
      return zoneKey as OperationalZone;
    }
  }

  return 'UNKNOWN';
}

export interface ResolveZoneParams {
  district?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  coordinates?: { latitude: number; longitude: number } | null;
  workerConfiguredZone?: OperationalZone | null;
}

export function resolveOperationalZone(params: ResolveZoneParams): OperationalZone {
  if (params.district) {
    const zoneFromDistrict = getZoneByDistrict(params.district);
    if (zoneFromDistrict !== 'UNKNOWN') {
      return zoneFromDistrict;
    }
  }

  const lat = typeof params.latitude === 'number' ? params.latitude : params.coordinates?.latitude;
  const lng = typeof params.longitude === 'number' ? params.longitude : params.coordinates?.longitude;

  if (typeof lat === 'number' && typeof lng === 'number') {
    const zoneFromCoords = getZoneByCoordinates(lat, lng);
    if (zoneFromCoords !== 'UNKNOWN') {
      return zoneFromCoords;
    }
  }

  if (params.workerConfiguredZone && params.workerConfiguredZone !== 'UNKNOWN' && OPERATIONAL_ZONES[params.workerConfiguredZone]) {
    return params.workerConfiguredZone;
  }

  return 'UNKNOWN';
}

export function getZoneDisplayName(zone: OperationalZone | string | undefined | null): string {
  if (!zone || zone === 'UNKNOWN') return 'Zona sin determinar';
  return OPERATIONAL_ZONES[zone as OperationalZone]?.name || zone;
}

export interface CanonicalPricing {
  amountCents: number;
  price?: number; // derived amountCents / 100
  currency: 'PEN';
  description: string;
  assignedBy: string;
  updatedAt: any;
  version: number;
  // Legacy compatibility fields
  setBy?: string;
  setAt?: any;
}

export interface PricingPolicy {
  id: string;
  name: string;
  zone: OperationalZone | 'ALL';
  specialty: string | 'ALL';
  defaultVisitFeeCents: number;
  currency: 'PEN';
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
  conditions: string[];
  deductibleFromTotal: boolean;
}

export type ProviderOperationalStatus = 'AVAILABLE' | 'BUSY' | 'OFFLINE';

export interface ProviderPresence {
  providerId: string;
  providerName: string;
  providerPhone?: string;
  status: ProviderOperationalStatus;
  location: {
    latitude: number;
    longitude: number;
  };
  geohash: string;
  accuracy?: number | null;
  lastSeenAt: any;
  specialties: string[];
  zones: OperationalZone[];
  activeRequestId?: string | null;
  batteryLevel?: number | null;
  updatedAt: any;
}

export interface FeatureFlags {
  ENABLE_OPERATIONAL_MAP_V2: boolean;
  ENABLE_PROVIDER_PRESENCE: boolean;
  ENABLE_DYNAMIC_PRICING_POLICIES: boolean;
  ENABLE_BACKGROUND_LOCATION_CONSENT: boolean;
  ENABLE_AI_DISPATCH_TRIAGE: boolean;
  ENABLE_META_WHATSAPP_INTEGRATION: boolean;
}
