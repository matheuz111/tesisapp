const test = require('node:test');
const assert = require('node:assert/strict');

// Algoritmo puro de decodificación
function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') return [];
  const points = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
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

test('decodePolyline decodes standard Google encoded polyline correctly', () => {
  // Polilínea estándar de Google: "_p~iF~ps|U_ulLnnqC_mqNvxq`@"
  // Puntos esperados aproximados: (38.5, -120.2), (40.7, -120.95), (43.252, -126.453)
  const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
  const decoded = decodePolyline(encoded);

  assert.equal(decoded.length, 3);
  assert.equal(Math.round(decoded[0].latitude * 10) / 10, 38.5);
  assert.equal(Math.round(decoded[0].longitude * 10) / 10, -120.2);
  assert.equal(Math.round(decoded[1].latitude * 10) / 10, 40.7);
  assert.equal(Math.round(decoded[1].longitude * 10) / 10, -120.9);
});

test('decodePolyline handles empty, null or invalid strings safely', () => {
  assert.deepEqual(decodePolyline(''), []);
  assert.deepEqual(decodePolyline(null), []);
  assert.deepEqual(decodePolyline(undefined), []);
  assert.deepEqual(decodePolyline(123), []);
});

function formatDurationText(seconds) {
  if (seconds <= 0) return 'Llegando ahora';
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours} h ${remainingMins} min` : `${hours} h`;
}

function formatDistanceText(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

test('formatDurationText produces readable time strings', () => {
  assert.equal(formatDurationText(0), 'Llegando ahora');
  assert.equal(formatDurationText(20), '< 1 min');
  assert.equal(formatDurationText(180), '3 min');
  assert.equal(formatDurationText(3600), '1 h');
  assert.equal(formatDurationText(4500), '1 h 15 min');
});

test('formatDistanceText produces readable distance strings', () => {
  assert.equal(formatDistanceText(450), '450 m');
  assert.equal(formatDistanceText(1200), '1.2 km');
  assert.equal(formatDistanceText(10500), '10.5 km');
});
