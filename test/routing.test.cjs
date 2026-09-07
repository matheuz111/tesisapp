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
