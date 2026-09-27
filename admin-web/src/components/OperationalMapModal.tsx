import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L, { createClusterGroup } from '../leaflet-cluster';
import {
  X,
  MapPin,
  RefreshCw,
  Search,
  Wrench,
  Phone,
  Compass,
  Layers,
  Radio,
  Clock,
  Send,
} from 'lucide-react';
import type { ServiceRequest } from '../types';
import type { ProviderPresence, OperationalZone } from '../types/canonical';
import {
  OPERATIONAL_ZONES,
  resolveOperationalZone,
  getZoneDisplayName,
} from '../types/canonical';
import { presenceRepository } from '../repositories/presenceRepository';
import { FEATURE_FLAGS } from '../config/featureFlags';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  requests: ServiceRequest[];
  onAssignRequest?: (request: ServiceRequest, providerId?: string) => void;
}

// Fallback coordinates for Lima districts when exact GPS is absent
const DISTRICT_COORDS: Record<string, [number, number]> = {
  'MIRAFLORES': [-12.1219, -77.0298],
  'SAN ISIDRO': [-12.0975, -77.0350],
  'SURCO': [-12.1453, -76.9926],
  'SANTIAGO DE SURCO': [-12.1453, -76.9926],
  'SAN BORJA': [-12.1082, -77.0016],
  'LA MOLINA': [-12.0792, -76.9388],
  'MAGDALENA': [-12.0911, -77.0707],
  'JESUS MARIA': [-12.0747, -77.0483],
  'LINCE': [-12.0833, -77.0333],
  'SAN MIGUEL': [-12.0769, -77.0864],
  'PUEBLO LIBRE': [-12.0753, -77.0628],
  'LOS OLIVOS': [-11.9686, -77.0703],
  'INDEPENDENCIA': [-11.9961, -77.0544],
  'SAN MARTIN DE PORRES': [-12.0167, -77.0833],
  'COMAS': [-11.9333, -77.0500],
  'CARABAYLLO': [-11.8500, -77.0333],
  'PUENTE PIEDRA': [-11.8667, -77.0833],
  'ANCON': [-11.7733, -77.1764],
  'SANTA ROSA': [-11.8000, -77.1667],
  'CHORRILLOS': [-12.1667, -77.0167],
  'BARRANCO': [-12.1481, -77.0211],
  'CALLAO': [-12.0565, -77.1181],
  'BELLAVISTA': [-12.0625, -77.1264],
  'LA PUNTA': [-12.0711, -77.1625],
  'CARMEN DE LA LEGUA': [-12.0403, -77.0919],
  'LA PERLA': [-12.0694, -77.1139],
  'VENTANILLA': [-11.8789, -77.1261],
  'MI PERU': [-11.8569, -77.1281],
  'SAN JUAN DE LURIGANCHO': [-11.9833, -77.0000],
  'ATE': [-12.0267, -76.9189],
  'SANTA ANITA': [-12.0456, -76.9711],
  'EL AGUSTINO': [-12.0494, -77.0006],
  'LURIGANCHO': [-11.9367, -76.7028],
  'CHOSICA': [-11.9367, -76.7028],
  'CHACLACAYO': [-11.9806, -76.7667],
  'CIENEGUILLA': [-12.0917, -76.7778],
  'SAN JUAN DE MIRAFLORES': [-12.1611, -76.9639],
  'VILLA EL SALVADOR': [-12.2083, -76.9389],
  'VILLA MARIA DEL TRIUNFO': [-12.1583, -76.9278],
  'LURIN': [-12.2778, -76.8694],
  'PACHACAMAC': [-12.2294, -76.8622],
};

const STALE_THRESHOLD_SECONDS = 90;
const STORAGE_KEY_LAYER = 'tesis_operational_map_layer';

type MapLayerKey = 'light' | 'streets' | 'satellite';

interface LayerConfig {
  key: MapLayerKey;
  label: string;
  url: string;
  referenceUrl?: string;
  attribution: string;
  subdomains?: string;
  maxZoom: number;
  maxNativeZoom?: number;
}

