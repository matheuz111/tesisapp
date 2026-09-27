const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const context = {
  exports: {},
  require: (mod) => {
    if (mod === 'geofire-common') {
      return require('geofire-common');
    }
    if (mod === 'firebase/firestore') {
      return {
        doc: (db, coll, id) => ({ path: `${coll}/${id}` }),
        setDoc: async () => {},
        serverTimestamp: () => ({ _type: 'serverTimestamp' }),
      };
    }
    if (mod === '../types/canonical') {
      const cContext = { exports: {} };
      vm.runInNewContext(
        ts.transpileModule(fs.readFileSync('src/types/canonical.ts', 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.CommonJS },
        }).outputText,
        cContext
      );
      return cContext.exports;
    }
    throw new Error(`Unknown require: ${mod}`);
  },
};

vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/services/providerPresenceService.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  context
);

const {
  computeGeohash,
  validateCoordinates,
  isPresenceStale,
  calculateDistanceKm,
  buildProviderPresencePayload,
  createAdaptivePresencePublisher,
} = context.exports;

test('validateCoordinates correctly validates latitude and longitude limits', () => {
  // Valid coordinates in Lima
  assert.equal(validateCoordinates(-12.1219, -77.0298), true);
  assert.equal(validateCoordinates(0, 0), true);
  assert.equal(validateCoordinates(90, 180), true);
  assert.equal(validateCoordinates(-90, -180), true);

  // Invalids
  assert.equal(validateCoordinates(91, -77.0), false);
  assert.equal(validateCoordinates(-91, -77.0), false);
  assert.equal(validateCoordinates(-12.0, 181), false);
  assert.equal(validateCoordinates(-12.0, -181), false);
  assert.equal(validateCoordinates(NaN, -77.0), false);
  assert.equal(validateCoordinates(null, -77.0), false);
  assert.equal(validateCoordinates(undefined, undefined), false);
});

test('computeGeohash generates 9-character precision hash for Lima coordinates', () => {
  const hash = computeGeohash(-12.1219, -77.0298, 9);
  assert.ok(typeof hash === 'string');
  assert.equal(hash.length, 9);
  assert.ok(hash.startsWith('6m')); // Peruvian central coast geohash prefix
});

test('buildProviderPresencePayload enforces canonical structure and zones', () => {
  const payload = buildProviderPresencePayload({
    providerId: 'PROV_001',
    providerName: 'Carlos M.',
    providerPhone: '987654321',
    status: 'AVAILABLE',
    latitude: -11.9686,
    longitude: -77.0703,
    accuracy: 12,
    specialties: ['Gasfitería', 'Electricidad'],
    district: 'Los Olivos',
  });

  assert.equal(payload.providerId, 'PROV_001');
  assert.equal(payload.providerName, 'Carlos M.');
  assert.equal(payload.status, 'AVAILABLE');
  assert.equal(payload.location.latitude, -11.9686);
  assert.equal(payload.location.longitude, -77.0703);
  assert.equal(typeof payload.geohash, 'string');
  assert.equal(payload.accuracy, 12);
  assert.deepEqual([...payload.zones], ['LIMA_NORTE']); // Inferred from Los Olivos
  assert.deepEqual([...payload.specialties], ['Gasfitería', 'Electricidad']);
});

test('isPresenceStale detects timestamps older than threshold seconds', () => {
  const now = Date.now();

  // Fresh ping 30 seconds ago (< 90s default)
  const freshDate = new Date(now - 30000);
  assert.equal(isPresenceStale(freshDate), false);

  // Stale ping 95 seconds ago (> 90s default)
  const staleDate = new Date(now - 95000);
  assert.equal(isPresenceStale(staleDate), true);

  // Custom threshold
  assert.equal(isPresenceStale(new Date(now - 40000), 30), true);
  assert.equal(isPresenceStale(new Date(now - 40000), 60), false);

  // Firestore timestamp format { seconds: number }
  assert.equal(isPresenceStale({ seconds: Math.floor((now - 15000) / 1000) }), false);
  assert.equal(isPresenceStale({ seconds: Math.floor((now - 120000) / 1000) }), true);

  // Null/undefined is considered stale
  assert.equal(isPresenceStale(null), true);
  assert.equal(isPresenceStale(undefined), true);
});

test('calculateDistanceKm computes accurate distance between Lima districts', () => {
  // Miraflores [-12.1219, -77.0298] to San Isidro [-12.0975, -77.0350] is ~2.7 - 3.0 km
  const dist = calculateDistanceKm(-12.1219, -77.0298, -12.0975, -77.0350);
  assert.ok(dist >= 2.5 && dist <= 3.2, `Distance was ${dist}`);
});

test('createAdaptivePresencePublisher throttles stationary samples and accelerates on motion', async () => {
  let simulatedTime = 100000;
  let publishCount = 0;
  const publishedCoords = [];

  const publisher = createAdaptivePresencePublisher(
    async (coords) => {
      publishCount++;
      publishedCoords.push(coords);
    },
    {
      stationaryIntervalMs: 45000, // 45s heartbeat
      motionIntervalMs: 15000,      // 15s motion
      motionThresholdMeters: 25,    // 25m threshold
      now: () => simulatedTime,
    }
  );

  // 1. First sample publishes immediately
  await publisher.onLocationSample({ latitude: -12.1200, longitude: -77.0300 });
  assert.equal(publishCount, 1);

  // 2. Stationary sample after 10s should be throttled (< 45s stationary interval)
  simulatedTime += 10000;
  await publisher.onLocationSample({ latitude: -12.1200, longitude: -77.0300 });
  assert.equal(publishCount, 1); // Still 1

  // 3. Stationary sample after 50s should publish (heartbeat >= 45s)
  simulatedTime += 40000; // total 50s since last publish
  await publisher.onLocationSample({ latitude: -12.1200, longitude: -77.0300 });
  assert.equal(publishCount, 2);

  // 4. Moving sample after 18s (> 15s motionInterval) with ~100m displacement publishes!
  simulatedTime += 18000;
  await publisher.onLocationSample({ latitude: -12.1215, longitude: -77.0300 });
  assert.equal(publishCount, 3);

  // 5. Moving sample after only 5s (< 15s motionInterval) should be throttled
  simulatedTime += 5000;
  await publisher.onLocationSample({ latitude: -12.1230, longitude: -77.0300 });
  assert.equal(publishCount, 3); // Still 3

  // 6. Dispose stops further publishes
  publisher.dispose();
  simulatedTime += 60000;
  await publisher.onLocationSample({ latitude: -12.1250, longitude: -77.0300 });
  assert.equal(publishCount, 3); // Still 3
});
