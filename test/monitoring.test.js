const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the actual TypeScript module; do not duplicate its implementation.
const source = fs.readFileSync(path.join(__dirname, '../src/services/monitoring.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const context = { exports: {} };
vm.runInNewContext(compiled, context);
const { MONITORED_STATUSES, validCoordinate, locationStatus, toMapCoordinate } = context.exports;
const now = Date.now();
const fix = (capturedAt, received = capturedAt) => ({ latitude: -12, longitude: -77, accuracy: 8, capturedAt, updatedAt: { toMillis: () => received } });

test('Only active services share GPS; completed, archived and cancelled services stop', () => {
  for (const status of ['PENDING_ASSIGNMENT', 'REQUIRES_REASSIGNMENT', 'PENDING', 'ACCEPTED', 'IN_PROGRESS']) assert.ok(MONITORED_STATUSES.includes(status));
  for (const status of ['COMPLETED', 'ARCHIVED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_PROVIDER']) assert.ok(!MONITORED_STATUSES.includes(status));
});
test('Coordinates reject missing, out-of-range and nonnumeric values', () => {
  for (const value of [null, {}, { latitude: 91, longitude: 0 }, { latitude: 0, longitude: -181 }, { latitude: '-12', longitude: -77 }, { latitude: NaN, longitude: 0 }]) assert.equal(validCoordinate(value), false);
  assert.equal(validCoordinate({ latitude: 0, longitude: 0 }), true);
});
test('Fresh GPS becomes stale after 45 seconds without new data', () => {
  assert.match(locationStatus(fix(now), now + 45000), /^GPS reciente/);
  assert.match(locationStatus(fix(now), now + 46000), /^Sin actualización reciente/);
});
test('Offline queued GPS is stale even when just received by the server', () => {
  assert.match(locationStatus(fix(now - 300000, now), now), /^Sin actualización reciente/);
});
test('Missing and unconfirmed GPS never appears live', () => {
  assert.equal(locationStatus(null, now), 'Sin GPS compartido');
  assert.equal(locationStatus({ ...fix(now), updatedAt: null }, now), 'Ubicación pendiente de confirmar');
});
test('Unavailable accuracy is not displayed as zero meters', () => {
  assert.match(locationStatus({ ...fix(now), accuracy: null }, now), /precisión no disponible/);
});

test('Firestore GeoPoint is converted to enumerable native map coordinates', () => {
  const { GeoPoint } = require('firebase/firestore');
  const point = toMapCoordinate(new GeoPoint(-12.04, -77.03));
  assert.deepEqual(JSON.parse(JSON.stringify(point)), { latitude: -12.04, longitude: -77.03 });
  assert.equal(toMapCoordinate(null), null);
});