const TILE_LAYERS: Record<MapLayerKey, LayerConfig> = {
  light: {
    key: 'light',
    label: 'Mapa claro',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    referenceUrl:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Sources: Esri, HERE, Garmin, &copy; OpenStreetMap contributors, and the GIS User Community',
    maxZoom: 19,
    maxNativeZoom: 16,
  },
  streets: {
    key: 'streets',
    label: 'Calles',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    key: 'satellite',
    label: 'Satélite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      '&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and GIS User Community',
    maxZoom: 19,
  },
};

function getPresenceAgeSeconds(lastSeenAt: any, currentTs: number): number {
  if (!lastSeenAt) return 9999;
  let timeMs = 0;
  if (typeof lastSeenAt?.toMillis === 'function') {
    timeMs = lastSeenAt.toMillis();
  } else if (typeof lastSeenAt?.seconds === 'number') {
    timeMs = lastSeenAt.seconds * 1000;
  } else if (lastSeenAt instanceof Date) {
    timeMs = lastSeenAt.getTime();
  } else if (typeof lastSeenAt === 'number') {
    timeMs = lastSeenAt;
  } else if (typeof lastSeenAt === 'string') {
    timeMs = new Date(lastSeenAt).getTime();
  }
  return Math.max(0, Math.round((currentTs - timeMs) / 1000));
}

