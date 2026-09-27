import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

if (typeof window !== 'undefined') {
  (window as any).L = L;
  (globalThis as any).L = L;
}

export default L;
