import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface ClusterOptions {
  maxClusterRadius?: number;
  iconCreateFunction?: (cluster: { getChildCount: () => number }) => L.DivIcon | L.Icon;
  showCoverageOnHover?: boolean;
}

interface ClusterBucket {
  markers: L.Marker[];
  centerLat: number;
  centerLng: number;
  screenX: number;
  screenY: number;
  cellKey: string;
}

/**
 * A high-performance, pure-Leaflet cluster group using O(N) spatial grid hashing.
 * Avoids O(N^2) pairwise comparisons for hundreds or thousands of markers
 * and completely eliminates "L is not defined" ReferenceError crashes in Vite.
 */
export class SafeClusterGroup extends L.LayerGroup {
  private _rawMarkers: L.Marker[] = [];
  private _clusterOptions: Required<ClusterOptions>;
  private _clusterMap: L.Map | null = null;
  private _reclusterDebounce: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: ClusterOptions) {
    super();
    this._clusterOptions = {
      maxClusterRadius: options?.maxClusterRadius || 45,
      iconCreateFunction: options?.iconCreateFunction || ((cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div style="
            background: #2563eb;
            color: #ffffff;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 13px;
            border: 3px solid #ffffff;
            box-shadow: 0 4px 10px rgba(37, 99, 235, 0.45);
          ">${count}</div>`,
          className: 'safe-cluster-badge',
          iconSize: [34, 34],
        });
      }),
      showCoverageOnHover: options?.showCoverageOnHover ?? false,
    };
  }

  override onAdd(map: L.Map): this {
    this._clusterMap = map;
    super.onAdd(map);
    map.on('zoomend moveend', this._scheduleRecluster, this);
    this._recluster();
    return this;
  }

  override onRemove(map: L.Map): this {
    map.off('zoomend moveend', this._scheduleRecluster, this);
    if (this._reclusterDebounce) clearTimeout(this._reclusterDebounce);
    this._clusterMap = null;
    super.onRemove(map);
    return this;
  }

  override addLayer(layer: L.Layer): this {
    if (layer instanceof L.Marker) {
      this._rawMarkers.push(layer);
      this._scheduleRecluster();
    } else {
      super.addLayer(layer);
    }
    return this;
  }

  override clearLayers(): this {
    this._rawMarkers = [];
    super.clearLayers();
    return this;
  }

  private _scheduleRecluster = () => {
    if (this._reclusterDebounce) clearTimeout(this._reclusterDebounce);
    this._reclusterDebounce = setTimeout(() => {
      this._recluster();
    }, 20);
  };

  private _recluster() {
    const map = this._clusterMap;
    if (!map) return;

    super.clearLayers();

    if (this._rawMarkers.length === 0) return;

    const radius = this._clusterOptions.maxClusterRadius;
    const currentZoom = map.getZoom();

    // At street-level zoom (>= 16), show individual markers directly without clustering
    if (currentZoom >= 16) {
      for (let i = 0; i < this._rawMarkers.length; i++) {
        super.addLayer(this._rawMarkers[i]);
      }
      return;
    }

    // O(N) Spatial Grid Hash Clustering in screen pixel space
    const cellSize = radius;
    const grid = new Map<string, ClusterBucket>();

    for (let i = 0; i < this._rawMarkers.length; i++) {
      const marker = this._rawMarkers[i];
      const latLng = marker.getLatLng();
      const point = map.latLngToLayerPoint(latLng);

      const cellX = Math.floor(point.x / cellSize);
      const cellY = Math.floor(point.y / cellSize);

      let nearestBucket: ClusterBucket | null = null;
      let minDistance = radius;

      // Check 9 neighboring grid cells (O(1) lookups)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const neighborKey = `${cellX + dx}:${cellY + dy}`;
          const bucket = grid.get(neighborKey);
          if (bucket) {
            const dist = Math.hypot(bucket.screenX - point.x, bucket.screenY - point.y);
            if (dist < minDistance) {
              minDistance = dist;
              nearestBucket = bucket;
            }
          }
        }
      }

      if (nearestBucket) {
        nearestBucket.markers.push(marker);
        const count = nearestBucket.markers.length;
        // Incremental centroid update
        nearestBucket.centerLat = (nearestBucket.centerLat * (count - 1) + latLng.lat) / count;
        nearestBucket.centerLng = (nearestBucket.centerLng * (count - 1) + latLng.lng) / count;
        nearestBucket.screenX = (nearestBucket.screenX * (count - 1) + point.x) / count;
        nearestBucket.screenY = (nearestBucket.screenY * (count - 1) + point.y) / count;
      } else {
        const key = `${cellX}:${cellY}`;
        const newBucket: ClusterBucket = {
          markers: [marker],
          centerLat: latLng.lat,
          centerLng: latLng.lng,
          screenX: point.x,
          screenY: point.y,
          cellKey: key,
        };
        grid.set(key, newBucket);
      }
    }

    // Render clusters or standalone markers
    grid.forEach((bucket) => {
      if (bucket.markers.length === 1) {
        super.addLayer(bucket.markers[0]);
      } else {
        const clusterIcon = this._clusterOptions.iconCreateFunction({
          getChildCount: () => bucket.markers.length,
        });

        const clusterMarker = L.marker([bucket.centerLat, bucket.centerLng], {
          icon: clusterIcon,
        });

        clusterMarker.on('click', () => {
          const targetZoom = Math.min(map.getMaxZoom(), map.getZoom() + 2);
          map.setView([bucket.centerLat, bucket.centerLng], targetZoom, { animate: true });
        });

        super.addLayer(clusterMarker);
      }
    });
  }
}

export function createClusterGroup(options?: ClusterOptions): L.LayerGroup {
  return new SafeClusterGroup(options);
}

export default L;