function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export const OperationalMapModal = ({
  isOpen,
  onClose,
  requests,
  onAssignRequest,
}: Props) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.Layer | null>(null);
  const techClusterRef = useRef<L.LayerGroup | null>(null);
  const reqClusterRef = useRef<L.LayerGroup | null>(null);

  const [mapReady, setMapReady] = useState(false);
  const [providers, setProviders] = useState<ProviderPresence[]>([]);
  const [loadingPresence, setLoadingPresence] = useState(() => Boolean(FEATURE_FLAGS.ENABLE_PROVIDER_PRESENCE || FEATURE_FLAGS.ENABLE_OPERATIONAL_MAP_V2));
  const [selectedProvider, setSelectedProvider] = useState<ProviderPresence | null>(null);

  // Layer persistence via localStorage (default to 'light' - clean light topo map)
  const [selectedLayer, setSelectedLayer] = useState<MapLayerKey>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LAYER);
      if (saved === 'light' || saved === 'streets' || saved === 'satellite') {
        return saved;
      }
    } catch {}
    return 'light';
  });

  const [zoneFilter, setZoneFilter] = useState<OperationalZone | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'BUSY' | 'OFFLINE'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPendingRequests, setShowPendingRequests] = useState(true);

  // Single shared 1-second clock across the operational map for live timers
  const [nowTs, setNowTs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setNowTs(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Layer change handler with persistence
  const handleLayerChange = useCallback((layerKey: MapLayerKey) => {
    setSelectedLayer(layerKey);
    try {
      localStorage.setItem(STORAGE_KEY_LAYER, layerKey);
    } catch {}
  }, []);

  // 1. Subscribe to Provider Presence (scalable active queries)
  useEffect(() => {
    if (!isOpen) return;
    if (!FEATURE_FLAGS.ENABLE_PROVIDER_PRESENCE && !FEATURE_FLAGS.ENABLE_OPERATIONAL_MAP_V2) {
      return;
    }

    const onData = (list: ProviderPresence[]) => {
      setProviders(list);
      setLoadingPresence(false);
    };

    const onError = (err: Error) => {
      console.warn('[presence] Error de suscripción:', err);
      setLoadingPresence(false);
    };

    const unsubscribe =
      statusFilter === 'OFFLINE'
        ? presenceRepository.subscribeAll(onData, onError)
        : presenceRepository.subscribeActive(onData, onError, {
            statusFilter: statusFilter !== 'ALL' ? statusFilter : undefined,
          });

    return () => {
      unsubscribe();
    };
  }, [isOpen, statusFilter]);

  // 2. Synchronous Leaflet Map Initialization with Clusters
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;
    // Defensively ensure container is clean before Leaflet initialization
    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }
    container.innerHTML = '';

    // Lima Metropolitana y Callao broad operational center
    const initialCenter: [number, number] = [-12.0464, -77.0428];
    const map = L.map(container, {
      center: initialCenter,
      zoom: 11,
      zoomControl: false,
    });

    mapInstanceRef.current = map;

    // Zoom control top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Create clustering groups
    const techCluster = createClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="
            background: #2563eb;
            color: #ffffff;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 13px;
            border: 3px solid #ffffff;
            box-shadow: 0 4px 10px rgba(37, 99, 235, 0.45);
          ">${count}</div>`,
          className: 'custom-cluster-tech',
          iconSize: [36, 36],
        });
      },
    });

    const reqCluster = createClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 40,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="
            background: #dc2626;
            color: #ffffff;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 12px;
            border: 3px solid #ffffff;
            box-shadow: 0 4px 10px rgba(220, 38, 38, 0.45);
          ">${count}</div>`,
          className: 'custom-cluster-req',
          iconSize: [34, 34],
        });
      },
    });

    techCluster.addTo(map);
    reqCluster.addTo(map);

    techClusterRef.current = techCluster;
    reqClusterRef.current = reqCluster;

    // Observer to invalidate map size when modal finishes opening or resizes
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && container) {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
    }

    setMapReady(true);

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (resizeObserver) resizeObserver.disconnect();
      try {
        map.remove();
      } catch {}
      if (container) {
        delete (container as any)._leaflet_id;
        container.innerHTML = '';
      }
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      techClusterRef.current = null;
      reqClusterRef.current = null;
      setMapReady(false);
    };
  }, []);

  // 3. Tile Layer Lifecycle & Switching
  useEffect(() => {
    if (!mapReady) return;
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    const cfg = TILE_LAYERS[selectedLayer] || TILE_LAYERS.light;

    const createTileLayer = (url: string, zIndex: number) => {
      const tileLayer = L.tileLayer(url, {
        attribution: cfg.attribution,
        subdomains: cfg.subdomains || 'abc',
        maxZoom: cfg.maxZoom,
        maxNativeZoom: cfg.maxNativeZoom,
        crossOrigin: true,
        keepBuffer: 8,
        updateWhenIdle: false,
        zIndex,
      });

      tileLayer.on('tileerror', (errorEvent: any) => {
        const tile = errorEvent.tile;
        const failedUrl = errorEvent.url;
        const retryCount = (tile as any)?._retryCount || 0;
        if (retryCount < 2 && tile && failedUrl) {
          (tile as any)._retryCount = retryCount + 1;
          setTimeout(() => {
            tile.src = failedUrl;
          }, 300 * (retryCount + 1));
        }
      });

      return tileLayer;
    };

    const baseLayer = createTileLayer(cfg.url, 1);
    const layer: L.Layer = cfg.referenceUrl
      ? L.layerGroup([baseLayer, createTileLayer(cfg.referenceUrl, 2)])
      : baseLayer;

    layer.addTo(map);
    tileLayerRef.current = layer;

    // Ensure tiles immediately adjust to canvas
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 50);

    return () => {
      clearTimeout(timer);
    };
  }, [mapReady, selectedLayer]);

  // 4. Pending Requests for Mapping (including VALIDATED)
  const openRequests = useMemo(() => {
    return requests.filter((r) =>
      [
        'PENDING_ASSIGNMENT',
        'QUOTED',
        'REQUIRES_REASSIGNMENT',
        'PENDING',
        'VALIDATED',
      ].includes(r.status)
    );
  }, [requests]);

  // 5. Filtered Providers
  const filteredProviders = useMemo(() => {
    return providers.filter((p) => {
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (zoneFilter !== 'ALL' && !p.zones?.includes(zoneFilter)) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const name = (p.providerName || '').toLowerCase();
        const phone = (p.providerPhone || '').toLowerCase();
        const spec = (p.specialties || []).join(' ').toLowerCase();
        if (!name.includes(query) && !phone.includes(query) && !spec.includes(query)) return false;
      }
      return true;
    });
  }, [providers, statusFilter, zoneFilter, searchQuery]);

  // Detect which providers crossed stale threshold (>90s) without thrashing clusters every second
  const staleStatusSignature = useMemo(() => {
    const staleIds: string[] = [];
    for (const p of filteredProviders) {
      if (getPresenceAgeSeconds(p.lastSeenAt, nowTs) > STALE_THRESHOLD_SECONDS) {
        staleIds.push(p.providerId);
      }
    }
    return staleIds.sort().join(',');
  }, [filteredProviders, nowTs]);

  // 6. Synchronize Markers with Clusters
  useEffect(() => {
    if (!mapReady) return;
    const techCluster = techClusterRef.current;
    const reqCluster = reqClusterRef.current;
    if (!techCluster || !reqCluster) return;

    techCluster.clearLayers();
    reqCluster.clearLayers();

    const staleSet = new Set(staleStatusSignature.split(',').filter(Boolean));

    // A. Draw Technician Markers
    filteredProviders.forEach((p) => {
      const lat = p.location?.latitude;
      const lng = p.location?.longitude;
      if (typeof lat !== 'number' || typeof lng !== 'number') return;

      const isStale = staleSet.has(p.providerId);

      let markerColor = '#10b981';
      let statusLabel = 'Disponible y Reciente';
      let haloClass = '';
      let pulseRingHtml = '';

      if (p.status === 'BUSY') {
        markerColor = '#2563eb';
        statusLabel = 'En Servicio';
      } else if (p.status === 'OFFLINE') {
        markerColor = '#64748b';
        statusLabel = 'Desconectado';
      } else if (isStale) {
        markerColor = '#f59e0b';
        statusLabel = 'Señal Desfasada';
        haloClass = 'marker-stale-halo';
      } else {
        pulseRingHtml = `<div class="marker-pulse-ring"></div>`;
      }

      const iconHtml = `
        <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
          ${pulseRingHtml}
          <div class="${haloClass}" style="
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: ${markerColor};
            border: 2px solid #ffffff;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 11px;
            font-weight: 700;
          ">
            ${p.providerName ? p.providerName.charAt(0).toUpperCase() : 'T'}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'provider-presence-marker',
        html: iconHtml,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      marker.on('click', () => {
        setSelectedProvider(p);
      });

      marker.bindTooltip(
        () => {
          const currentAge = getPresenceAgeSeconds(p.lastSeenAt, Date.now());
          const currentLabel = isStale ? `Señal Desfasada (${currentAge}s)` : statusLabel;
          return `<b>${p.providerName || 'Técnico'}</b><br/><span style="color: ${markerColor}">● ${currentLabel}</span><br/><small style="color: #64748b;">${currentAge < 9999 ? `Hace ${currentAge}s` : 'Sin señal'}</small>`;
        },
        { direction: 'top', offset: [0, -12] }
      );

      techCluster.addLayer(marker);
    });

    // B. Draw Open Service Requests
    if (showPendingRequests) {
      openRequests.forEach((req) => {
        let lat = req.location?.latitude || req.clientLocation?.latitude;
        let lng = req.location?.longitude || req.clientLocation?.longitude;

        if (typeof lat !== 'number' || typeof lng !== 'number') {
          const distKey = (req.district || '').toUpperCase().trim();
          if (DISTRICT_COORDS[distKey]) {
            [lat, lng] = DISTRICT_COORDS[distKey];
          }
        }

        if (typeof lat !== 'number' || typeof lng !== 'number') return;

        const isUrgent = req.urgency === 'NOW';
        const reqColor = isUrgent ? '#dc2626' : '#ea580c';
        const urgentClass = isUrgent ? 'marker-urgent-pulse' : '';

        const requestIconHtml = `
          <div class="${urgentClass}" style="
            width: 24px;
            height: 24px;
            border-radius: 6px;
            background: ${reqColor};
            border: 2px solid #ffffff;
            box-shadow: 0 2px 7px rgba(0, 0, 0, 0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-size: 12px;
            font-weight: 800;
          ">
            ${isUrgent ? '⚡' : '🔧'}
          </div>
        `;

        const requestIcon = L.divIcon({
          className: 'request-map-marker',
          html: requestIconHtml,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const reqMarker = L.marker([lat, lng], { icon: requestIcon });
        reqMarker.bindTooltip(
          `<b>${req.code || 'Solicitud'}</b><br/>${req.serviceLabel || req.specialty}<br/>${req.district || 'Lima'}${isUrgent ? ' <span style="color:#ef4444;font-weight:700;">(URGENTE)</span>' : ''}`,
          { direction: 'top', offset: [0, -12] }
        );

        reqCluster.addLayer(reqMarker);
      });
    }
  }, [mapReady, filteredProviders, openRequests, showPendingRequests, staleStatusSignature]);

  // Center / Fit all active operations
  const handleFitAll = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const points: [number, number][] = [];
    filteredProviders.forEach((p) => {
      if (typeof p.location?.latitude === 'number' && typeof p.location?.longitude === 'number') {
        points.push([p.location.latitude, p.location.longitude]);
      }
    });
    if (showPendingRequests) {
      openRequests.forEach((req) => {
        let lat = req.location?.latitude || req.clientLocation?.latitude;
        let lng = req.location?.longitude || req.clientLocation?.longitude;
        if (typeof lat !== 'number' || typeof lng !== 'number') {
          const distKey = (req.district || '').toUpperCase().trim();
          if (DISTRICT_COORDS[distKey]) [lat, lng] = DISTRICT_COORDS[distKey];
        }
        if (typeof lat === 'number' && typeof lng === 'number') {
          points.push([lat, lng]);
        }
      });
    }
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 14 });
    } else {
      map.flyTo([-12.0464, -77.0428], 11);
    }
  };

  // Fly to zone center
  const handleZoneSelect = (zone: OperationalZone | 'ALL') => {
    setZoneFilter(zone);
    const map = mapInstanceRef.current;
    if (!map) return;

    if (zone === 'ALL') {
      map.flyTo([-12.0464, -77.0428], 11);
    } else {
      const zoneDef = OPERATIONAL_ZONES[zone];
      if (zoneDef) {
        map.flyTo([zoneDef.center.latitude, zoneDef.center.longitude], 13);
      }
    }
  };

  // Compute Nearest Requests for selected technician
  const nearestRequests = useMemo(() => {
    if (!selectedProvider || !selectedProvider.location) return [];

    const pLat = selectedProvider.location.latitude;
    const pLng = selectedProvider.location.longitude;

    const listWithDist = openRequests.map((req) => {
      let rLat = req.location?.latitude || req.clientLocation?.latitude;
      let rLng = req.location?.longitude || req.clientLocation?.longitude;
      let isExact = typeof rLat === 'number' && typeof rLng === 'number';

      if (!isExact) {
        const distKey = (req.district || '').toUpperCase().trim();
        if (DISTRICT_COORDS[distKey]) {
          [rLat, rLng] = DISTRICT_COORDS[distKey];
        }
      }

      const hasCoordinates = typeof rLat === 'number' && typeof rLng === 'number';
      const distanceKm = hasCoordinates ? calculateDistanceKm(pLat, pLng, rLat!, rLng!) : 9999;

      const isSpecialtyMatch = Boolean(
        !req.specialty ||
          (selectedProvider.specialties || []).some(
            (s) => s.toLowerCase() === req.specialty?.toLowerCase()
          ) ||
          (selectedProvider.specialties || []).length === 0
      );

      return {
        req,
        distanceKm,
        isExact,
        hasCoordinates,
        isSpecialtyMatch,
      };
    });

    return listWithDist
      .filter((item) => item.hasCoordinates)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 3);
  }, [selectedProvider, openRequests]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1350,
          height: '92vh',
          backgroundColor: 'var(--card-bg, #ffffff)',
          borderRadius: 20,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid var(--border, #e2e8f0)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--header-bg, #f8fafc)',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'rgba(37, 99, 235, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
              }}
            >
              <Compass size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: 'var(--text, #0f172a)' }}>
                Mapa Operativo en Tiempo Real — Maestro a Domicilio
              </h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>
                Trazabilidad satelital de colaboradores y cobertura en Lima Metropolitana y Callao
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Map Layer Selector (Mapa claro [Default], Calles, Satélite) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-subtle, #e2e8f0)',
                padding: 3,
                borderRadius: 10,
                gap: 2,
              }}
            >
              <Layers size={14} style={{ margin: '0 6px', color: '#64748b' }} />
              {(['light', 'streets', 'satellite'] as const).map((layerKey) => {
                const isActive = selectedLayer === layerKey;
                return (
                  <button
                    key={layerKey}
                    type="button"
                    onClick={() => handleLayerChange(layerKey)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 7,
                      fontSize: 12,
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      background: isActive ? '#ffffff' : 'transparent',
                      color: isActive ? '#0f172a' : '#64748b',
                      boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {TILE_LAYERS[layerKey].label}
                  </button>
                );
              })}
            </div>

            {/* Toggle Pending Requests */}
            <button
              type="button"
              onClick={() => setShowPendingRequests((v) => !v)}
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                padding: '6px 12px',
                borderColor: showPendingRequests ? '#f97316' : undefined,
                color: showPendingRequests ? '#ea580c' : undefined,
              }}
            >
              <MapPin size={14} />
              <span>{showPendingRequests ? 'Ocultar Pedidos' : 'Ver Pedidos'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--text-muted, #64748b)',
                padding: 4,
              }}
              title="Cerrar mapa operativo"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Toolbar & Filter Ribbon */}
        <div
          style={{
            padding: '10px 20px',
            background: 'var(--bg-subtle, #f1f5f9)',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          {/* Zone Filter Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted, #64748b)', marginRight: 4 }}>
              Zona:
            </span>
            {(['ALL', 'LIMA_NORTE', 'LIMA_CENTRO', 'LIMA_SUR', 'LIMA_ESTE', 'CALLAO'] as const).map(
              (z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => handleZoneSelect(z)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 16,
                    fontSize: 12,
                    fontWeight: 600,
                    border: '1px solid',
                    cursor: 'pointer',
                    background: zoneFilter === z ? '#2563eb' : 'var(--card-bg, #ffffff)',
                    color: zoneFilter === z ? '#ffffff' : 'var(--text, #334155)',
                    borderColor: zoneFilter === z ? '#2563eb' : 'var(--border, #cbd5e1)',
                  }}
                >
                  {z === 'ALL' ? 'Todas' : OPERATIONAL_ZONES[z]?.name || z}
                </button>
              )
            )}

            {/* Fit / Focus All Operations */}
            <button
              type="button"
              onClick={handleFitAll}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 600,
                border: '1px solid #93c5fd',
                cursor: 'pointer',
                background: '#eff6ff',
                color: '#1d4ed8',
                marginLeft: 4,
              }}
              title="Ajustar mapa automáticamente para ver a todos los técnicos y pedidos"
            >
              <Compass size={13} />
              <span>Enfocar Todo</span>
            </button>
          </div>

          {/* Status & Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              style={{
                padding: '5px 10px',
                borderRadius: 12,
                fontSize: 12,
                border: '1px solid var(--border, #cbd5e1)',
                background: 'var(--card-bg, #ffffff)',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">Estado: Todos</option>
              <option value="AVAILABLE">🟢 Disponibles</option>
              <option value="BUSY">🔵 En Servicio</option>
              <option value="OFFLINE">⚪ Desconectados</option>
            </select>

            <div style={{ position: 'relative', width: 220 }}>
              <Search
                size={13}
                style={{
                  position: 'absolute',
                  left: 9,
                  top: 9,
                  color: 'var(--text-muted, #94a3b8)',
                }}
              />
              <input
                type="text"
                placeholder="Buscar técnico..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 10px 5px 28px',
                  borderRadius: 12,
                  fontSize: 12,
                  border: '1px solid var(--border, #cbd5e1)',
                  background: 'var(--card-bg, #ffffff)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Map Body & Drawer */}
        <div style={{ flex: 1, position: 'relative', display: 'flex', minHeight: 0 }}>
          {/* Leaflet Map Canvas */}
          <div
            ref={mapContainerRef}
            style={{
              width: '100%',
              height: '100%',
              minHeight: '400px',
              flex: 1,
              zIndex: 1,
              background: '#f8fafc',
            }}
          />

          {/* Selected Provider Drawer */}
          {selectedProvider && (
            <div
              style={{
                position: 'absolute',
                right: 16,
                top: 16,
                width: 360,
                maxHeight: 'calc(100% - 32px)',
                backgroundColor: 'rgba(255, 255, 255, 0.97)',
                backdropFilter: 'blur(8px)',
                borderRadius: 16,
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
                border: '1px solid #e2e8f0',
                padding: 18,
                zIndex: 1000,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    {selectedProvider.providerName || 'Técnico Especialista'}
                  </h3>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    Técnico Especialista Colaborador
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProvider(null)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Status & Freshness Badge (uses shared clock nowTs) */}
              {(() => {
                const ageSec = getPresenceAgeSeconds(selectedProvider.lastSeenAt, nowTs);
                const isStale = ageSec > STALE_THRESHOLD_SECONDS;
                const isBusy = selectedProvider.status === 'BUSY';
                const isOffline = selectedProvider.status === 'OFFLINE';

                let badgeBg = 'rgba(16, 185, 129, 0.1)';
                let badgeBorder = '#86efac';
                let dotColor = '#10b981';
                let titleColor = '#15803d';
                let subColor = '#16a34a';
                let statusText = 'Disponible en Línea';

                if (isBusy) {
                  badgeBg = 'rgba(37, 99, 235, 0.1)';
                  badgeBorder = '#93c5fd';
                  dotColor = '#2563eb';
                  titleColor = '#1d4ed8';
                  subColor = '#2563eb';
                  statusText = 'En Servicio Activo';
                } else if (isOffline) {
                  badgeBg = 'rgba(100, 116, 139, 0.1)';
                  badgeBorder = '#cbd5e1';
                  dotColor = '#64748b';
                  titleColor = '#334155';
                  subColor = '#64748b';
                  statusText = 'Desconectado';
                } else if (isStale) {
                  badgeBg = 'rgba(245, 158, 11, 0.12)';
                  badgeBorder = '#fcd34d';
                  dotColor = '#f59e0b';
                  titleColor = '#b45309';
                  subColor = '#d97706';
                  statusText = 'Señal GPS Desfasada';
                }

                return (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      background: badgeBg,
                      border: `1px solid ${badgeBorder}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        background: dotColor,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: titleColor }}>
                        {statusText}
                      </div>
                      <div style={{ fontSize: 11, color: subColor, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={11} />
                        <span>
                          {ageSec < 9999
                            ? isStale
                              ? `Última señal hace ${ageSec}s (> ${STALE_THRESHOLD_SECONDS}s)`
                              : `Actualizado hace ${ageSec}s`
                            : 'Sin señal reciente'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Physical Zone vs Coverage Separation */}
              {(() => {
                const currentPhysicalZone = resolveOperationalZone({
                  coordinates: selectedProvider.location,
                });
                const physicalZoneName = getZoneDisplayName(currentPhysicalZone);

                const coverageZones = selectedProvider.zones?.length
                  ? selectedProvider.zones.map(getZoneDisplayName).join(', ')
                  : 'Sin zonas asignadas';

                return (
                  <div
                    style={{
                      background: '#f8fafc',
                      borderRadius: 10,
                      padding: '10px 12px',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block' }}>
                        📍 Zona actual (ubicación física):
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: currentPhysicalZone === 'UNKNOWN' ? '#d97706' : '#0f172a',
                        }}
                      >
                        {physicalZoneName}
                      </span>
                    </div>

                    <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block' }}>
                        🛡️ Cobertura (zonas donde atiende):
                      </span>
                      <span style={{ fontSize: 12, color: '#334155' }}>{coverageZones}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Contact & Technical Details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                {selectedProvider.providerPhone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155' }}>
                    <Phone size={13} color="#2563eb" />
                    <span>{selectedProvider.providerPhone}</span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155' }}>
                  <Wrench size={13} color="#2563eb" />
                  <span>Especialidades: {selectedProvider.specialties?.join(', ') || 'General'}</span>
                </div>
                {selectedProvider.geohash && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontSize: 11 }}>
                    <Radio size={12} color="#64748b" />
                    <span>Geohash: <code>{selectedProvider.geohash}</code></span>
                  </div>
                )}
              </div>

              {/* Nearest Requests sorted strictly by real distance */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: 8 }}>
                  Top 3 Solicitudes Más Cercanas:
                </span>
                {nearestRequests.length === 0 ? (
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>
                    No hay solicitudes pendientes con ubicación en radio operativo
                  </span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {nearestRequests.map(({ req, distanceKm, isExact, isSpecialtyMatch }) => {
                      const isUrgent = req.urgency === 'NOW';
                      const ageSec = getPresenceAgeSeconds(selectedProvider.lastSeenAt, nowTs);
                      const isStale = ageSec > STALE_THRESHOLD_SECONDS;
                      const canAssign = selectedProvider.status === 'AVAILABLE' && !isStale;

                      return (
                        <div
                          key={req.id}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 10,
                            background: '#f8fafc',
                            border: `1px solid ${isUrgent ? '#fca5a5' : '#e2e8f0'}`,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb' }}>
                                {req.code || 'SOL-REQ'} · {req.district || 'Lima'}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>
                                {req.serviceLabel || req.specialty}
                              </div>
                            </div>
                            {isUrgent && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background: '#fef2f2',
                                  color: '#dc2626',
                                  border: '1px solid #fecaca',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                }}
                              >
                                URGENTE
                              </span>
                            )}
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: 11,
                              color: '#475569',
                            }}
                          >
                            <span>
                              Distancia: <strong>{distanceKm} km</strong> {!isExact && '(Aprox.)'}
                            </span>
                            {isSpecialtyMatch ? (
                              <span style={{ color: '#16a34a', fontWeight: 600 }}>Especialidad OK</span>
                            ) : (
                              <span style={{ color: '#d97706' }}>Especialidad Distinta</span>
                            )}
                          </div>

                          {/* Safe assignment button opening existing dispatch workflow */}
                          {onAssignRequest && (
                            <button
                              type="button"
                              onClick={() => {
                                if (canAssign) {
                                  onAssignRequest(req, selectedProvider.providerId);
                                }
                              }}
                              disabled={!canAssign}
                              className="btn btn-primary"
                              title={
                                !canAssign
                                  ? selectedProvider.status === 'BUSY'
                                    ? 'No se puede asignar: Técnico en servicio activo'
                                    : isStale
                                    ? 'No se puede asignar: Señal GPS desfasada (>90s)'
                                    : 'No se puede asignar: Técnico desconectado'
                                  : 'Abrir asignación segura preseleccionando este técnico'
                              }
                              style={{
                                fontSize: 11,
                                padding: '5px 10px',
                                width: '100%',
                                marginTop: 4,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                opacity: canAssign ? 1 : 0.5,
                                cursor: canAssign ? 'pointer' : 'not-allowed',
                              }}
                            >
                              <Send size={12} />
                              <span>
                                {canAssign
                                  ? 'Asignar a este Técnico'
                                  : isStale
                                  ? 'Señal Desfasada'
                                  : selectedProvider.status === 'BUSY'
                                  ? 'Técnico Ocupado'
                                  : 'No Disponible'}
                              </span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Visual Legend Bar at bottom */}
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              background: 'rgba(255, 255, 255, 0.97)',
              backdropFilter: 'blur(8px)',
              padding: '10px 16px',
              borderRadius: 14,
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              fontSize: 11,
              fontWeight: 600,
              zIndex: 999,
              border: '1px solid #e2e8f0',
            }}
          >
            {/* Disponible y reciente */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#10b981',
                  border: '2px solid #ffffff',
                  boxShadow: '0 0 0 2px #10b981',
                }}
              />
              <span style={{ color: '#0f172a' }}>Disponible (&lt;90s)</span>
            </div>

            {/* Señal desfasada */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                className="marker-stale-halo"
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#f59e0b',
                  border: '2px solid #ffffff',
                }}
              />
              <span style={{ color: '#b45309' }}>Señal desfasada (&gt;90s)</span>
            </div>

            {/* En servicio */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#2563eb',
                  border: '2px solid #ffffff',
                  boxShadow: '0 0 0 1px #93c5fd',
                }}
              />
              <span style={{ color: '#0f172a' }}>En Servicio</span>
            </div>

            {/* Desconectado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#64748b',
                  border: '2px solid #ffffff',
                }}
              />
              <span style={{ color: '#64748b' }}>Desconectado</span>
            </div>

            {/* Solicitud normal */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 4,
                  background: '#ea580c',
                  border: '1px solid #ffffff',
                  display: 'inline-block',
                }}
              />
              <span style={{ color: '#0f172a' }}>Pedido Pendiente</span>
            </div>

            {/* Solicitud urgente */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                className="marker-urgent-pulse"
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 4,
                  background: '#dc2626',
                  border: '1px solid #ffffff',
                  display: 'inline-block',
                }}
              />
              <span style={{ color: '#dc2626' }}>Pedido Urgente</span>
            </div>

            {loadingPresence && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#2563eb' }}>
                <RefreshCw size={12} className="spinner" />
                <span>Sincronizando...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
