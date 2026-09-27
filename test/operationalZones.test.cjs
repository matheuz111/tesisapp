const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const context = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/types/canonical.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  context
);
const {
  getZoneByDistrict,
  getZoneByCoordinates,
  resolveOperationalZone,
  getZoneDisplayName,
  normalizeDistrictName,
  OPERATIONAL_ZONES,
} = context.exports;

test('District normalization handles whitespace, accents, and prefixes', () => {
  assert.equal(normalizeDistrictName('  Breña  '), 'BRENA');
  assert.equal(normalizeDistrictName('Jesús María'), 'JESUS MARIA');
  assert.equal(normalizeDistrictName('Distrito de San Isidro'), 'SAN ISIDRO');
  assert.equal(normalizeDistrictName('san martin de porres'), 'SAN MARTIN DE PORRES');
});

test('Maps districts to correct Lima Norte zone (including Carabayllo and Comas)', () => {
  assert.equal(getZoneByDistrict('Carabayllo'), 'LIMA_NORTE');
  assert.equal(getZoneByDistrict('Comas'), 'LIMA_NORTE');
  assert.equal(getZoneByDistrict('Los Olivos'), 'LIMA_NORTE');
  assert.equal(getZoneByDistrict('San Martín de Porres'), 'LIMA_NORTE');
  assert.equal(getZoneByDistrict('Independencia'), 'LIMA_NORTE');
  assert.equal(getZoneByDistrict('Puente Piedra'), 'LIMA_NORTE');
});

test('Maps districts to correct Lima Centro zone (including Miraflores)', () => {
  assert.equal(getZoneByDistrict('Miraflores'), 'LIMA_CENTRO');
  assert.equal(getZoneByDistrict('San Isidro'), 'LIMA_CENTRO');
  assert.equal(getZoneByDistrict('Breña'), 'LIMA_CENTRO');
  assert.equal(getZoneByDistrict('Jesús María'), 'LIMA_CENTRO');
  assert.equal(getZoneByDistrict('Surquillo'), 'LIMA_CENTRO');
  assert.equal(getZoneByDistrict('Cercado de Lima'), 'LIMA_CENTRO');
});

test('Maps districts to correct Lima Sur zone (including Chorrillos)', () => {
  assert.equal(getZoneByDistrict('Chorrillos'), 'LIMA_SUR');
  assert.equal(getZoneByDistrict('Santiago de Surco'), 'LIMA_SUR');
  assert.equal(getZoneByDistrict('San Juan de Miraflores'), 'LIMA_SUR');
  assert.equal(getZoneByDistrict('Villa El Salvador'), 'LIMA_SUR');
  assert.equal(getZoneByDistrict('Lurín'), 'LIMA_SUR');
});

test('Maps districts to correct Lima Este zone (including Ate)', () => {
  assert.equal(getZoneByDistrict('Ate'), 'LIMA_ESTE');
  assert.equal(getZoneByDistrict('San Juan de Lurigancho'), 'LIMA_ESTE');
  assert.equal(getZoneByDistrict('La Molina'), 'LIMA_ESTE');
  assert.equal(getZoneByDistrict('Santa Anita'), 'LIMA_ESTE');
  assert.equal(getZoneByDistrict('Chosica'), 'LIMA_ESTE');
});

test('Maps districts to correct Callao zone (including Callao)', () => {
  assert.equal(getZoneByDistrict('Callao'), 'CALLAO');
  assert.equal(getZoneByDistrict('Bellavista'), 'CALLAO');
  assert.equal(getZoneByDistrict('La Punta'), 'CALLAO');
  assert.equal(getZoneByDistrict('Ventanilla'), 'CALLAO');
  assert.equal(getZoneByDistrict('Carmen de la Legua Reynoso'), 'CALLAO');
});

test('Falls back strictly to UNKNOWN for unknown districts and coordinates, never defaulting to LIMA_CENTRO', () => {
  assert.equal(getZoneByDistrict('Huancayo'), 'UNKNOWN');
  assert.equal(getZoneByDistrict(''), 'UNKNOWN');
  assert.equal(getZoneByDistrict('Trujillo'), 'UNKNOWN');
  assert.equal(getZoneByCoordinates(-13.5, -71.9), 'UNKNOWN'); // Cusco
  assert.equal(getZoneDisplayName('UNKNOWN'), 'Zona sin determinar');
});

test('resolveOperationalZone prioritizes verified district > coords bounds > worker zone > UNKNOWN', () => {
  // 1. Verified district wins
  const res1 = resolveOperationalZone({
    district: 'Carabayllo',
    latitude: -12.08, // Centro coords
    longitude: -77.03,
    workerConfiguredZone: 'LIMA_SUR',
  });
  assert.equal(res1, 'LIMA_NORTE');

  // 2. Coords win when district is unknown
  const res2 = resolveOperationalZone({
    district: 'Extranjero',
    latitude: -12.1667, // Chorrillos
    longitude: -77.0167,
    workerConfiguredZone: 'LIMA_ESTE',
  });
  assert.equal(res2, 'LIMA_SUR');

  // 3. Worker configured zone wins when district and coords unknown
  const res3 = resolveOperationalZone({
    district: 'Desconocido',
    latitude: -13.5,
    longitude: -71.9,
    workerConfiguredZone: 'CALLAO',
  });
  assert.equal(res3, 'CALLAO');

  // 4. UNKNOWN when no evidence
  const res4 = resolveOperationalZone({
    district: null,
    latitude: null,
    longitude: null,
    workerConfiguredZone: null,
  });
  assert.equal(res4, 'UNKNOWN');
});
